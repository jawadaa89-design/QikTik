import { createHmac, randomInt, timingSafeEqual } from "crypto";
import type { PackageId } from "@/lib/features";
import { prisma } from "@/lib/db";

const SETTINGS_ID = "platform";
const RESET_TTL_MS = 15 * 60 * 1000;
const RESET_COOLDOWN_MS = 60_000;

let lastResetSentAt = 0;

function platformSecret() {
  return (
    process.env.PLATFORM_SESSION_SECRET?.trim() ||
    process.env.STAFF_SESSION_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
    "qiktik-platform-secret"
  );
}

export function hashPlatformPassword(password: string): string {
  return createHmac("sha256", platformSecret())
    .update(`platform-pw:${password.trim()}`)
    .digest("hex");
}

function hashesEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Env / demo fallback when no DB override is stored. */
export function envPlatformPassword(): string {
  return (
    process.env.PLATFORM_ADMIN_PASSWORD?.trim() ||
    process.env.STAFF_DEMO_PASSWORD?.trim() ||
    "qiktik2026"
  );
}

export function platformAdminEmail(): string {
  return (
    process.env.PLATFORM_ADMIN_EMAIL?.trim() ||
    "jawadaa@qiktik.tech"
  );
}

/**
 * Verify platform password against DB override, else env/demo fallback.
 */
export async function verifyPlatformPassword(
  password: string
): Promise<boolean> {
  const trimmed = password.trim();
  if (!trimmed) return false;

  try {
    const row = await prisma.platformSettings.findUnique({
      where: { id: SETTINGS_ID },
      select: { passwordHash: true },
    });
    if (row?.passwordHash) {
      return hashesEqual(row.passwordHash, hashPlatformPassword(trimmed));
    }
  } catch {
    /* DB unavailable — fall through to env */
  }

  return trimmed === envPlatformPassword();
}

/** @deprecated Prefer verifyPlatformPassword (async). Sync env-only check. */
export function platformPasswordOk(password: string): boolean {
  return password.trim() === envPlatformPassword();
}

/** Persist a new platform password (DB override; clears any pending reset). */
export async function updateStoredPlatformPassword(
  newPassword: string
): Promise<void> {
  const hash = hashPlatformPassword(newPassword);
  await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      passwordHash: hash,
      resetCodeHash: null,
      resetCodeExpiresAt: null,
    },
    update: {
      passwordHash: hash,
      resetCodeHash: null,
      resetCodeExpiresAt: null,
    },
  });
}

export type ResetRequestResult =
  | { ok: true; cooldownMs?: number }
  | { ok: false; error: string; status: number };

/** Create a 6-digit reset code and email it to the platform admin. */
export async function requestPlatformPasswordReset(): Promise<ResetRequestResult> {
  const now = Date.now();
  if (now - lastResetSentAt < RESET_COOLDOWN_MS) {
    return {
      ok: false,
      error: "Wait a minute before requesting another code",
      status: 429,
    };
  }

  const code = String(randomInt(100000, 999999));
  const codeHash = hashPlatformPassword(`reset:${code}`);
  const expires = new Date(now + RESET_TTL_MS);

  await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      resetCodeHash: codeHash,
      resetCodeExpiresAt: expires,
    },
    update: {
      resetCodeHash: codeHash,
      resetCodeExpiresAt: expires,
    },
  });

  const sent = await sendPlatformResetEmail(code);
  if (!sent.ok) {
    return { ok: false, error: sent.error, status: 503 };
  }

  lastResetSentAt = now;
  return { ok: true };
}

export async function confirmPlatformPasswordReset(
  code: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const trimmedCode = code.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(trimmedCode)) {
    return { ok: false, error: "Enter the 6-digit email code", status: 400 };
  }
  if (newPassword.trim().length < 4) {
    return {
      ok: false,
      error: "New password must be at least 4 characters",
      status: 400,
    };
  }

  const row = await prisma.platformSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (!row?.resetCodeHash || !row.resetCodeExpiresAt) {
    return { ok: false, error: "No reset in progress — request a code first", status: 400 };
  }
  if (row.resetCodeExpiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Code expired — request a new one", status: 400 };
  }
  if (
    !hashesEqual(row.resetCodeHash, hashPlatformPassword(`reset:${trimmedCode}`))
  ) {
    return { ok: false, error: "Wrong code", status: 401 };
  }

  await updateStoredPlatformPassword(newPassword);
  return { ok: true };
}

async function sendPlatformResetEmail(
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const to = platformAdminEmail();
  const key = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.PLATFORM_RESET_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    "QikTik Platform <onboarding@resend.dev>";

  if (!key) {
    // Dev / local: log the code so reset still works without Resend.
    console.info(`[platform-reset] code ${code} → ${to}`);
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error:
          "Email reset is not configured (set RESEND_API_KEY). Change password with the current one instead.",
      };
    }
    return { ok: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "QikTik platform password reset",
        text: `Your QikTik platform reset code is: ${code}\n\nIt expires in 15 minutes.\nIf you did not request this, ignore this email.`,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[platform-reset] Resend failed", res.status, body);
      return { ok: false, error: "Could not send reset email" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[platform-reset]", e);
    return { ok: false, error: "Could not send reset email" };
  }
}

export type VenuePublicUrls = {
  /** Restaurant home (main) for every package */
  menu: string;
  admin: string;
  staffPickup: string;
  alerts: string;
  kitchen: string;
  waiter: string;
};

export type VenueLinkKey = keyof VenuePublicUrls;

export function venuePublicUrls(slug: string): VenuePublicUrls {
  const base = `/r/${slug}`;
  return {
    /** Main guest link — restaurant home */
    menu: `${base}/ar/main`,
    admin: `${base}/admin`,
    staffPickup: `${base}/pickup`,
    alerts: `${base}/alerts`,
    kitchen: `${base}/kitchen`,
    waiter: `${base}/waiter`,
  };
}

/**
 * Links to show for a package.
 * Alerts + pickup share one staff board (`/pickup`) — never list both.
 */
export function venueLinkLabelsForPackage(
  packageId: PackageId | undefined
): { key: VenueLinkKey; label: string }[] {
  const links: { key: VenueLinkKey; label: string }[] = [
    { key: "menu", label: "Guest home (main)" },
    { key: "admin", label: "Admin" },
  ];

  if (packageId === "menu_alerts_pickup" || packageId === "menu_ordering") {
    links.push({ key: "staffPickup", label: "Alerts + pickup board" });
  } else if (packageId === "menu_alerts") {
    links.push({ key: "alerts", label: "Alerts board" });
  }

  if (packageId === "menu_ordering") {
    links.push({ key: "kitchen", label: "Kitchen" });
    links.push({ key: "waiter", label: "Waiter" });
  }

  return links;
}
