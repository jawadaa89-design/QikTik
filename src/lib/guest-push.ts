/** Client helpers for QikTik guest pickup Web Push + SW registration. */

export type GuestPushResult =
  | "subscribed"
  | "unavailable"
  | "denied"
  | "error"
  | "vapid-missing"
  | "needs-https"
  | "needs-homescreen";

export type GuestPushSubscribeOutcome = {
  result: GuestPushResult;
  /** Hostname of push endpoint when subscribed (e.g. web.push.apple.com). */
  endpointHost?: string | null;
  subscribed: boolean;
};

/** Why Web Push cannot work yet (null = client looks ready to subscribe). */
export type GuestPushBlocker =
  | null
  | "no-api"
  | "vapid-missing"
  | "insecure-context"
  | "ios-not-standalone";

/** Bump when changing public/sw.js so browsers fetch a fresh worker. */
const SW_URL = "/sw.js?v=5";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function endpointHostFromUrl(endpoint?: string | null): string | null {
  if (!endpoint) return null;
  try {
    return new URL(endpoint).hostname;
  } catch {
    return null;
  }
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

/** True when running as an installed PWA / home-screen web app. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.matchMedia?.("(display-mode: fullscreen)")?.matches ||
    window.matchMedia?.("(display-mode: minimal-ui)")?.matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(mq || iosStandalone);
}

/** Service Worker + Push require a secure context (https or localhost). */
export function isSecureContextForPush(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true;
}

export function isWebPushClientSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return key || null;
}

/**
 * Diagnose why background Web Push cannot run on this client.
 * Honest about iOS: Safari tabs (even “background”) are not enough — need
 * Home Screen / standalone PWA on HTTPS (iOS 16.4+).
 */
export function getGuestPushBlocker(): GuestPushBlocker {
  if (typeof window === "undefined") return "no-api";
  if (!getVapidPublicKey()) return "vapid-missing";
  if (!isSecureContextForPush()) return "insecure-context";
  if (isIosDevice() && !isStandaloneDisplay()) return "ios-not-standalone";
  if (!isWebPushClientSupported()) return "no-api";
  return null;
}

function waitForWorkerState(
  worker: ServiceWorker,
  target: ServiceWorkerState,
  timeoutMs = 4000
): Promise<void> {
  if (worker.state === target) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      worker.removeEventListener("statechange", onChange);
      resolve();
    };
    const onChange = () => {
      if (worker.state === target || worker.state === "redundant") done();
    };
    worker.addEventListener("statechange", onChange);
    window.setTimeout(done, timeoutMs);
  });
}

/**
 * Register the pickup SW and wait until it is ready + active (and ideally
 * controlling this page). Call early on page load so the Enable tap can do
 * permission → subscribe without a long SW wait after Allow.
 */
export async function registerPickupServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  // Plain http://LAN-IP is not a secure context — registration fails on phones.
  if (!isSecureContextForPush()) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });

    // Promote a waiting worker so activate/claim can finish before subscribe.
    if (reg.waiting) {
      reg.waiting.postMessage?.({ type: "SKIP_WAITING" });
    }
    if (reg.installing) {
      await waitForWorkerState(reg.installing, "activated");
    }

    const ready = await navigator.serviceWorker.ready;

    if (ready.waiting) {
      ready.waiting.postMessage?.({ type: "SKIP_WAITING" });
    }

    // Ensure we have an active worker before pushManager.subscribe.
    if (!ready.active && (ready.installing || ready.waiting)) {
      const pending = ready.installing || ready.waiting;
      if (pending) await waitForWorkerState(pending, "activated");
    }

    // Prefer a controlling client (clients.claim). Timeout so Enable is not stuck.
    if (!navigator.serviceWorker.controller && ready.active) {
      await Promise.race([
        new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => resolve(),
            { once: true }
          );
        }),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 2000);
        }),
      ]);
    }

    const finalReg =
      (await navigator.serviceWorker.getRegistration("/")) ?? ready ?? reg;
    if (!finalReg?.pushManager) {
      console.warn("[guest-push] SW registered but pushManager missing");
      return null;
    }
    return finalReg;
  } catch (err) {
    console.warn("[guest-push] SW register failed", err);
    return null;
  }
}

async function postSubscription(
  ticketId: string,
  locale: string,
  json: PushSubscriptionJSON
): Promise<GuestPushResult> {
  const res = await fetch(`/api/v1/pickup/${ticketId}/push-subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: json,
      locale,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(
      "[guest-push] push-subscribe failed",
      res.status,
      text.slice(0, 200)
    );
    if (res.status === 503) return "vapid-missing";
    return "error";
  }
  return "subscribed";
}

/**
 * Request notification permission (if needed), subscribe to push, and POST
 * the subscription to the ticket. Falls back gracefully when unsupported.
 *
 * Order (iOS-critical, single user gesture):
 *   1. Register / activate SW (wait ready + active) — before the prompt
 *   2. Notification.requestPermission() only if still "default"
 *   3. Immediately pushManager.subscribe({ userVisibleOnly, applicationServerKey })
 *   4. POST subscription — only then treat as success
 *
 * Do not call requestPermission in the UI and then call this helper afterward;
 * that splits the gesture and breaks first-Allow subscribe on iOS.
 */
export async function subscribeGuestPickupPush(
  ticketId: string,
  locale: string
): Promise<GuestPushResult> {
  const outcome = await subscribeGuestPickupPushDetailed(ticketId, locale);
  return outcome.result;
}

export async function subscribeGuestPickupPushDetailed(
  ticketId: string,
  locale: string
): Promise<GuestPushSubscribeOutcome> {
  const fail = (result: GuestPushResult): GuestPushSubscribeOutcome => ({
    result,
    subscribed: false,
    endpointHost: null,
  });

  if (typeof window === "undefined" || !("Notification" in window)) {
    return fail("unavailable");
  }

  const blocker = getGuestPushBlocker();
  if (blocker === "vapid-missing") return fail("vapid-missing");
  if (blocker === "insecure-context") return fail("needs-https");
  if (blocker === "ios-not-standalone") return fail("needs-homescreen");
  if (blocker === "no-api") return fail("unavailable");

  // Already denied — caller should show Settings re-enable help (no prompt).
  if (Notification.permission === "denied") {
    return fail("denied");
  }

  // 1) SW first (before permission) so after Allow we subscribe immediately.
  const reg = await registerPickupServiceWorker();
  if (!reg?.pushManager) return fail("unavailable");

  // Prefer the ready registration (guarantees an active worker when possible).
  const readyReg = await navigator.serviceWorker.ready;
  const pushReg = readyReg?.pushManager ? readyReg : reg;
  if (!pushReg.pushManager) return fail("unavailable");

  // 2) Permission — skip the prompt when already granted (e.g. iOS Settings).
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return fail("denied");

  try {
    const applicationServerKey = urlBase64ToUint8Array(
      getVapidPublicKey()!
    ) as BufferSource;

    // 3) Subscribe immediately in the same async turn after Allow / granted.
    //    userVisibleOnly is required on iOS Web Push.
    let sub = await pushReg.pushManager.getSubscription();
    if (!sub) {
      sub = await pushReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    let json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      // Stale/broken subscription — drop and retry once.
      try {
        await sub.unsubscribe();
      } catch {
        /* ignore */
      }
      sub = await pushReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      json = sub.toJSON();
    }

    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      console.warn("[guest-push] incomplete subscription keys");
      return fail("error");
    }

    // 4) Persist — UI should flip to “Background notifications on” only after this.
    let result = await postSubscription(ticketId, locale, json);
    if (result === "error") {
      // Endpoint may be stale for this origin — force a fresh subscribe.
      try {
        await sub.unsubscribe();
      } catch {
        /* ignore */
      }
      sub = await pushReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        return fail("error");
      }
      result = await postSubscription(ticketId, locale, json);
    }

    const endpointHost = endpointHostFromUrl(json.endpoint);
    if (result === "subscribed") {
      console.info(
        "[guest-push] subscribed",
        window.location.origin,
        endpointHost,
        json.endpoint?.slice(0, 48)
      );
      return { result: "subscribed", subscribed: true, endpointHost };
    }
    return { result, subscribed: false, endpointHost };
  } catch (err) {
    console.warn("[guest-push] subscribe failed", err);
    return fail("error");
  }
}
