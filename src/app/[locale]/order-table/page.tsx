"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { QikTikLogo } from "@/components/QikTikLogo";
import { VenueLogo } from "@/components/VenueLogo";
import { useVenueName, useVenueSlug } from "@/components/VenueProvider";
import { venueMainPath } from "@/lib/venue-paths";

export default function OrderTablePage() {
  const tMenu = useTranslations("menu");
  const tPickup = useTranslations("pickup");
  const locale = useLocale();
  const router = useRouter();
  const venueSlug = useVenueSlug();
  const venueName = useVenueName();

  const [tableNumber, setTableNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    const num = Number.parseInt(tableNumber.trim(), 10);
    if (!Number.isFinite(num) || num < 1) {
      setError(tMenu("tableNumberRequired"));
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/tables/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: num,
          venueSlug,
          locale,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data?.error?.code;
        if (code === "TABLE_NOT_FOUND") {
          setError(tMenu("tableNotFound"));
        } else if (code === "TABLE_DISABLED") {
          setError(tMenu("tableDisabled"));
        } else {
          setError(data?.error?.message ?? tMenu("orderAtTableError"));
        }
        return;
      }
      const path = typeof data?.path === "string" ? data.path : null;
      if (!path) {
        setError(tMenu("orderAtTableError"));
        return;
      }
      router.push(path);
    } catch {
      setError(tMenu("orderAtTableError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="guest-shell relative flex min-h-full flex-col px-5 pb-8 pt-8">
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
        <p className="mt-1 text-center text-sm text-ink-soft/55">
          {tMenu("orderAtTable")}
        </p>
      </div>

      <div className="guest-panel animate-rise mx-auto w-full max-w-md rounded-3xl p-5">
        <h2 className="font-display text-2xl font-semibold text-ink">
          {tMenu("orderAtTable")}
        </h2>
        <p className="mt-2 text-sm text-ink-soft/70">{tMenu("orderAtTableHint")}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">
              {tMenu("tableNumberLabel")} <span className="text-alert">*</span>
            </span>
            <input
              required
              inputMode="numeric"
              pattern="[0-9]*"
              value={tableNumber}
              onChange={(e) => {
                setTableNumber(e.target.value.replace(/[^\d]/g, "").slice(0, 4));
                if (error) setError(null);
              }}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
              autoComplete="off"
              autoFocus
              placeholder="7"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full disabled:opacity-55"
          >
            {busy ? tPickup("loading") : tMenu("continueToOrder")}
          </button>
        </form>
      </div>

      <p className="mt-8 mb-2 text-center text-sm">
        <Link
          href={venueMainPath(venueSlug, locale)}
          className="text-ink-soft/50 hover:text-brass"
        >
          {tPickup("backHome")}
        </Link>
      </p>
    </main>
  );
}
