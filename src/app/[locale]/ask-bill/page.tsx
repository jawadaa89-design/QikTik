"use client";

import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { GuestBackHome } from "@/components/GuestBackHome";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { QikTikLogo } from "@/components/QikTikLogo";
import { VenueLogo } from "@/components/VenueLogo";
import { useVenueName, useVenueSlug } from "@/components/VenueProvider";

type CallState = "idle" | "sending" | "sent" | "cooldown";

export default function AskBillPage() {
  const t = useTranslations("pickup");
  const locale = useLocale();
  const venueSlug = useVenueSlug();
  const venueName = useVenueName();

  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function openConfirm(e: FormEvent) {
    e.preventDefault();
    if (state !== "idle") return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("callWaiterNameRequired"));
      return;
    }

    setError(null);
    setConfirmOpen(true);
  }

  async function sendAskBill() {
    if (state !== "idle") return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setConfirmOpen(false);
      setError(t("callWaiterNameRequired"));
      return;
    }

    setConfirmOpen(false);
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/v1/pickup/call-waiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: trimmedName,
          comment: comment.trim() || undefined,
          venueSlug,
          locale,
          reason: "BILL",
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 429) {
        setState("cooldown");
        setError(t("callWaiterCooldown"));
        window.setTimeout(() => {
          setState("idle");
          setError(null);
        }, 15_000);
        return;
      }
      if (!res.ok) {
        const code = data?.error?.code;
        if (code === "NAME_REQUIRED") {
          setError(t("callWaiterNameRequired"));
        } else {
          setError(data?.error?.message ?? t("askBillError"));
        }
        setState("idle");
        return;
      }
      setComment("");
      setState("sent");
      window.setTimeout(() => {
        setState("cooldown");
        window.setTimeout(() => {
          setState("idle");
          setError(null);
        }, 15_000);
      }, 1500);
    } catch {
      setState("idle");
      setError(t("askBillError"));
    }
  }

  return (
    <main className="guest-shell relative flex min-h-full flex-col px-5 pb-8 pt-8">
      <div className="relative mb-2 min-h-10">
        <LanguageSwitcher className="absolute start-0 top-0 z-10 shrink-0" />
        <QikTikLogo className="absolute end-0 top-0 z-10" />
      </div>
      <GuestBackHome className="mb-4" />

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
        <p className="mt-1 text-center text-sm text-ink-soft/55">{t("askBill")}</p>
      </div>

      <div className="guest-panel animate-rise mx-auto w-full max-w-md rounded-3xl p-5">
        {state === "sent" ? (
          <div className="py-4 text-center">
            <p className="font-display text-2xl font-semibold text-ready">
              {t("askBillSent")}
            </p>
            <p className="mt-2 text-sm text-ink-soft/70">{t("askBillSeen")}</p>
          </div>
        ) : (
          <>
            <h2 className="font-display text-2xl font-semibold text-ink">
              {t("askBill")}
            </h2>
            <p className="mt-2 text-sm text-ink-soft/70">{t("askBillFormHint")}</p>

            <form onSubmit={openConfirm} className="mt-6 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-ink-soft">
                  {t("name")} <span className="text-alert">*</span>
                </span>
                <input
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                  autoComplete="name"
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-ink-soft">
                  {t("callWaiterComment")}{" "}
                  <span className="font-normal text-ink-soft/50">
                    {t("callWaiterCommentOptional")}
                  </span>
                </span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={280}
                  className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                  placeholder={t("askBillCommentHint")}
                />
              </label>

              {error && (
                <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={state !== "idle"}
                className="btn-primary w-full disabled:opacity-55"
              >
                {state === "sending"
                  ? t("loading")
                  : state === "cooldown"
                    ? t("callWaiterCooldown")
                    : t("askBillSubmit")}
              </button>
            </form>
          </>
        )}
      </div>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-5"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="ask-bill-confirm-title"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="guest-panel w-full max-w-sm rounded-3xl p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="ask-bill-confirm-title"
              className="font-display text-xl font-semibold text-ink"
            >
              {t("askBillConfirmTitle")}
            </h3>
            <p className="mt-2 text-sm text-ink-soft/75">{t("askBillConfirmBody")}</p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void sendAskBill()}
                className="btn-primary w-full"
              >
                {t("askBillConfirmYes")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="btn-ghost w-full"
              >
                {t("askBillConfirmNo")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
