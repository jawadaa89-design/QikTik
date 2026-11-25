"use client";

import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { primeStaffAlertAudio } from "@/components/PickupCallWaiterAlert";
import { useStaffLocale } from "@/components/StaffLanguageSwitcher";
import { staffGateMessages } from "@/i18n/staff";
import {
  clearStaffToken,
  ensureStaffApiFetchPatch,
  getStaffToken,
  setStaffToken,
  STAFF_AUTH_REQUIRED_EVENT,
} from "@/lib/staff-client";
import { useVenueSlug } from "@/components/VenueProvider";
import { venuePickupPath, venueStaffPath } from "@/lib/venue-paths";

/** Marks a successful unlock in this browser tab (survives URL token strip + Strict Mode). */
const STAFF_GATE_OK_KEY = "qiktik_staff_gate_ok";

/** Client-side expiry check for staff session tokens (`expiresAt.hmac`). */
function staffTokenStillValid(token: string | null | undefined): boolean {
  if (!token) return false;
  const payload = token.split(".")[0];
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt >= Date.now();
}

function StaffAuthGateInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale } = useStaffLocale();
  const venueSlug = useVenueSlug();
  const t = staffGateMessages[locale] ?? staffGateMessages.en;

  const staffError = searchParams.get("staff_error") === "1";
  // One-shot token from unlock-redirect (?staff_token= / ?access_token=).
  const unlockToken =
    searchParams.get("staff_token") || searchParams.get("access_token");

  // Initial state must match SSR: only URL tokens are known on the server.
  // Browser storage is read in useLayoutEffect after mount (avoids hydration mismatch).
  const [unlocked, setUnlocked] = useState(() => Boolean(unlockToken));
  const [ready, setReady] = useState(() => Boolean(unlockToken));

  useLayoutEffect(() => {
    if (unlockToken) {
      setStaffToken(unlockToken);
      try {
        sessionStorage.setItem(STAFF_GATE_OK_KEY, "1");
      } catch {
        /* ignore */
      }
      setUnlocked(true);
      setReady(true);
      // Strip token from the address bar — must NOT treat that as a logout.
      try {
        const clean = window.location.pathname;
        window.history.replaceState(null, "", clean);
      } catch {
        /* ignore */
      }
      return;
    }

    // Same tab after unlock (replaceState cleared the query, or React remounted).
    try {
      if (
        sessionStorage.getItem(STAFF_GATE_OK_KEY) === "1" &&
        staffTokenStillValid(getStaffToken())
      ) {
        setUnlocked(true);
        setReady(true);
        return;
      }
    } catch {
      /* ignore */
    }

    // Session from admin (or another staff page) in this browser — no second password.
    const existing = getStaffToken();
    if (staffTokenStillValid(existing)) {
      setStaffToken(existing!);
      try {
        sessionStorage.setItem(STAFF_GATE_OK_KEY, "1");
      } catch {
        /* ignore */
      }
      setUnlocked(true);
      setReady(true);
      return;
    }

    // No valid session — require password.
    clearStaffToken();
    try {
      sessionStorage.removeItem(STAFF_GATE_OK_KEY);
    } catch {
      /* ignore */
    }
    setUnlocked(false);
    setReady(true);
    try {
      document.cookie = "qiktik_staff=; path=/; max-age=0; SameSite=Lax";
      document.cookie = "qiktik_staff_token=; path=/; max-age=0; SameSite=Lax";
    } catch {
      /* ignore */
    }
  }, [unlockToken]);

  const showGuestPickupEscape =
    pathname === "/pickup" || (pathname?.startsWith("/pickup/") ?? false);

  function boardFromPath(path: string | null): "admin" | "pickup" | "alerts" | "kitchen" | "waiter" {
    if (!path) return "admin";
    if (path.includes("/kitchen")) return "kitchen";
    if (path.includes("/waiter")) return "waiter";
    if (path.includes("/alerts")) return "alerts";
    if (path.includes("/pickup")) return "pickup";
    return "admin";
  }

  // Prefer browser URL (/r/{slug}/…) — usePathname is the rewritten internal path.
  const [browserPath, setBrowserPath] = useState<string | null>(null);
  useLayoutEffect(() => {
    try {
      setBrowserPath(window.location.pathname);
    } catch {
      setBrowserPath(null);
    }
  }, [pathname]);

  const nextPath =
    browserPath && browserPath.startsWith("/r/")
      ? browserPath
      : venueStaffPath(venueSlug, boardFromPath(pathname));
  const guestPickupHref = venuePickupPath(venueSlug, locale === "he" || locale === "ru" || locale === "en" ? locale : "ar");

  useEffect(() => {
    if (!unlocked) return;
    const prime = () => primeStaffAlertAudio();
    window.addEventListener("pointerdown", prime, { once: true, capture: true });
    window.addEventListener("keydown", prime, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", prime, true);
      window.removeEventListener("keydown", prime, true);
    };
  }, [unlocked]);

  // API 401 STAFF_AUTH_REQUIRED → show login (fetch patch lives in staff-client).
  useEffect(() => {
    ensureStaffApiFetchPatch();
    const showLogin = () => {
      clearStaffToken();
      try {
        sessionStorage.removeItem(STAFF_GATE_OK_KEY);
      } catch {
        /* ignore */
      }
      setUnlocked(false);
      setReady(true);
    };

    window.addEventListener(STAFF_AUTH_REQUIRED_EVENT, showLogin);
    return () => {
      window.removeEventListener(STAFF_AUTH_REQUIRED_EVENT, showLogin);
    };
  }, []);

  if (!ready) {
    return (
      <div style={{ minHeight: "100dvh", background: "#12160f" }} />
    );
  }

  if (!unlocked) {
    return (
      <div
        style={{
          position: "relative",
          zIndex: 50,
          minHeight: "100dvh",
          padding: "32px 16px",
          background: "#12160f",
          color: "#eef2ef",
          touchAction: "manipulation",
        }}
      >
        <section
          style={{
            margin: "0 auto",
            width: "100%",
            maxWidth: 512,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.15)",
            padding: 24,
            background: "#1a1f18",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#f97316",
            }}
          >
            {t.badge}
          </p>
          <h1
            style={{
              margin: "8px 0 0",
              fontSize: 24,
              fontWeight: 600,
              color: "#f2efe8",
            }}
          >
            {t.title}
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#c8c4bb" }}>
            {t.hint}
          </p>

          {showGuestPickupEscape && (
            <a
              href={guestPickupHref}
              style={{
                display: "block",
                marginTop: 16,
                borderRadius: 12,
                border: "1px solid rgba(249, 115, 22, 0.45)",
                background: "rgba(249, 115, 22, 0.12)",
                color: "#f97316",
                padding: "12px",
                textAlign: "center",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {locale === "ar"
                ? "ضيف؟ افتح صفحة الاستلام بدون كلمة مرور"
                : locale === "he"
                  ? "אורח? לפתיחת איסוף בלי סיסמה"
                  : locale === "ru"
                    ? "Гость? Открыть самовывоз без пароля"
                    : "Guest? Open pickup — no password"}
            </a>
          )}

          <form
            method="POST"
            action="/api/v1/staff/unlock-redirect"
            style={{ marginTop: 20 }}
          >
            <input type="hidden" name="next" value={nextPath} />
            <input type="hidden" name="venue" value={venueSlug} />
            <label
              htmlFor="qiktik-staff-password"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#c8c4bb",
              }}
            >
              {t.password}
            </label>
            <input
              id="qiktik-staff-password"
              type="password"
              name="password"
              required
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
              style={{
                display: "block",
                width: "100%",
                marginTop: 8,
                boxSizing: "border-box",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                color: "#f2efe8",
                padding: "14px 12px",
                fontSize: 16,
                WebkitAppearance: "none",
                appearance: "none",
              }}
            />

            {staffError && (
              <p
                style={{
                  margin: "12px 0 0",
                  borderRadius: 12,
                  border: "1px solid rgba(212, 114, 114, 0.4)",
                  background: "rgba(212, 114, 114, 0.12)",
                  color: "#f0a0a0",
                  padding: "10px 12px",
                  fontSize: 14,
                }}
              >
                {t.wrongPassword}
              </p>
            )}

            <button
              type="submit"
              style={{
                display: "block",
                width: "100%",
                marginTop: 16,
                minHeight: 52,
                border: "none",
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                background: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)",
                color: "#0c100e",
                WebkitAppearance: "none",
                appearance: "none",
                touchAction: "manipulation",
              }}
            >
              {t.unlock}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return <>{children}</>;
}

export function StaffAuthGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100dvh", background: "#12160f" }} />
      }
    >
      <StaffAuthGateInner>{children}</StaffAuthGateInner>
    </Suspense>
  );
}
