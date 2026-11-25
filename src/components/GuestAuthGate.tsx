"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useGuestAuth } from "@/components/GuestAuthProvider";
import { useFeatures } from "@/components/FeaturesProvider";
import { QikTikLogo } from "@/components/QikTikLogo";
import { VenueLogo } from "@/components/VenueLogo";
import { TABLE_LOCK_MS } from "@/lib/table-lock";
import {
  getChosenLanguage,
  getLanguagePicked,
  setChosenLanguage,
  setLanguagePicked,
} from "@/lib/guest-lang";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { useVenueName } from "@/components/VenueProvider";

export function GuestAuthGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth");
  const tLang = useTranslations("language");
  const locale = useLocale() as Locale;
  const venueName = useVenueName();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const browseOnly = searchParams.get("browse") === "1";
  const auth = useGuestAuth();
  const { ready: featuresReady, hasFeature } = useFeatures();
  const ordering = hasFeature("ordering") && !browseOnly;

  const [langReady, setLangReady] = useState(false);
  const [langPicked, setLangPicked] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(true);
  const [waiterCalled, setWaiterCalled] = useState(false);
  const prevNeedsRegistration = useRef<boolean | null>(null);
  const prevToken = useRef<string>("");
  const unlockInputRef = useRef<HTMLInputElement | null>(null);

  const token = (() => {
    const parts = pathname.split("/");
    const i = parts.indexOf("t");
    return i >= 0 ? parts[i + 1] ?? "" : "";
  })();

  useEffect(() => {
    if (!token) {
      setLangReady(true);
      return;
    }

    const tableChanged = prevToken.current !== "" && prevToken.current !== token;
    prevToken.current = token;

    // New table QR / token → always choose language again
    if (tableChanged) {
      setLangPicked(false);
      setLangReady(true);
      prevNeedsRegistration.current = auth.needsRegistration;
      return;
    }

    // New guest after bill paid → language again
    if (auth.needsRegistration && prevNeedsRegistration.current === false) {
      setLangPicked(false);
      prevNeedsRegistration.current = true;
      setLangReady(true);
      return;
    }

    prevNeedsRegistration.current = auth.needsRegistration;

    const chosenLocale = getChosenLanguage(token);
    const pickedForSession = auth.sessionId
      ? getLanguagePicked(token, auth.sessionId)
      : false;
    const pickedForNewGuest = getLanguagePicked(token, null);
    const hasPicked = pickedForSession || pickedForNewGuest;
    const mismatchWithUrl = Boolean(chosenLocale && chosenLocale !== locale);

    if (auth.needsRegistration) {
      if (mismatchWithUrl) {
        setLangPicked(false);
        setLangReady(true);
        return;
      }
      setLangPicked(hasPicked);
      setLangReady(true);
      return;
    }

    // Existing session: restore from either key, then persist per-session key
    if (hasPicked) {
      setLangPicked(true);
      if (auth.sessionId && !pickedForSession) {
        setLanguagePicked(token, auth.sessionId);
      }
    } else {
      setLangPicked(false);
    }
    setLangReady(true);
  }, [token, auth.needsRegistration, auth.sessionId]);

  useEffect(() => {
    if (!auth.showUnlockPrompt) return;
    window.scrollTo(0, 0);
    const id = window.setTimeout(() => {
      unlockInputRef.current?.focus({ preventScroll: true });
      unlockInputRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [auth.showUnlockPrompt]);

  useEffect(() => {
    if (auth.needsRegistration && auth.guestName && !name) {
      setName(auth.guestName);
    }
  }, [auth.needsRegistration, auth.guestName, name]);

  function pickLanguage(next: Locale) {
    if (!token) return;
    setLanguagePicked(token, auth.sessionId);
    setChosenLanguage(token, next);
    setLangPicked(true);

    const segments = pathname.split("/");
    if (locales.includes(segments[1] as Locale)) {
      segments[1] = next;
    } else {
      segments.splice(1, 0, next);
    }
    const path = segments.join("/") || `/${next}`;
    const qs = searchParams.toString();
    const href = qs ? `${path}?${qs}` : path;
    if (next !== locale) router.push(href);
  }

  if (!featuresReady || !langReady || (ordering && !auth.ready)) {
    return (
      <div className="guest-shell flex min-h-dvh items-center justify-center px-6">
        <p className="text-ink-soft/50">{t("loading")}</p>
      </div>
    );
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!acceptTerms) {
      setError(t("termsRequired"));
      return;
    }
    if (password !== password2) {
      setError(t("passwordMismatch"));
      return;
    }
    if (password.length < 4) {
      setError(t("passwordShort"));
      return;
    }
    setBusy(true);
    try {
      const err = await auth.register({
        name: name.trim(),
        phone: phone.trim(),
        password,
        locale,
        acceptTerms: true,
        marketingOptIn: acceptMarketing,
      });
      if (err) setError(err);
      else {
        setPassword("");
        setPassword2("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const err = await auth.unlock(password);
      if (err) setError(err);
      else setPassword("");
    } finally {
      setBusy(false);
    }
  }

  async function callWaiterForgotPassword() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/tables/${token}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "WAITER_CALLED",
          reason: "forgot_password",
        }),
      });
      if (res.ok) setWaiterCalled(true);
      else setError("!");
    } finally {
      setBusy(false);
    }
  }

  if (!langPicked) {
    return (
      <div className="guest-shell flex min-h-dvh flex-col px-5 pb-10 pt-8">
        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col">
          <div className="absolute -end-10 -top-8 h-40 w-40 rounded-full bg-brass/10 blur-3xl" />
          <div className="absolute -start-12 top-32 h-36 w-36 rounded-full bg-[#1a2a24] blur-3xl" />
          <QikTikLogo className="absolute top-3 end-3 z-10" />

          <div className="relative flex flex-col items-center pt-2 animate-rise">
            <VenueLogo
              alt={venueName}
              width={176}
              height={176}
              className="h-44 w-44 rounded-full object-cover ring-2 ring-brass/45"
              priority
            />
            <h1 className="mt-5 text-center font-display text-3xl font-semibold leading-tight text-ink">
              {venueName}
            </h1>
            {auth.tableNumber != null && (
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-brass/80">
                {t("table")} {auth.tableNumber}
              </p>
            )}
          </div>

          <div className="relative mt-10 flex flex-1 flex-col justify-center animate-rise-delay-1">
            <p className="text-center text-sm font-medium text-ink-soft/70">
              {tLang("title")}
            </p>
            <div className="mt-5 grid gap-3">
              {locales.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => pickLanguage(loc)}
                  className="guest-panel rounded-2xl px-4 py-4 text-center text-lg font-semibold text-ink transition hover:border-brass/45 hover:bg-brass/10 active:scale-[0.99]"
                >
                  {localeNames[loc]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Menu-only package, or pickup “Digital Menu” (?browse=1): view without table registration.
  if (!ordering || browseOnly) {
    return <>{children}</>;
  }

  if (auth.needsRegistration) {
    const afterReset = Boolean(auth.guestName);
    return (
      <div className="guest-shell relative flex min-h-dvh flex-col justify-center px-5 py-10">
        <label className="absolute start-5 top-3 z-10 inline-flex shrink-0">
          <span className="sr-only">{tLang("select")}</span>
          <select
            aria-label={tLang("select")}
            value={locale}
            onChange={(e) => pickLanguage(e.target.value as Locale)}
            className="appearance-none rounded-xl border border-white/10 bg-white/[0.06] py-1.5 pe-8 ps-3 text-xs font-semibold tracking-wide text-ink outline-none"
          >
            {locales.map((loc) => (
              <option key={loc} value={loc} className="bg-[#161c19] text-ink">
                {localeNames[loc]}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-soft/50">
            ▾
          </span>
        </label>
        <QikTikLogo className="absolute top-3 end-5 z-10" />
        <div className="mx-auto mb-6 flex justify-center animate-rise">
          <VenueLogo
            alt={venueName}
            width={72}
            height={72}
            className="h-[4.5rem] w-[4.5rem] rounded-full object-cover ring-1 ring-brass/40"
            priority
          />
        </div>
        <div className="guest-panel animate-rise mx-auto w-full max-w-md rounded-3xl p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass/80">
            {t("table")} {auth.tableNumber ?? ""}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
            {afterReset ? t("passwordResetTitle") : t("welcomeTitle")}
          </h1>
          <p className="mt-2 text-sm text-ink-soft/70">
            {afterReset ? t("passwordResetHint") : t("welcomeHint")}
          </p>

          <form onSubmit={onRegister} className="mt-6 space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-ink-soft">{t("name")}</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                autoComplete="name"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-soft">{t("phone")}</span>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                autoComplete="tel"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-soft">{t("password")}</span>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                autoComplete="new-password"
                minLength={4}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-soft">{t("passwordConfirm")}</span>
              <input
                required
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                autoComplete="new-password"
                minLength={4}
              />
            </label>
            <p className="text-xs text-ink-soft/45">
              {t("lockHint", { minutes: Math.round(TABLE_LOCK_MS / 60000) })}
            </p>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <input
                type="checkbox"
                required
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#f97316]"
              />
              <span className="text-sm font-medium text-ink">
                {t("acceptTerms")}{" "}
                <span className="text-alert" aria-hidden="true">
                  *
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <input
                type="checkbox"
                checked={acceptMarketing}
                onChange={(e) => setAcceptMarketing(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#f97316]"
              />
              <span className="text-sm font-medium text-ink-soft">{t("acceptMarketing")}</span>
            </label>
            {error && (
              <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !acceptTerms}
              className="btn-primary w-full"
            >
              {busy ? "…" : t("startOrdering")}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Full-page unlock (not a bottom overlay) — phones stay at top of viewport
  if (auth.showUnlockPrompt) {
    return (
      <div className="guest-shell relative flex min-h-dvh flex-col px-5 pb-10 pt-8">
        <QikTikLogo className="absolute top-3 end-5 z-10" />
        <div className="mx-auto mb-6 flex w-full max-w-md justify-center">
          <VenueLogo
            alt={venueName}
            width={72}
            height={72}
            className="h-[4.5rem] w-[4.5rem] rounded-full object-cover ring-1 ring-brass/40"
            priority
          />
        </div>
        <div className="guest-panel mx-auto w-full max-w-md rounded-3xl p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass/80">
            {t("table")} {auth.tableNumber ?? ""}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
            {t("unlockTitle")}
          </h1>
          <p className="mt-1 text-sm text-ink-soft/70">
            {auth.guestName
              ? t("unlockHintNamed", { name: auth.guestName })
              : t("unlockHint")}
          </p>
          <form onSubmit={onUnlock} className="mt-5 space-y-3">
            <input
              ref={unlockInputRef}
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
              placeholder={t("password")}
              autoComplete="current-password"
              enterKeyHint="done"
              inputMode="text"
            />
            {error && (
              <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
                {error}
              </p>
            )}
            {error && (
              <div className="space-y-2 rounded-xl border border-brass/25 bg-brass/10 px-3 py-3">
                <p className="text-sm text-ink-soft">{t("forgotPasswordHint")}</p>
                {waiterCalled ? (
                  <p className="text-center text-sm font-semibold text-ready">
                    {t("waiterComingForgot")}
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={callWaiterForgotPassword}
                    className="btn-ghost w-full"
                  >
                    {t("forgotPasswordCallWaiter")}
                  </button>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPassword("");
                  setWaiterCalled(false);
                  auth.setShowUnlockPrompt(false);
                }}
                className="btn-ghost flex-1"
              >
                {t("cancel")}
              </button>
              <button type="submit" disabled={busy} className="btn-primary flex-1">
                {busy ? "…" : t("unlock")}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
