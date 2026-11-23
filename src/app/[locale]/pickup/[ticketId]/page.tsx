"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { CallWaiterBellIcon } from "@/components/CallWaiterBellIcon";
import { DigitalMenuLink } from "@/components/DigitalMenuLink";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { QikTikLogo } from "@/components/QikTikLogo";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import {
  playGuestPickupBeep,
  primeGuestPickupAudio,
} from "@/lib/guest-pickup-alert-audio";
import {
  getGuestPushBlocker,
  getVapidPublicKey,
  isIosDevice,
  isSecureContextForPush,
  isStandaloneDisplay,
  registerPickupServiceWorker,
  subscribeGuestPickupPush,
  type GuestPushBlocker,
} from "@/lib/guest-push";

const venueName = process.env.NEXT_PUBLIC_VENUE_NAME ?? "My Restaurant";

/** Soft first-visit prompt: dismissed or subscribed for this ticket. */
const PUSH_PROMPT_LS_PREFIX = "qiktik-push-prompt:";

type PushPromptKind = "enable" | "setup-homescreen";
type PushPromptMemory = "dismissed" | "enabled";

function pushPromptStorageKey(ticketId: string) {
  return `${PUSH_PROMPT_LS_PREFIX}${ticketId}`;
}

function readPushPromptMemory(ticketId: string): PushPromptMemory | null {
  try {
    const v = localStorage.getItem(pushPromptStorageKey(ticketId));
    if (v === "dismissed" || v === "enabled") return v;
  } catch {
    /* ignore */
  }
  return null;
}

function writePushPromptMemory(ticketId: string, value: PushPromptMemory) {
  try {
    localStorage.setItem(pushPromptStorageKey(ticketId), value);
  } catch {
    /* ignore */
  }
}

type NotifUiState =
  | "idle"
  | "granted"
  | "denied"
  | "unsupported"
  | "pushOn"
  | "pushUnavailable"
  | "needsSetup";

type Ticket = {
  id: string;
  customerName: string;
  phone: string | null;
  orderRef: string | null;
  status: "WAITING" | "READY" | "COMPLETED" | "CANCELLED";
  readyAt: string | null;
};

type PingPayload = {
  id: string;
  customerName: string;
  status?: string;
};

type GuestAlertKind = "ping" | "ready";

function vibratePing() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      // Cancel any in-progress pattern so each ping feels like a fresh buzz.
      navigator.vibrate(0);
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  } catch {
    /* ignore */
  }
}

export default function PickupWaitingPage() {
  const t = useTranslations("pickup");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const params = useParams<{ ticketId: string }>();
  const ticketId = params.ticketId;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifState, setNotifState] = useState<NotifUiState>("idle");
  const [pushBlocker, setPushBlocker] = useState<GuestPushBlocker>(null);
  /** True when the ticket row has a saved Web Push subscription (server). */
  const [serverHasPush, setServerHasPush] = useState(false);
  const [clientIos, setClientIos] = useState(false);
  const [clientStandalone, setClientStandalone] = useState(false);
  const [guestAlert, setGuestAlert] = useState<GuestAlertKind | null>(null);
  /** Bumps on every show so the popup remounts and CSS flash restarts on repeat pings. */
  const [alertPulseKey, setAlertPulseKey] = useState(0);
  const [callWaiterState, setCallWaiterState] = useState<
    "idle" | "sending" | "sent" | "seen" | "cooldown"
  >("idle");
  const [callWaiterError, setCallWaiterError] = useState<string | null>(null);
  const [callFormOpen, setCallFormOpen] = useState(false);
  const [callComment, setCallComment] = useState("");
  /** Soft first-visit push / Home Screen prompt (null = hidden). */
  const [pushPrompt, setPushPrompt] = useState<PushPromptKind | null>(null);
  const [pushPromptBusy, setPushPromptBusy] = useState(false);
  const notifiedReady = useRef(false);
  const pingHideTimer = useRef<number | null>(null);
  const callCooldownTimer = useRef<number | null>(null);
  const callSentTimer = useRef<number | null>(null);
  const callSeenTimer = useRef<number | null>(null);
  /** Avoid re-opening the soft prompt after the guest closed it this visit. */
  const pushPromptClosedRef = useRef(false);

  const dismissGuestAlert = useCallback(() => {
    setGuestAlert(null);
    if (pingHideTimer.current) {
      window.clearTimeout(pingHideTimer.current);
      pingHideTimer.current = null;
    }
  }, []);

  const showGuestAlert = useCallback((kind: GuestAlertKind) => {
    setGuestAlert(kind);
    setAlertPulseKey((k) => k + 1);
    if (pingHideTimer.current) window.clearTimeout(pingHideTimer.current);
    pingHideTimer.current = window.setTimeout(() => setGuestAlert(null), 12_000);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/pickup/${ticketId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? t("errorGeneric"));
        return;
      }
      setTicket(data.ticket);
      if (typeof data.hasPushSubscription === "boolean") {
        setServerHasPush(data.hasPushSubscription);
        if (data.hasPushSubscription) {
          setNotifState("pushOn");
        }
      }
      setError(null);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }, [ticketId, t]);

  const handlePing = useCallback(
    (payload: PingPayload) => {
      const name = payload.customerName || ticket?.customerName || "";

      showGuestAlert("ping");
      playGuestPickupBeep();
      vibratePing();

      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          try {
            new Notification(t("pingNotifTitle"), {
              body: t("pingNotifBody", { name }),
              tag: `pickup-ping-${payload.id}-${Date.now()}`,
              requireInteraction: true,
            });
          } catch {
            /* ignore */
          }
        }
      }
    },
    [showGuestAlert, t, ticket?.customerName]
  );

  useEffect(() => {
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [load]);

  useLiveEvents((event, data) => {
    if (event === "pickup:updated") {
      const payload = data as Ticket | null;
      if (!payload || payload.id !== ticketId) return;
      setTicket(payload);
      return;
    }
    if (event === "pickup:ping") {
      const payload = data as PingPayload | null;
      if (!payload || payload.id !== ticketId) return;
      handlePing(payload);
      return;
    }
    if (event === "pickup:assistance-updated") {
      const payload = data as {
        orderRef?: string | null;
        status?: string;
      } | null;
      if (!payload?.orderRef || !ticket?.orderRef) return;
      if (payload.orderRef !== ticket.orderRef) return;
      if (payload.status === "ACKNOWLEDGED") {
        if (callCooldownTimer.current) {
          window.clearTimeout(callCooldownTimer.current);
          callCooldownTimer.current = null;
        }
        if (callSentTimer.current) {
          window.clearTimeout(callSentTimer.current);
          callSentTimer.current = null;
        }
        setCallFormOpen(false);
        setCallWaiterError(null);
        setCallWaiterState("seen");
        if (callSeenTimer.current) window.clearTimeout(callSeenTimer.current);
        callSeenTimer.current = window.setTimeout(() => {
          setCallWaiterState("idle");
        }, 45_000);
        return;
      }
      if (payload.status === "DONE") {
        if (callSeenTimer.current) {
          window.clearTimeout(callSeenTimer.current);
          callSeenTimer.current = null;
        }
        setCallWaiterState("idle");
      }
    }
  });

  useEffect(() => {
    return () => {
      if (pingHideTimer.current) window.clearTimeout(pingHideTimer.current);
      if (callCooldownTimer.current) window.clearTimeout(callCooldownTimer.current);
      if (callSentTimer.current) window.clearTimeout(callSentTimer.current);
      if (callSeenTimer.current) window.clearTimeout(callSeenTimer.current);
    };
  }, []);

  function startCallCooldown(ms = 15_000) {
    if (callCooldownTimer.current) window.clearTimeout(callCooldownTimer.current);
    callCooldownTimer.current = window.setTimeout(() => {
      setCallWaiterState("idle");
      setCallWaiterError(null);
    }, ms);
  }

  function openCallForm() {
    setCallWaiterError(null);
    setCallFormOpen(true);
  }

  function closeCallForm() {
    setCallFormOpen(false);
    setCallWaiterError(null);
  }

  async function callWaiter(e?: FormEvent) {
    e?.preventDefault();
    if (callWaiterState !== "idle" || !ticket) return;
    const closed = ticket.status === "COMPLETED" || ticket.status === "CANCELLED";
    if (closed) return;
    // Unlock Web Audio in this tap so a later READY/ping beep can play.
    primeGuestPickupAudio();
    setCallWaiterError(null);
    setCallWaiterState("sending");
    try {
      const res = await fetch(`/api/v1/pickup/${ticketId}/call-waiter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: callComment.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 429) {
        setCallWaiterState("cooldown");
        setCallWaiterError(t("callWaiterCooldown"));
        startCallCooldown();
        return;
      }
      if (!res.ok) {
        setCallWaiterState("idle");
        setCallWaiterError(data?.error?.message ?? t("callWaiterError"));
        return;
      }
      setCallFormOpen(false);
      setCallComment("");
      setCallWaiterState("sent");
      if (callSentTimer.current) window.clearTimeout(callSentTimer.current);
      callSentTimer.current = window.setTimeout(() => {
        setCallWaiterState("cooldown");
      }, 2_000);
      startCallCooldown();
    } catch {
      setCallWaiterState("idle");
      setCallWaiterError(t("callWaiterError"));
    }
  }

  useEffect(() => {
    // Only register SW in a secure context (https / localhost).
    if (isSecureContextForPush()) {
      void registerPickupServiceWorker();
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const blocker = getGuestPushBlocker();
    setPushBlocker(blocker);
    setClientIos(isIosDevice());
    setClientStandalone(isStandaloneDisplay());

    if (!("Notification" in window)) {
      // iOS Safari tab often lacks Notification until installed as PWA.
      if (blocker === "insecure-context" || blocker === "ios-not-standalone") {
        setNotifState("needsSetup");
        return;
      }
      setNotifState("unsupported");
      return;
    }

    if (blocker === "insecure-context" || blocker === "ios-not-standalone") {
      // Still allow Enable for in-page alerts when Notification exists,
      // but surface the honest setup panel for background push.
      if (Notification.permission === "denied") {
        setNotifState("denied");
        return;
      }
      if (Notification.permission !== "granted") {
        setNotifState("needsSetup");
        return;
      }
      setNotifState("pushUnavailable");
      return;
    }

    if (Notification.permission === "denied") {
      setNotifState("denied");
      return;
    }
    if (Notification.permission === "granted") {
      if (!getVapidPublicKey()) {
        setNotifState("pushUnavailable");
        return;
      }
      // Optimistic: permission granted. load() / subscribe will upgrade to pushOn.
      setNotifState((prev) => (prev === "pushOn" ? prev : "granted"));
      // Re-attach push subscription if permission already granted (e.g. revisit).
      if (ticketId && getVapidPublicKey() && !blocker) {
        void subscribeGuestPickupPush(ticketId, locale).then((result) => {
          if (result === "subscribed") {
            setNotifState("pushOn");
            setServerHasPush(true);
            setPushBlocker(null);
          } else if (
            result === "needs-https" ||
            result === "needs-homescreen"
          ) {
            setNotifState("needsSetup");
            setPushBlocker(getGuestPushBlocker());
          } else if (result === "unavailable" || result === "vapid-missing") {
            setNotifState((prev) => (prev === "pushOn" ? prev : "pushUnavailable"));
          }
        });
      }
    }
  }, [ticketId, locale]);

  useEffect(() => {
    if (!ticket || ticket.status !== "READY" || notifiedReady.current) return;
    notifiedReady.current = true;

    showGuestAlert("ready");
    playGuestPickupBeep();
    vibratePing();

    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification(t("notifTitle"), {
        body: t("notifBody", { name: ticket.customerName }),
        tag: `pickup-${ticket.id}`,
      });
    } catch {
      /* ignore */
    }
  }, [ticket, t, showGuestAlert]);

  function dismissPushPrompt() {
    pushPromptClosedRef.current = true;
    setPushPrompt(null);
    setPushPromptBusy(false);
    if (ticketId) writePushPromptMemory(ticketId, "dismissed");
  }

  async function enableNotifications(): Promise<"subscribed" | "denied" | "other"> {
    if (typeof window === "undefined") return "other";
    // Must run in the click gesture — before await — so AudioContext unlocks.
    primeGuestPickupAudio();

    const blocker = getGuestPushBlocker();
    setPushBlocker(blocker);

    // On iOS Safari tab / plain HTTP, do not pretend Enable will give background push.
    if (blocker === "insecure-context" || blocker === "ios-not-standalone") {
      if (!("Notification" in window)) {
        setNotifState("needsSetup");
        return "other";
      }
      if (Notification.permission === "denied") {
        setNotifState("denied");
        return "denied";
      }
      // Still request permission for foreground/in-page alerts when possible.
      try {
        const result =
          Notification.permission === "granted"
            ? "granted"
            : await Notification.requestPermission();
        if (result !== "granted") {
          setNotifState("denied");
          return "denied";
        }
        setNotifState("pushUnavailable");
      } catch {
        setNotifState("needsSetup");
      }
      return "other";
    }

    if (!("Notification" in window)) {
      setNotifState("unsupported");
      return "other";
    }

    // Denied in Settings — do not re-prompt; show how to re-enable.
    if (Notification.permission === "denied") {
      setNotifState("denied");
      return "denied";
    }

    try {
      // Single user-gesture path (iOS): SW ready → requestPermission (if needed)
      // → pushManager.subscribe → POST. Do NOT call requestPermission here first —
      // that splits the gesture and breaks first-Allow background subscribe.
      const pushResult = await subscribeGuestPickupPush(ticketId, locale);
      if (pushResult === "subscribed") {
        setNotifState("pushOn");
        setServerHasPush(true);
        setPushBlocker(null);
        writePushPromptMemory(ticketId, "enabled");
        pushPromptClosedRef.current = true;
        setPushPrompt(null);
        return "subscribed";
      }
      if (pushResult === "needs-https" || pushResult === "needs-homescreen") {
        setNotifState("needsSetup");
        setPushBlocker(getGuestPushBlocker());
        return "other";
      }
      if (pushResult === "unavailable" || pushResult === "vapid-missing") {
        setNotifState("pushUnavailable");
        return "other";
      }
      if (pushResult === "denied") {
        setNotifState("denied");
        writePushPromptMemory(ticketId, "dismissed");
        pushPromptClosedRef.current = true;
        setPushPrompt(null);
        return "denied";
      }
      // Push failed but permission may be granted — keep Enable available;
      // in-page Notification still works until subscribe succeeds.
      if (Notification.permission === "granted") {
        setNotifState(serverHasPush ? "pushOn" : "granted");
        return "other";
      }
      setNotifState("pushUnavailable");
      return "other";
    } catch {
      if (Notification.permission === "denied") {
        setNotifState("denied");
        return "denied";
      } else if (Notification.permission === "granted") {
        setNotifState("granted");
      } else {
        setNotifState("denied");
        return "denied";
      }
      return "other";
    }
  }

  async function enableFromPushPrompt() {
    if (pushPromptBusy) return;
    setPushPromptBusy(true);
    try {
      const outcome = await enableNotifications();
      if (outcome === "subscribed" || outcome === "denied") return;
      // Soft prompt closed for this visit; inline Enable remains as fallback.
      pushPromptClosedRef.current = true;
      setPushPrompt(null);
      writePushPromptMemory(ticketId, "dismissed");
    } finally {
      setPushPromptBusy(false);
    }
  }

  // First-visit soft prompt: cannot call requestPermission without a gesture,
  // so auto-show a modal; Enable runs the existing one-shot subscribe path.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loading || !ticket || !ticketId) return;

    const closed =
      ticket.status === "COMPLETED" || ticket.status === "CANCELLED";
    if (closed || pushPromptClosedRef.current) {
      setPushPrompt(null);
      return;
    }

    const backgroundOn = notifState === "pushOn" || serverHasPush;
    if (backgroundOn) {
      writePushPromptMemory(ticketId, "enabled");
      setPushPrompt(null);
      return;
    }

    const memory = readPushPromptMemory(ticketId);
    if (memory === "dismissed") {
      setPushPrompt(null);
      return;
    }

    // HTTPS required — no soft “Enable” that fakes an OS prompt on plain HTTP.
    if (!isSecureContextForPush()) {
      setPushPrompt(null);
      return;
    }

    const blocker = getGuestPushBlocker();

    // iOS Safari tab: show Home Screen setup instead of a fake OS Allow dialog.
    if (blocker === "ios-not-standalone") {
      // Re-show only when still unsigned-up (permission default / no API yet).
      const perm =
        "Notification" in window ? Notification.permission : "default";
      if (perm === "denied") {
        setPushPrompt(null);
        return;
      }
      if (memory === "enabled" && perm === "granted") {
        setPushPrompt(null);
        return;
      }
      setPushPrompt("setup-homescreen");
      return;
    }

    // Only when push can actually work on this client.
    if (blocker !== null) {
      setPushPrompt(null);
      return;
    }
    if (!("Notification" in window)) {
      setPushPrompt(null);
      return;
    }

    const permission = Notification.permission;
    if (permission === "denied") {
      setPushPrompt(null);
      return;
    }

    // Remembered success: skip unless still default and no subscription.
    if (memory === "enabled" && permission === "granted") {
      setPushPrompt(null);
      return;
    }
    if (permission !== "default") {
      setPushPrompt(null);
      return;
    }

    setPushPrompt("enable");
  }, [loading, ticket, ticketId, notifState, serverHasPush]);

  const status = ticket?.status ?? "WAITING";
  const isReady = status === "READY";
  const isDone = status === "COMPLETED" || status === "CANCELLED";
  const alertName = ticket?.customerName ?? "";
  const alertTitle =
    guestAlert === "ready" ? t("readyTitle") : guestAlert === "ping" ? t("pingAlertTitle") : "";
  const alertBody =
    guestAlert === "ready"
      ? t("readyBody", { name: alertName })
      : guestAlert === "ping"
        ? t("pingAlertBody", { name: alertName })
        : "";

  // On iOS + plain HTTP both apply: insecure context is returned first by the
  // blocker helper, so also check device/standalone for Home Screen steps.
  const needsHttps = pushBlocker === "insecure-context";
  const needsHomeScreen = clientIos && !clientStandalone;
  const backgroundPushOn = notifState === "pushOn" || serverHasPush;
  const showPushSetup =
    !isDone &&
    !backgroundPushOn &&
    (notifState === "needsSetup" || needsHttps || needsHomeScreen);

  return (
    <main
      className="guest-shell relative flex min-h-dvh flex-col px-5 pb-10 pt-8"
      onPointerDown={primeGuestPickupAudio}
    >
      <div className="relative mb-2 min-h-10">
        <LanguageSwitcher className="absolute left-0 top-0 z-10 shrink-0" />
        <QikTikLogo className="absolute right-0 top-0 z-10" />
      </div>
      <div className="mx-auto mb-6 flex w-full max-w-md flex-col items-center">
        <Image
          src="/logo.png"
          alt={venueName}
          width={80}
          height={80}
          className="h-20 w-20 rounded-full object-cover ring-2 ring-brass/40"
          priority
        />
        <h1 className="mt-3 text-center font-display text-2xl font-semibold text-ink">
          {venueName}
        </h1>
        <div className="mt-4 flex w-full max-w-md justify-center">
          <DigitalMenuLink locale={locale} label={t("digitalMenu")} />
        </div>
      </div>

      {guestAlert && ticket && (
        <div
          key={`guest-alert-${guestAlert}-${alertPulseKey}`}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="guest-alert-title"
          aria-describedby="guest-alert-body"
          className="animate-guest-alert-backdrop fixed inset-0 z-50 flex items-center justify-center p-5"
          onClick={dismissGuestAlert}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              dismissGuestAlert();
            }
          }}
        >
          <button
            type="button"
            className="animate-guest-alert-flash w-full max-w-lg rounded-3xl border-4 border-[#9fe3bf] bg-[#1f9a5a] px-6 py-10 text-center shadow-[0_0_60px_rgba(61,200,120,0.65)] outline-none focus-visible:ring-4 focus-visible:ring-[#c8f5da]"
            onClick={(e) => {
              e.stopPropagation();
              dismissGuestAlert();
            }}
          >
            <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-[#d8ffe9]">
              {t("readyBadge")}
            </p>
            <h2
              id="guest-alert-title"
              className="mt-4 font-display text-4xl font-extrabold leading-tight text-white sm:text-5xl"
            >
              {alertTitle}
            </h2>
            <p
              id="guest-alert-body"
              className="mt-4 text-xl font-bold leading-snug text-[#eafff3] sm:text-2xl"
            >
              {alertBody}
            </p>
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[#c8f5da]/90">
              {tCommon("close")}
            </p>
          </button>
        </div>
      )}

      {pushPrompt && !guestAlert && !isDone && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="push-prompt-title"
          aria-describedby="push-prompt-body"
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-4 sm:items-center"
          onClick={dismissPushPrompt}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              dismissPushPrompt();
            }
          }}
        >
          <div
            className="guest-panel w-full max-w-md animate-rise rounded-3xl border border-brass/35 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass/90">
              {venueName}
            </p>
            <h2
              id="push-prompt-title"
              className="mt-3 font-display text-2xl font-semibold text-ink"
            >
              {pushPrompt === "setup-homescreen"
                ? t("pushPromptSetupTitle")
                : t("pushPromptTitle")}
            </h2>
            <p
              id="push-prompt-body"
              className="mt-2 text-sm leading-relaxed text-ink-soft/75"
            >
              {pushPrompt === "setup-homescreen"
                ? t("pushPromptSetupBody")
                : t("pushPromptBody")}
            </p>

            {pushPrompt === "setup-homescreen" && (
              <ol className="mt-4 list-decimal space-y-1.5 ps-4 text-start text-xs leading-relaxed text-ink-soft/75">
                <li>{t("iosHomeStepShare")}</li>
                <li>{t("iosHomeStepAdd")}</li>
                <li>{t("iosHomeStepOpen")}</li>
                <li>{t("iosHomeStepEnable")}</li>
              </ol>
            )}

            <div className="mt-6 flex flex-col gap-2">
              {pushPrompt === "enable" && (
                <button
                  type="button"
                  disabled={pushPromptBusy}
                  onClick={() => void enableFromPushPrompt()}
                  className="w-full rounded-xl border border-brass/40 bg-brass/20 px-4 py-3 text-sm font-bold text-brass disabled:opacity-55"
                >
                  {pushPromptBusy ? t("loading") : t("pushPromptEnable")}
                </button>
              )}
              <button
                type="button"
                disabled={pushPromptBusy}
                onClick={dismissPushPrompt}
                className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-ink-soft disabled:opacity-55"
              >
                {t("pushPromptNotNow")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`guest-panel animate-rise mx-auto w-full max-w-md rounded-3xl p-6 text-center ${
          isReady || guestAlert ? "border-ready/40 bg-ready/10" : ""
        }`}
      >
        {loading && !ticket ? (
          <p className="text-ink-soft/60">{t("loading")}</p>
        ) : error && !ticket ? (
          <p className="text-alert">{error}</p>
        ) : ticket ? (
          <>
            {isReady ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ready">
                  {t("readyBadge")}
                </p>
                <h2 className="mt-3 font-display text-3xl font-semibold text-ink">
                  {t("readyTitle")}
                </h2>
                <p className="mt-3 text-base text-ink-soft/80">
                  {t("readyBody", { name: ticket.customerName })}
                </p>
              </>
            ) : isDone ? (
              <>
                <h2 className="font-display text-2xl font-semibold text-ink">
                  {status === "CANCELLED" ? t("cancelledTitle") : t("completedTitle")}
                </h2>
                <p className="mt-2 text-sm text-ink-soft/70">{t("completedBody")}</p>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brass/35 bg-brass/10">
                  <span className="h-3 w-3 animate-pulse rounded-full bg-brass" />
                </div>
                <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
                  {t("waitingTitle")}
                </h2>
                <p className="mt-2 text-sm text-ink-soft/70">
                  {t("waitingBody", { name: ticket.customerName })}
                </p>
              </>
            )}

            {ticket.orderRef && (
              <div className="mt-6 rounded-2xl border border-brass/30 bg-brass/10 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass/80">
                  {t("yourTicketNumber")}
                </p>
                <p className="mt-1 font-display text-4xl font-semibold tracking-wide text-ink">
                  #{ticket.orderRef}
                </p>
                <p className="mt-2 text-xs text-ink-soft/60">{t("ticketNumberKeepHint")}</p>
              </div>
            )}

            <dl className="mt-4 space-y-2 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-start text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft/50">{t("name")}</dt>
                <dd className="font-semibold text-ink">{ticket.customerName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft/50">{t("statusLabel")}</dt>
                <dd className="font-semibold text-ink">
                  {status === "WAITING" && t("statusWaiting")}
                  {status === "READY" && t("statusReady")}
                  {status === "COMPLETED" && t("statusCompleted")}
                  {status === "CANCELLED" && t("statusCancelled")}
                </dd>
              </div>
            </dl>

            {!isDone && (
              <div className="mt-5 space-y-3">
                {callWaiterState === "seen" ? (
                  <p className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-center text-sm font-semibold text-emerald-300">
                    {t("callWaiterSeen")}
                  </p>
                ) : !callFormOpen ? (
                  <button
                    type="button"
                    disabled={callWaiterState !== "idle"}
                    onClick={openCallForm}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-alert/40 bg-alert/15 px-4 py-3 text-sm font-bold text-alert disabled:opacity-55"
                  >
                    <CallWaiterBellIcon />
                    {callWaiterState === "sending"
                      ? t("loading")
                      : callWaiterState === "sent"
                        ? t("callWaiterSent")
                        : callWaiterState === "cooldown"
                          ? t("callWaiterCooldown")
                          : t("callWaiter")}
                  </button>
                ) : (
                  <form
                    onSubmit={callWaiter}
                    className="space-y-3 rounded-2xl border border-alert/25 bg-alert/5 p-4"
                  >
                    <label className="block">
                      <span className="text-xs font-semibold text-ink-soft">
                        {t("callWaiterComment")}{" "}
                        <span className="font-normal text-ink-soft/50">
                          {t("callWaiterCommentOptional")}
                        </span>
                      </span>
                      <textarea
                        value={callComment}
                        onChange={(e) => setCallComment(e.target.value)}
                        rows={2}
                        maxLength={280}
                        className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                        placeholder={t("callWaiterCommentHint")}
                        autoFocus
                      />
                    </label>
                    {callWaiterError && (
                      <p className="text-xs text-alert">{callWaiterError}</p>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="submit"
                        disabled={callWaiterState !== "idle"}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-alert/40 bg-alert/15 px-4 py-3 text-sm font-bold text-alert disabled:opacity-55 sm:flex-1"
                      >
                        <CallWaiterBellIcon />
                        {callWaiterState === "sending"
                          ? t("loading")
                          : t("callWaiterSubmit")}
                      </button>
                      <button
                        type="button"
                        onClick={closeCallForm}
                        className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-ink-soft sm:flex-1"
                      >
                        {t("callWaiterCancel")}
                      </button>
                    </div>
                  </form>
                )}
                {!callFormOpen && callWaiterError && (
                  <p className="text-xs text-alert">{callWaiterError}</p>
                )}
              </div>
            )}

            {!isDone &&
              !backgroundPushOn &&
              !showPushSetup &&
              notifState !== "unsupported" &&
              notifState !== "denied" &&
              (notifState === "idle" ||
                notifState === "granted" ||
                notifState === "pushUnavailable") && (
                <button
                  type="button"
                  onClick={enableNotifications}
                  className="mt-5 w-full rounded-xl border border-brass/35 bg-brass/10 px-4 py-3 text-sm font-semibold text-brass"
                >
                  {t("enableNotifications")}
                </button>
              )}

            {showPushSetup && (
              <div className="mt-5 rounded-2xl border border-brass/30 bg-brass/10 px-4 py-4 text-start">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass/90">
                  {clientIos ? t("pushSetupTitle") : t("pushNeedsHttpsTitle")}
                </p>
                {clientIos && (
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft/75">
                    {t("pushSafariTabHonest")}
                  </p>
                )}
                {needsHttps && (
                  <p className="mt-3 text-xs leading-relaxed text-ink-soft/75">
                    {t("pushNeedsHttpsBody")}
                  </p>
                )}
                {needsHomeScreen && (
                  <ol className="mt-3 list-decimal space-y-1.5 ps-4 text-xs leading-relaxed text-ink-soft/75">
                    <li>{t("iosHomeStepShare")}</li>
                    <li>{t("iosHomeStepAdd")}</li>
                    <li>{t("iosHomeStepOpen")}</li>
                    <li>{t("iosHomeStepEnable")}</li>
                  </ol>
                )}
                {(notifState === "needsSetup" || notifState === "idle") && (
                  <button
                    type="button"
                    onClick={enableNotifications}
                    className="mt-4 w-full rounded-xl border border-brass/35 bg-brass/15 px-4 py-2.5 text-sm font-semibold text-brass"
                  >
                    {needsHttps || needsHomeScreen
                      ? t("enableNotificationsForeground")
                      : t("enableNotifications")}
                  </button>
                )}
              </div>
            )}

            {notifState === "unsupported" && !isDone && (
              <p className="mt-4 text-xs text-ink-soft/55">{t("notificationsUnsupported")}</p>
            )}
            {notifState === "denied" && !isDone && (
              <p className="mt-4 text-xs text-alert/80">{t("notificationsDenied")}</p>
            )}
            {backgroundPushOn && !isDone && (
              <p className="mt-4 text-xs text-ready/80">
                {t("notificationsPushOn")}
                <span className="mt-1 block text-[10px] font-normal text-ink-soft/50">
                  {t("notificationsPushSaved")}
                </span>
              </p>
            )}
            {notifState === "pushUnavailable" &&
              !backgroundPushOn &&
              !showPushSetup &&
              !isDone && (
                <p className="mt-4 text-xs text-ready/80">{t("notificationsOnFallback")}</p>
              )}
            {notifState === "pushUnavailable" &&
              !backgroundPushOn &&
              showPushSetup &&
              !isDone && (
                <p className="mt-3 text-xs text-ink-soft/60">{t("notificationsOnFallback")}</p>
              )}
          </>
        ) : null}
      </div>

      <p className="mt-6 text-center text-sm">
        <Link href={`/${locale}/pickup`} className="text-ink-soft/50 hover:text-brass">
          {t("registerAnother")}
        </Link>
      </p>
    </main>
  );
}
