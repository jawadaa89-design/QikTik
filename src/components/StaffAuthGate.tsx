"use client";

import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MobilePullToRefresh } from "@/components/MobilePullToRefresh";
import { primeStaffAlertAudio } from "@/components/PickupCallWaiterAlert";
import { useStaffLocale } from "@/components/StaffLanguageSwitcher";
import { staffGateMessages } from "@/i18n/staff";
import {
  clearStaffGateOk,
  clearStaffToken,
  ensureStaffApiFetchPatch,
  getStaffGateOk,
  getStaffToken,
  setStaffGateOk,
  setStaffToken,
  STAFF_AUTH_REQUIRED_EVENT,
} from "@/lib/staff-client";
import { useVenueSlug } from "@/components/VenueProvider";
import { venueMainPath, venueStaffPath } from "@/lib/venue-paths";

/** Client-side expiry check for staff session tokens (`expiresAt.venueId.hmac`). */
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

  function boardFromPath(path: string | null): "admin" | "pickup" | "alerts" | "kitchen" | "waiter" {
    if (!path) return "admin";
    if (path.includes("/kitchen")) return "kitchen";
    if (path.includes("/waiter")) return "waiter";
    if (path.includes("/alerts")) return "alerts";
    if (path.includes("/pickup")) return "pickup";
    return "admin";
  }

  useLayoutEffect(() => {
    if (unlockToken) {
      setStaffToken(unlockToken, venueSlug);
      setStaffGateOk(venueSlug);
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

    const board = boardFromPath(
      (() => {
        try {
          return window.location.pathname;
        } catch {
          return pathname;
        }
      })()
    );
    const existing = getStaffToken(venueSlug);
    const tokenOk = staffTokenStillValid(existing);
    const gateOk = getStaffGateOk(venueSlug);

    // Same browser tab after unlock (or React remount) — keep session.
    if (gateOk && tokenOk) {
      setUnlocked(true);
      setReady(true);
      return;
    }

    /**
     * Admin is sensitive: do NOT unlock from a leftover localStorage token alone.
     * Phones / Add-to-Home-Screen keep localStorage across launches, which previously
     * skipped the password. Admin requires a fresh unlock this tab (gateOk).
     * Kitchen / waiter / pickup may reuse a valid venue token for the shift.
     */
    if (board !== "admin" && tokenOk) {
      setStaffToken(existing!, venueSlug);
      setStaffGateOk(venueSlug);
      setUnlocked(true);
      setReady(true);
      return;
    }

    // No valid session for this venue — require password (do not clear other venues).
    if (!tokenOk) {
      clearStaffToken(venueSlug);
    }
    clearStaffGateOk(venueSlug);
    setUnlocked(false);
    setReady(true);
  }, [unlockToken, venueSlug, pathname]);

  const showGuestPickupEscape =
    pathname === "/pickup" || (pathname?.startsWith("/pickup/") ?? false);

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
  const guestMenuHref = venueMainPath(
    venueSlug,
    locale === "he" || locale === "ru" || locale === "en" ? locale : "ar"
  );

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
      clearStaffToken(venueSlug);
      clearStaffGateOk(venueSlug);
      setUnlocked(false);
      setReady(true);
    };

    window.addEventListener(STAFF_AUTH_REQUIRED_EVENT, showLogin);
    return () => {
      window.removeEventListener(STAFF_AUTH_REQUIRED_EVENT, showLogin);
    };
  }, [venueSlug]);

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
        <MobilePullToRefresh />
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
              href={guestMenuHref}
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
                ? "ضيف؟ افتح القائمة بدون كلمة مرور"
                : locale === "he"
                  ? "אורח? לפתיחת התפריט בלי סיסמה"
                  : locale === "ru"
                    ? "Гость? Открыть меню без пароля"
                    : "Guest? Open menu — no password"}
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

  return (
    <>
      <MobilePullToRefresh />
      {children}
    </>
  );
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
