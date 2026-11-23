import * as webpush from "web-push";
import { prisma } from "@/lib/db";
import {
  pickupPushMessages,
  type PickupPushLocale,
} from "@/lib/pickup-push-messages";

export type StoredPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
  locale?: string;
};

let vapidReady = false;

export function isVapidConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim() &&
      process.env.VAPID_SUBJECT?.trim()
  );
}

function ensureVapid(): boolean {
  if (vapidReady) return true;
  if (!isVapidConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!.trim(),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim()
  );
  vapidReady = true;
  return true;
}

/** Force re-read of VAPID env (e.g. after .env change in long-lived process). */
export function resetVapidCache(): void {
  vapidReady = false;
}

function parseStoredSubscription(
  raw: string | null | undefined
): StoredPushSubscription | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredPushSubscription;
    if (!parsed?.endpoint || !parsed?.keys?.p256dh || !parsed?.keys?.auth) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function toPushSubscription(stored: StoredPushSubscription) {
  return {
    endpoint: stored.endpoint,
    expirationTime: stored.expirationTime ?? undefined,
    keys: {
      p256dh: stored.keys.p256dh,
      auth: stored.keys.auth,
    },
  };
}

function resolveLocale(raw?: string | null): PickupPushLocale {
  if (raw === "ar" || raw === "he" || raw === "ru" || raw === "en") return raw;
  const fallback = process.env.NEXT_PUBLIC_DEFAULT_LOCALE?.trim();
  if (fallback === "ar" || fallback === "he" || fallback === "ru" || fallback === "en") {
    return fallback;
  }
  return "en";
}

async function clearSubscription(ticketId: string, reason: string) {
  try {
    await prisma.pickupTicket.update({
      where: { id: ticketId },
      data: { pushSubscription: null },
    });
    console.warn(
      `[web-push] cleared subscription for ticket ${ticketId} (${reason})`
    );
  } catch (err) {
    console.warn(
      `[web-push] failed to clear subscription for ticket ${ticketId}`,
      err
    );
  }
}

export type PickupPushKind = "ready" | "ping" | "seen" | "test";

/**
 * Send a Web Push to the guest subscription saved on the ticket.
 * No-ops when VAPID is missing or no subscription is stored.
 */
export type PickupPushResult = {
  sent: boolean;
  reason?: string;
  endpointHost?: string;
  tag?: string;
};

export async function sendPickupWebPush(opts: {
  ticketId: string;
  customerName: string;
  kind: PickupPushKind;
  /** Override stored locale when known */
  locale?: string | null;
}): Promise<PickupPushResult> {
  if (!ensureVapid()) {
    console.warn(
      `[web-push] skip ${opts.kind} for ${opts.ticketId}: vapid-missing`
    );
    return { sent: false, reason: "vapid-missing" };
  }

  const ticket = await prisma.pickupTicket.findUnique({
    where: { id: opts.ticketId },
    select: {
      pushSubscription: true,
      venue: { select: { slug: true } },
    },
  });
  const stored = parseStoredSubscription(ticket?.pushSubscription);
  if (!stored) {
    console.info(
      `[web-push] skip ${opts.kind} for ${opts.ticketId}: no-subscription`
    );
    return { sent: false, reason: "no-subscription" };
  }

  let endpointHost = "";
  try {
    endpointHost = new URL(stored.endpoint).hostname;
  } catch {
    endpointHost = "invalid-endpoint";
  }

  const locale = resolveLocale(opts.locale ?? stored.locale);
  const copy =
    opts.kind === "test"
      ? {
          title: "QikTik",
          body: "Test push OK — background delivery works.",
        }
      : pickupPushMessages[locale][opts.kind];
  const name = opts.customerName || "";
  // Unique per send so iOS does not collapse/suppress a second identical push.
  const sentAt = Date.now();
  const timeLabel = new Date(sentAt).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  // Relative path — SW resolves against the origin that registered it (tunnel or LAN).
  const venueSlug = ticket?.venue?.slug || "myrestaurant";
  const url = `/r/${venueSlug}/${locale}/pickup/${opts.ticketId}`;
  const baseBody =
    opts.kind === "test"
      ? copy.body
      : copy.body.replace(/\{name\}/g, name);
  // Ping/seen/test: vary body slightly each time (Apple may suppress identical content).
  const body =
    opts.kind === "ready" ? baseBody : `${baseBody} (${timeLabel})`;
  const tag =
    opts.kind === "ready"
      ? `pickup-ready-${opts.ticketId}`
      : opts.kind === "seen"
        ? `pickup-seen-${opts.ticketId}-${sentAt}`
        : opts.kind === "test"
          ? `pickup-test-${opts.ticketId}-${sentAt}`
          : `pickup-ping-${opts.ticketId}-${sentAt}`;
  // Apple Web Push expects a compact JSON body; keep top-level title/body plus
  // nested data.url (SW also accepts top-level url for older handlers).
  const payload = JSON.stringify({
    title: copy.title,
    body,
    data: {
      url,
      type: opts.kind,
      ticketId: opts.ticketId,
      sentAt,
    },
    url,
    tag,
    // Re-alert when replacing (ready uses a stable tag; ping uses unique tags).
    renotify: true,
    requireInteraction: true,
    type: opts.kind,
    timestamp: sentAt,
  });

  try {
    const result = await webpush.sendNotification(
      toPushSubscription(stored),
      payload,
      {
        // Explicit Apple-friendly options (aes128gcm is also web-push default).
        contentEncoding: "aes128gcm",
        urgency: "high",
        TTL: 60 * 60,
      }
    );
    console.info(
      `[web-push] sent ${opts.kind} for ${opts.ticketId}`,
      `status=${result.statusCode ?? 201}`,
      `endpoint=${endpointHost}`,
      `tag=${tag}`
    );
    return { sent: true, endpointHost, tag };
  } catch (err: unknown) {
    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode)
        : undefined;
    const body =
      err && typeof err === "object" && "body" in err
        ? String((err as { body?: unknown }).body ?? "")
        : "";

    if (statusCode === 404 || statusCode === 410) {
      await clearSubscription(opts.ticketId, `expired-${statusCode}`);
      return { sent: false, reason: "subscription-expired", endpointHost };
    }

    // BadJwtToken is almost always server VAPID_SUBJECT / key misconfig — do NOT
    // wipe the guest subscription (that hid the real bug behind "no-subscription").
    if (statusCode === 403 && /BadJwtToken/i.test(body)) {
      console.error(
        `[web-push] BadJwtToken for ${opts.ticketId} (check VAPID_SUBJECT — Apple rejects mailto:@*.local)`,
        `endpoint=${endpointHost}`,
        body
      );
      return { sent: false, reason: "vapid-bad-jwt", endpointHost };
    }

    // Other auth failures — drop so guest can re-subscribe cleanly.
    if (statusCode === 401 || statusCode === 403) {
      await clearSubscription(opts.ticketId, `auth-${statusCode}`);
      console.warn(
        `[web-push] send failed (auth) for ${opts.ticketId}`,
        statusCode,
        body || err
      );
      return { sent: false, reason: "vapid-rejected", endpointHost };
    }

    console.warn(
      `[web-push] send failed for ${opts.ticketId}`,
      statusCode ?? "",
      body || err
    );
    return { sent: false, reason: "send-failed", endpointHost };
  }
}

/** Notify the guest ticket linked to an assistance call (same venue + orderRef). */
export async function notifyGuestAssistanceAcknowledged(call: {
  venueId: string;
  orderRef: string;
  customerName: string;
}): Promise<PickupPushResult | null> {
  const ticket = await prisma.pickupTicket.findFirst({
    where: {
      venueId: call.venueId,
      orderRef: call.orderRef,
      status: { in: ["WAITING", "READY"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, customerName: true },
  });
  if (!ticket) return null;
  return sendPickupWebPush({
    ticketId: ticket.id,
    customerName: call.customerName || ticket.customerName,
    kind: "seen",
  });
}
