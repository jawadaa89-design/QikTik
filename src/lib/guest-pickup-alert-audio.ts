type AudioContextCtor = typeof AudioContext;

/** Shared context so READY / ping beeps work after register or a page gesture. */
let guestPickupAudioCtx: AudioContext | null = null;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ||
    null
  );
}

function getGuestPickupAudioCtx(): AudioContext | null {
  const AudioCtx = getAudioContextCtor();
  if (!AudioCtx) return null;
  if (!guestPickupAudioCtx || guestPickupAudioCtx.state === "closed") {
    guestPickupAudioCtx = new AudioCtx();
  }
  return guestPickupAudioCtx;
}

/**
 * Call during a user gesture (register/reconnect submit, page tap) so later
 * SSE-driven READY / ping alerts can play without autoplay blocks.
 */
export function primeGuestPickupAudio() {
  try {
    const ctx = getGuestPickupAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
  } catch {
    /* ignore audio failures */
  }
}

/**
 * Loud multi-tone attention beep for guest phones (Web Audio).
 * Peak gain near 1.0; reuses a primed context when possible.
 */
export function playGuestPickupBeep() {
  try {
    const ctx = getGuestPickupAudioCtx();
    if (!ctx) return;

    const start = () => {
      const now = ctx.currentTime;
      // Four alternating chirps — longer / louder so phones hear READY & pings outdoors.
      const tones = [880, 1175, 880, 1320];
      for (let i = 0; i < tones.length; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = tones[i]!;
        const t0 = now + i * 0.22;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.9, t0 + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.22);
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
