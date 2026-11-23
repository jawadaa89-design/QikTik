"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { QikTikLogo } from "@/components/QikTikLogo";
import { primeGuestPickupAudio } from "@/lib/guest-pickup-alert-audio";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";

const venueName = process.env.NEXT_PUBLIC_VENUE_NAME ?? "My Restaurant";
const VENUE_SLUG = DEFAULT_VENUE_SLUG;

type Mode = "register" | "reconnect";

export default function PickupRegisterPage() {
  const t = useTranslations("pickup");
  const locale = useLocale();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("register");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [reconnectName, setReconnectName] = useState("");
  const [reconnectTicket, setReconnectTicket] = useState("");
  const [ticketRequired, setTicketRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    if (next === "register") {
      setTicketRequired(false);
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // Unlock Web Audio in this submit gesture so READY/ping can beep on the waiting page.
    primeGuestPickupAudio();

    if (!customerName.trim()) {
      setError(t("nameRequired"));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/v1/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          phone: phone.trim() || undefined,
          venueSlug: VENUE_SLUG,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = data?.error?.code;
        if (code === "NAME_REQUIRED") {
          setError(t("nameRequired"));
          return;
        }
        setError(data?.error?.message ?? t("errorGeneric"));
        return;
      }
      router.push(`/${locale}/pickup/${data.ticket.id}`);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function onReconnect(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // Unlock Web Audio in this submit gesture so READY/ping can beep on the waiting page.
    primeGuestPickupAudio();

    const trimmedName = reconnectName.trim();
    if (!trimmedName) {
      setError(t("nameRequired"));
      return;
    }

    const trimmedTicket = reconnectTicket.trim();
    if (ticketRequired && !trimmedTicket) {
      setError(t("ticketNumberRequired"));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/v1/pickup/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: trimmedName,
          orderRef: trimmedTicket || undefined,
          venueSlug: VENUE_SLUG,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = data?.error?.code;
        if (code === "NAME_REQUIRED") {
          setError(t("nameRequired"));
          return;
        }
        if (code === "NAME_NOT_FOUND_TICKET_REQUIRED") {
          setTicketRequired(true);
          setError(t("reconnectNameMissTicketRequired"));
          return;
        }
        if (code === "NOT_FOUND") {
          setTicketRequired(true);
          setError(t("reconnectNotFound"));
          return;
        }
        setError(data?.error?.message ?? t("errorGeneric"));
        return;
      }
      router.push(`/${locale}/pickup/${data.ticket.id}`);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="guest-shell relative flex min-h-dvh flex-col px-5 pb-10 pt-8">
      <div className="relative mb-2 min-h-10">
        <LanguageSwitcher className="absolute start-0 top-0 z-10 shrink-0" />
        <QikTikLogo className="absolute end-0 top-0 z-10" />
      </div>
      <div className="mx-auto mb-6 flex w-full max-w-md flex-col items-center">
        <Image
          src="/logo.png"
          alt={venueName}
          width={96}
          height={96}
          className="h-24 w-24 rounded-full object-cover ring-2 ring-brass/40"
          priority
        />
        <h1 className="mt-4 text-center font-display text-3xl font-semibold text-ink">
          {venueName}
        </h1>
        <p className="mt-1 text-center text-sm text-ink-soft/55">{t("subtitle")}</p>
      </div>

      <div className="guest-panel animate-rise mx-auto w-full max-w-md rounded-3xl p-5">
        {mode === "register" ? (
          <>
            <h2 className="font-display text-2xl font-semibold text-ink">{t("title")}</h2>
            <p className="mt-2 text-sm text-ink-soft/70">{t("hint")}</p>

            <button
              type="button"
              onClick={() => switchMode("reconnect")}
              className="mt-4 w-full rounded-xl border border-brass/35 bg-brass/10 px-3 py-2.5 text-center text-sm font-bold text-brass transition hover:border-brass/55 hover:bg-brass/15"
            >
              {t("reconnectLink")}
            </button>

            <form onSubmit={onRegister} className="mt-6 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-ink-soft">
                  {t("name")} <span className="text-alert">*</span>
                </span>
                <input
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                  autoComplete="name"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-ink-soft">{t("phone")}</span>
                <div className="relative mt-1.5">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                    autoComplete="tel"
                  />
                  {/* type=tel forces LTR placeholders left; start-3 = right in RTL, left in LTR */}
                  {!phone.trim() && (
                    <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft/40">
                      {t("phoneOptional")}
                    </span>
                  )}
                </div>
              </label>

              {error && (
                <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
                  {error}
                </p>
              )}

              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? "…" : t("submit")}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-semibold text-ink">
              {t("reconnectTitle")}
            </h2>
            <p className="mt-2 text-sm text-ink-soft/70">{t("reconnectHint")}</p>

            <form onSubmit={onReconnect} className="mt-6 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-ink-soft">
                  {t("name")} <span className="text-alert">*</span>
                </span>
                <input
                  required
                  value={reconnectName}
                  onChange={(e) => {
                    setReconnectName(e.target.value);
                    if (error) setError(null);
                  }}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                  autoFocus
                  autoComplete="name"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-ink-soft">
                  {t("ticketNumber")}
                  {ticketRequired ? (
                    <span className="text-alert"> *</span>
                  ) : (
                    <span className="font-normal text-ink-soft/50">
                      {" "}
                      ({t("phoneOptional")})
                    </span>
                  )}
                </span>
                <input
                  value={reconnectTicket}
                  onChange={(e) => {
                    setReconnectTicket(e.target.value);
                    if (error) setError(null);
                  }}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-required={ticketRequired}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                  placeholder={t("ticketNumberHint")}
                />
              </label>

              {error && (
                <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
                  {error}
                </p>
              )}

              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? "…" : t("reconnectSubmit")}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-ink-soft/60">
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="font-semibold text-brass hover:underline"
              >
                {t("backToRegister")}
              </button>
            </p>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-sm">
        <Link href={`/${locale}/pickup`} className="text-ink-soft/50 hover:text-brass">
          {t("backHome")}
        </Link>
      </p>
    </main>
  );
}
