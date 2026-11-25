"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useEffect, useState } from "react";
import { CallWaiterBellIcon } from "@/components/CallWaiterBellIcon";
import { DigitalMenuLink } from "@/components/DigitalMenuLink";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { QikTikLogo } from "@/components/QikTikLogo";
import { VenueLogo } from "@/components/VenueLogo";
import { VenueContactIcons } from "@/components/VenueContactIcons";
import { registerPickupServiceWorker } from "@/lib/guest-push";
import { useVenueName, useVenueSlug } from "@/components/VenueProvider";
import { venuePickupPath } from "@/lib/venue-paths";

export default function PickupLandingPage() {
  const t = useTranslations("pickup");
  const locale = useLocale();
  const venueSlug = useVenueSlug();
  const venueName = useVenueName();

  useEffect(() => {
    void registerPickupServiceWorker();
  }, []);

  const [callFormOpen, setCallFormOpen] = useState(false);
  const [callName, setCallName] = useState("");
  const [callComment, setCallComment] = useState("");
  const [callState, setCallState] = useState<"idle" | "sending" | "sent" | "cooldown">(
    "idle"
  );
  const [callError, setCallError] = useState<string | null>(null);

  function openCallForm() {
    setCallError(null);
    setCallFormOpen(true);
  }

  function closeCallForm() {
    setCallFormOpen(false);
    setCallError(null);
  }

  async function onCallWaiter(e: FormEvent) {
    e.preventDefault();
    if (callState !== "idle") return;

    const trimmedName = callName.trim();
    if (!trimmedName) {
      setCallError(t("callWaiterNameRequired"));
      return;
    }

    setCallError(null);
    setCallState("sending");
    try {
      const res = await fetch("/api/v1/pickup/call-waiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: trimmedName,
          comment: callComment.trim() || undefined,
          venueSlug,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 429) {
        setCallState("cooldown");
        setCallError(t("callWaiterCooldown"));
        window.setTimeout(() => {
          setCallState("idle");
          setCallError(null);
        }, 15_000);
        return;
      }
      if (!res.ok) {
        const code = data?.error?.code;
        if (code === "NAME_REQUIRED") {
          setCallError(t("callWaiterNameRequired"));
        } else {
          setCallError(data?.error?.message ?? t("callWaiterError"));
        }
        setCallState("idle");
        return;
      }
      setCallFormOpen(false);
      setCallComment("");
      setCallState("sent");
      window.setTimeout(() => {
        setCallState("cooldown");
        window.setTimeout(() => {
          setCallState("idle");
          setCallError(null);
        }, 15_000);
      }, 1500);
    } catch {
      setCallState("idle");
      setCallError(t("callWaiterError"));
    }
  }

  return (
    <main className="guest-shell relative flex min-h-dvh flex-col px-5 pb-10 pt-8">
      <div className="relative mb-2 min-h-10">
        <LanguageSwitcher className="absolute start-0 top-0 z-10 shrink-0" />
        <QikTikLogo className="absolute end-0 top-0 z-10" />
      </div>
      <div className="mx-auto mb-6 flex w-full max-w-md flex-col items-center">
        <VenueLogo
          alt={venueName}
          width={96}
          height={96}
          className="h-24 w-24 rounded-full object-cover ring-2 ring-brass/40"
          priority
        />
        <h1 className="mt-4 text-center font-display text-3xl font-semibold text-ink">
          {venueName}
        </h1>
        <VenueContactIcons />
        <div className="mt-16 flex w-full max-w-md flex-col items-center space-y-3">
          <DigitalMenuLink locale={locale} venueSlug={venueSlug} label={t("digitalMenu")} />

          <Link
            href={`${venuePickupPath(venueSlug, locale)}/register`}
            className="btn-primary inline-flex w-full flex-col items-center justify-center gap-0.5 px-4 py-3.5 text-center"
          >
            <span className="text-sm font-bold leading-tight">{t("registerCta")}</span>
            <span className="text-xs font-medium leading-snug text-[#0c100e]/75">
              {t("subtitle")}
            </span>
          </Link>

          {!callFormOpen ? (
            <button
              type="button"
              disabled={callState !== "idle"}
              onClick={openCallForm}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-alert/40 bg-alert/15 px-4 py-3 text-sm font-bold text-alert transition hover:bg-alert/25 disabled:opacity-55"
            >
              <CallWaiterBellIcon />
              {callState === "sent"
                ? t("callWaiterSent")
                : callState === "cooldown"
                  ? t("callWaiterCooldown")
                  : t("callWaiter")}
            </button>
          ) : (
            <form
              onSubmit={onCallWaiter}
              className="guest-panel w-full space-y-3 rounded-2xl border border-alert/25 p-4"
            >
              <p className="text-sm text-ink-soft/75">{t("callWaiterFormHint")}</p>
              <label className="block">
                <span className="text-xs font-semibold text-ink-soft">
                  {t("name")} <span className="text-alert">*</span>
                </span>
                <input
                  required
                  value={callName}
                  onChange={(e) => {
                    setCallName(e.target.value);
                    if (callError) setCallError(null);
                  }}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                  autoComplete="name"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-ink-soft">
                  {t("callWaiterComment")}{" "}
                  <span className="font-normal text-ink-soft/50">{t("callWaiterCommentOptional")}</span>
                </span>
                <textarea
                  value={callComment}
                  onChange={(e) => setCallComment(e.target.value)}
                  rows={2}
                  maxLength={280}
                  className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                  placeholder={t("callWaiterCommentHint")}
                />
              </label>
              {callError && (
                <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
                  {callError}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={callState !== "idle"}
                  className="w-full rounded-xl border border-alert/40 bg-alert/15 px-4 py-3 text-sm font-bold text-alert disabled:opacity-55 sm:flex-1"
                >
                  {callState === "sending"
                    ? t("loading")
                    : callState === "sent"
                      ? t("callWaiterSent")
                      : callState === "cooldown"
                        ? t("callWaiterCooldown")
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
        </div>
      </div>
    </main>
  );
}
