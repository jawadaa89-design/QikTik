"use client";

type Props = {
  pulseKey: number;
  badge: string;
  title: string;
  nameLabel: string;
  name: string;
  orderRefLabel: string;
  orderRef: string | null;
  commentLabel?: string;
  comment?: string | null;
  dismissLabel: string;
  onDismiss: () => void;
};

/** Bold staff popup when a pickup guest calls a waiter. Remount via pulseKey for repeat calls. */
export function PickupCallWaiterAlert({
  pulseKey,
  badge,
  title,
  nameLabel,
  name,
  orderRefLabel,
  orderRef,
  commentLabel,
  comment,
  dismissLabel,
  onDismiss,
}: Props) {
  const trimmedComment = comment?.trim() || null;

  return (
    <div
      key={`pickup-call-waiter-${pulseKey}`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="pickup-call-waiter-title"
      className="animate-guest-alert-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-5"
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onDismiss();
        }
      }}
    >
      <button
        type="button"
        className="animate-guest-alert-flash w-full max-w-lg rounded-3xl border-4 border-[#fecaca] bg-[#b91c1c] px-6 py-10 text-center shadow-[0_0_60px_rgba(220,38,38,0.55)] outline-none focus-visible:ring-4 focus-visible:ring-[#fecaca]"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
      >
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-[#fee2e2]">
          {badge}
        </p>
        <h2
          id="pickup-call-waiter-title"
          className="mt-4 font-display text-4xl font-extrabold leading-tight text-white sm:text-5xl"
        >
          {title}
        </h2>
        <dl className="mt-6 space-y-3 text-start">
          <div className="rounded-2xl bg-black/20 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-[#fecaca]/90">
              {nameLabel}
            </dt>
            <dd className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">{name}</dd>
          </div>
          <div className="rounded-2xl bg-black/20 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-[#fecaca]/90">
              {orderRefLabel}
            </dt>
            <dd className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
              {orderRef ? `#${orderRef}` : "—"}
            </dd>
          </div>
          {trimmedComment && commentLabel ? (
            <div className="rounded-2xl bg-black/20 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-[#fecaca]/90">
                {commentLabel}
              </dt>
              <dd className="mt-1 text-lg font-semibold leading-snug text-white sm:text-xl">
                {trimmedComment}
              </dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[#fecaca]/90">
          {dismissLabel}
        </p>
      </button>
    </div>
  );
}

type AudioContextCtor = typeof AudioContext;

/** Shared context so Call Waiter can beep after staff unlock / any prior gesture. */
let staffAlertAudioCtx: AudioContext | null = null;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ||
    null
  );
}

function getStaffAlertAudioCtx(): AudioContext | null {
  const AudioCtx = getAudioContextCtor();
  if (!AudioCtx) return null;
  if (!staffAlertAudioCtx || staffAlertAudioCtx.state === "closed") {
    staffAlertAudioCtx = new AudioCtx();
  }
  return staffAlertAudioCtx;
}

/**
 * Call during a user gesture (staff password unlock / first click) so later
 * SSE-driven Call Waiter alerts can play without autoplay blocks.
 */
export function primeStaffAlertAudio() {
  try {
    const ctx = getStaffAlertAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
  } catch {
    /* ignore audio failures */
  }
}

/** Noticeable 3-tone attention beep (Web Audio). Reuses primed context when possible. */
export function playStaffCallBeep() {
  try {
    const ctx = getStaffAlertAudioCtx();
    if (!ctx) return;

    const start = () => {
      const now = ctx.currentTime;
      // Triple alternating chirps — same “attention” feel as guest Ping, louder/square for staff.
      const tones = [880, 1175, 880];
      for (let i = 0; i < tones.length; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = tones[i]!;
        const t0 = now + i * 0.2;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.18);
      }
    };

    if (ctx.state === "suspended") {
      void ctx.resume().then(start).catch(() => {
        /* autoplay still blocked until a gesture primes audio */
      });
      return;
    }
    start();
  } catch {
    /* ignore audio failures */
  }
}

export function vibrateStaffCall() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(0);
      navigator.vibrate([180, 80, 180, 80, 320]);
    }
  } catch {
    /* ignore */
  }
}
