"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MenuItemCard } from "@/components/MenuItemCard";
import { BottomNav } from "@/components/BottomNav";
import { useCart } from "@/components/CartProvider";
import { useGuestAuth } from "@/components/GuestAuthProvider";
import { useFeatures } from "@/components/FeaturesProvider";
import { QikTikLogo } from "@/components/QikTikLogo";
import type { MenuCategory, MenuItem } from "@/lib/demo-data";

type Props = {
  locale: string;
  token: string;
  tableNumber: number;
  venueName: string;
  categories: MenuCategory[];
};

export function GuestMenuClient({
  locale,
  token,
  tableNumber,
  venueName,
  categories,
}: Props) {
  const t = useTranslations("common");
  const tOrder = useTranslations("order");
  const searchParams = useSearchParams();
  const browseOnly = searchParams.get("browse") === "1";
  const { addItem, count } = useCart();
  const { guestName } = useGuestAuth();
  const { hasFeature } = useFeatures();
  const ordering = hasFeature("ordering") && !browseOnly;
  const alertsOnly =
    hasFeature("alerts") && !hasFeature("ordering") && !browseOnly;
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [activeSubId, setActiveSubId] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [callState, setCallState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  const current = categories.find((c) => c.id === activeCategory) ?? categories[0];
  const children = current?.children ?? [];

  const sections = useMemo(() => {
    if (!current) return [] as { id: string; name: string; items: MenuItem[] }[];

    const match = (item: MenuItem) =>
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());

    if (children.length === 0) {
      return [
        {
          id: current.id,
          name: current.name,
          items: current.items.filter(match),
        },
      ];
    }

    const parentSection =
      current.items.length > 0
        ? [{ id: current.id, name: current.name, items: current.items.filter(match) }]
        : [];

    const childSections = children.map((c) => ({
      id: c.id,
      name: c.name,
      items: c.items.filter(match),
    }));

    const all = [...parentSection, ...childSections];
    if (activeSubId === "all") return all.filter((s) => s.items.length > 0);
    return all.filter((s) => s.id === activeSubId);
  }, [current, children, search, activeSubId]);

  function selectCategory(id: string) {
    setActiveCategory(id);
    setActiveSubId("all");
  }

  async function callWaiter() {
    if (callState === "sending" || callState === "sent") return;
    setCallState("sending");
    try {
      const res = await fetch(`/api/v1/tables/${token}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "WAITER_CALLED" }),
      });
      if (!res.ok) {
        setCallState("error");
        return;
      }
      setCallState("sent");
      window.setTimeout(() => setCallState("idle"), 12_000);
    } catch {
      setCallState("error");
    }
  }

  return (
    <div
      className={
        ordering || alertsOnly ? "guest-shell pb-24" : "guest-shell pb-10"
      }
    >
      <header className="relative overflow-hidden border-b border-white/5 px-5 pb-5 pt-6">
        <div className="absolute inset-0 bg-gradient-to-b from-[#141c18] to-transparent" />
        <div className="absolute -end-16 -top-20 h-56 w-56 rounded-full bg-brass/10 blur-3xl" />
        <div className="relative animate-rise">
          <div className="relative min-h-14">
            <LanguageSwitcher className="absolute start-0 top-0 z-10 shrink-0" />
            <QikTikLogo className="absolute end-0 top-0 z-10" />
          </div>
          <div className="mt-2 flex flex-col items-center text-center">
            <Image
              src="/logo.png"
              alt={venueName}
              width={72}
              height={72}
              className="h-[4.5rem] w-[4.5rem] rounded-full object-cover ring-1 ring-brass/40"
              priority
            />
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.22em] text-brass/80">
              {browseOnly
                ? t("menu")
                : `${t("table")} ${tableNumber}${guestName ? ` · ${guestName}` : ""}`}
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-semibold leading-tight text-ink">
              {venueName}
            </h1>
          </div>

          <input
            type="search"
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-ink placeholder:text-ink-soft/50 outline-none focus:border-brass/40"
          />
        </div>
      </header>

      <div className="sticky top-0 z-30 border-b border-white/5 bg-[#0c110f]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => {
            const on = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => selectCategory(cat.id)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  on
                    ? "bg-brass text-[#0c100e]"
                    : "bg-white/[0.05] text-ink-soft hover:bg-white/[0.08]"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
        {children.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setActiveSubId("all")}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeSubId === "all"
                  ? "bg-white/15 text-ink"
                  : "text-ink-soft/70 hover:text-ink"
              }`}
            >
              {t("all")}
            </button>
            {current.items.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveSubId(current.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeSubId === current.id
                    ? "bg-white/15 text-ink"
                    : "text-ink-soft/70 hover:text-ink"
                }`}
              >
                {current.name}
              </button>
            )}
            {children.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setActiveSubId(sub.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeSubId === sub.id
                    ? "bg-white/15 text-ink"
                    : "text-ink-soft/70 hover:text-ink"
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="flex flex-col gap-2.5 px-4 py-5">
        {sections.map((section) => (
          <div key={section.id} className="space-y-2.5">
            <h2 className="pt-1 font-display text-xl font-semibold text-ink animate-rise">
              {section.name}
            </h2>
            {section.items.map((item, i) => (
              <MenuItemCard key={item.id} item={item} onAdd={addItem} index={i} />
            ))}
          </div>
        ))}
        {sections.every((s) => s.items.length === 0) && (
          <p className="py-10 text-center text-sm text-ink-soft/50">—</p>
        )}
      </section>

      {alertsOnly ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0c110f]/95 px-4 py-3 backdrop-blur-md">
          <button
            type="button"
            onClick={() => void callWaiter()}
            disabled={callState === "sending" || callState === "sent"}
            className="btn-primary w-full disabled:opacity-60"
          >
            {callState === "sending"
              ? t("loading")
              : callState === "sent"
                ? tOrder("callWaiter") + " ✓"
                : callState === "error"
                  ? tOrder("callWaiter")
                  : tOrder("callWaiter")}
          </button>
        </div>
      ) : null}

      {ordering ? (
        <BottomNav locale={locale} tableToken={token} cartCount={count} active="menu" />
      ) : null}
    </div>
  );
}
