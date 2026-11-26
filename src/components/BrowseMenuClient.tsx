"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CallWaiterBellIcon } from "@/components/CallWaiterBellIcon";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { QikTikLogo } from "@/components/QikTikLogo";
import { VenueLogo } from "@/components/VenueLogo";
import { VenueContactIcons } from "@/components/VenueContactIcons";
import { formatPrice } from "@/lib/utils";
import { useVenueSlug } from "@/components/VenueProvider";
import { useVenueHeroSrc } from "@/components/VenueThemeProvider";
import { venuePickupPath } from "@/lib/venue-paths";
import type { MenuCategory, MenuItem } from "@/lib/demo-data";
import type { Locale } from "@/i18n/config";

const VISITOR_KEY = "qiktik_visitor_id";

function getOrCreateVisitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_KEY)?.trim() || "";
    if (!id || id.length < 8) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

type Props = {
  venueName: string;
  categories: MenuCategory[];
  /** Menu+alerts: call waiter from the public menu (no table token). */
  enableCallWaiter?: boolean;
  /** Menu+ordering: enter table number → register & order. */
  enableOrderAtTable?: boolean;
  /** Menu+pickup: register for pickup notifications from the menu. */
  enablePickup?: boolean;
  /** Hide items and show a coming-soon placeholder. */
  comingSoon?: boolean;
};

/** Public digital menu — restaurant home; optional pickup / call-waiter / order-at-table. */
export function BrowseMenuClient({
  venueName,
  categories,
  enableCallWaiter = false,
  enableOrderAtTable = false,
  enablePickup = false,
  comingSoon = false,
}: Props) {
  const t = useTranslations("common");
  const tMenu = useTranslations("menu");
  const tPickup = useTranslations("pickup");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const venueSlug = useVenueSlug();
  const heroSrc = useVenueHeroSrc();
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [activeSubId, setActiveSubId] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [callFormOpen, setCallFormOpen] = useState(false);
  const [callName, setCallName] = useState("");
  const [callComment, setCallComment] = useState("");
  const [callState, setCallState] = useState<"idle" | "sending" | "sent" | "cooldown">(
    "idle"
  );
  const [callError, setCallError] = useState<string | null>(null);
  /** Landing first — menu items only after guest taps the Menu box. */
  const [menuOpen, setMenuOpen] = useState(false);

  // Count unique guest visits to the restaurant home / digital menu (once per browser per day).
  useEffect(() => {
    const visitorId = getOrCreateVisitorId();
    if (!visitorId || !venueSlug) return;
    void fetch("/api/v1/menu/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, venueSlug }),
      keepalive: true,
    }).catch(() => {
      /* ignore analytics failures */
    });
  }, [venueSlug]);

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

  function openOrderForm() {
    setOrderError(null);
    setOrderFormOpen(true);
    setCallFormOpen(false);
  }

  function closeOrderForm() {
    setOrderFormOpen(false);
    setOrderError(null);
  }

  async function onOrderAtTable(e: FormEvent) {
    e.preventDefault();
    if (orderBusy) return;

    const num = Number.parseInt(tableNumber.trim(), 10);
    if (!Number.isFinite(num) || num < 1) {
      setOrderError(tMenu("tableNumberRequired"));
      return;
    }

    setOrderError(null);
    setOrderBusy(true);
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
          setOrderError(tMenu("tableNotFound"));
        } else if (code === "TABLE_DISABLED") {
          setOrderError(tMenu("tableDisabled"));
        } else {
          setOrderError(data?.error?.message ?? tMenu("orderAtTableError"));
        }
        return;
      }
      const path = typeof data?.path === "string" ? data.path : null;
      if (!path) {
        setOrderError(tMenu("orderAtTableError"));
        return;
      }
      router.push(path);
    } catch {
      setOrderError(tMenu("orderAtTableError"));
    } finally {
      setOrderBusy(false);
    }
  }

  function openCallForm() {
    setCallError(null);
    setCallFormOpen(true);
    setOrderFormOpen(false);
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
      setCallError(tPickup("callWaiterNameRequired"));
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
        setCallError(tPickup("callWaiterCooldown"));
        window.setTimeout(() => {
          setCallState("idle");
          setCallError(null);
        }, 15_000);
        return;
      }
      if (!res.ok) {
        const code = data?.error?.code;
        if (code === "NAME_REQUIRED") {
          setCallError(tPickup("callWaiterNameRequired"));
        } else {
          setCallError(data?.error?.message ?? tPickup("callWaiterError"));
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
      setCallError(tPickup("callWaiterError"));
    }
  }

  const outlineBtn =
    "inline-flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/20 bg-transparent px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white/[0.04] disabled:opacity-55";

  function guestActions(variant: "stage" | "compact") {
    const stage = variant === "stage";
    return (
      <div className={stage ? "space-y-2.5" : "space-y-2.5"}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          className={
            stage
              ? "inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brass px-4 py-3 text-sm font-bold text-[#0c100e] shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:brightness-105"
              : `guest-panel inline-flex w-full items-center justify-center rounded-2xl px-4 py-3.5 text-center transition ${
                  menuOpen ? "border-brass/45 bg-brass/15" : "hover:border-brass/35"
                }`
          }
        >
          {stage && !menuOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 4.5h9.5a2 2 0 0 1 2 2V20l-4.25-2.2L9 20V6.5a2 2 0 0 1 2-2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M9 4.5h-3A1.5 1.5 0 0 0 4.5 6v14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          ) : null}
          <span className="leading-tight">
            {menuOpen ? t("menu") : t("viewMenu")}
          </span>
        </button>

        {enablePickup ? (
          <Link
            href={`${venuePickupPath(venueSlug, locale)}/register`}
            className={
              stage
                ? outlineBtn
                : "btn-primary inline-flex w-full flex-col items-center justify-center gap-0.5 px-4 py-3.5 text-center"
            }
          >
            {stage ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="text-brass">
                <path
                  d="M7.5 9V7.2A4.5 4.5 0 0 1 12 2.7 4.5 4.5 0 0 1 16.5 7.2V9"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <path
                  d="M5.5 9h13l-.7 10.2a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5.5 9Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
            <span className="leading-tight">
              {stage ? tPickup("pickupShort") : tPickup("registerCta")}
            </span>
            {!stage ? (
              <span className="text-xs font-medium leading-snug text-[#0c100e]/75">
                {tPickup("subtitle")}
              </span>
            ) : null}
          </Link>
        ) : null}

        {enableOrderAtTable ? (
          !orderFormOpen ? (
            <button
              type="button"
              onClick={openOrderForm}
              className={
                stage
                  ? outlineBtn
                  : "btn-primary inline-flex w-full items-center justify-center px-4 py-3 text-sm font-bold"
              }
            >
              {tMenu("orderAtTable")}
            </button>
          ) : (
            <form
              onSubmit={onOrderAtTable}
              className="guest-panel w-full space-y-3 rounded-2xl border border-brass/25 p-4"
            >
              <p className="text-sm text-ink-soft/75">{tMenu("orderAtTableHint")}</p>
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
                    if (orderError) setOrderError(null);
                  }}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                  autoComplete="off"
                  autoFocus
                  placeholder="7"
                />
              </label>
              {orderError && (
                <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
                  {orderError}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={orderBusy}
                  className="btn-primary w-full px-4 py-3 text-sm font-bold disabled:opacity-55 sm:flex-1"
                >
                  {orderBusy ? tPickup("loading") : tMenu("continueToOrder")}
                </button>
                <button
                  type="button"
                  onClick={closeOrderForm}
                  className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-ink-soft sm:flex-1"
                >
                  {t("close")}
                </button>
              </div>
            </form>
          )
        ) : null}

        {enableCallWaiter ? (
          !callFormOpen ? (
            <button
              type="button"
              disabled={callState !== "idle"}
              onClick={openCallForm}
              className={
                stage
                  ? outlineBtn
                  : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-alert/40 bg-alert/15 px-4 py-3 text-sm font-bold text-alert transition hover:bg-alert/25 disabled:opacity-55"
              }
            >
              <CallWaiterBellIcon className={stage ? "text-brass" : undefined} />
              {callState === "sent"
                ? tPickup("callWaiterSent")
                : callState === "cooldown"
                  ? tPickup("callWaiterCooldown")
                  : tPickup("callWaiter")}
            </button>
          ) : (
            <form
              onSubmit={onCallWaiter}
              className="guest-panel w-full space-y-3 rounded-2xl border border-alert/25 p-4"
            >
              <p className="text-sm text-ink-soft/75">{tPickup("callWaiterFormHint")}</p>
              <label className="block">
                <span className="text-xs font-semibold text-ink-soft">
                  {tPickup("name")} <span className="text-alert">*</span>
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
                  {tPickup("callWaiterComment")}{" "}
                  <span className="font-normal text-ink-soft/50">
                    {tPickup("callWaiterCommentOptional")}
                  </span>
                </span>
                <textarea
                  value={callComment}
                  onChange={(e) => setCallComment(e.target.value)}
                  rows={2}
                  maxLength={280}
                  className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                  placeholder={tPickup("callWaiterCommentHint")}
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
                    ? tPickup("loading")
                    : callState === "sent"
                      ? tPickup("callWaiterSent")
                      : callState === "cooldown"
                        ? tPickup("callWaiterCooldown")
                        : tPickup("callWaiterSubmit")}
                </button>
                <button
                  type="button"
                  onClick={closeCallForm}
                  className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-ink-soft sm:flex-1"
                >
                  {tPickup("callWaiterCancel")}
                </button>
              </div>
            </form>
          )
        ) : null}
      </div>
    );
  }

  return (
    <div className={`guest-shell ${menuOpen ? "pb-4" : "pb-0"}`}>
      {!menuOpen ? (
        <header className="relative isolate min-h-[calc(100dvh-2.75rem)] animate-rise overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src={heroSrc}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-[center_40%]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
            {/* Soft fade: photo stays under branding, goes black around the menu button */}
            <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-b from-transparent via-black/45 to-black/90" />
            <div className="absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-[#0c110f] via-[#0c110f]/85 to-transparent" />
          </div>

          <div className="relative z-10 flex min-h-[calc(100dvh-2.75rem)] flex-col">
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <LanguageSwitcher className="shrink-0 [&_select]:h-8 [&_select]:border-white/20 [&_select]:bg-black/40 [&_select]:py-0 [&_select]:backdrop-blur-sm" />
              <QikTikLogo className="!h-7 !w-auto !rounded-md !bg-black/30 !p-1 !backdrop-blur-sm" />
            </div>

            <div className="min-h-[4rem] flex-1" aria-hidden />

            {/* Logo + title + contacts sit on the fading photo */}
            <div className="relative z-10 flex flex-col items-center px-5 pb-4 text-center">
              <VenueLogo
                alt={venueName}
                width={128}
                height={128}
                className="h-[6.5rem] w-[6.5rem] rounded-full object-cover shadow-[0_14px_36px_rgba(0,0,0,0.5)] ring-[3px] ring-brass/85"
                priority
              />
              <h1 className="mt-2.5 font-display text-[1.65rem] font-semibold leading-tight tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.8)]">
                {venueName}
              </h1>
              <p className="mt-0.5 text-[0.8125rem] font-medium text-white/85 drop-shadow-[0_1px_10px_rgba(0,0,0,0.7)]">
                {t("homeTagline")}
              </p>
              <VenueContactIcons className="mt-3.5" />
            </div>

            <div className="relative z-10 shrink-0 px-5 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-0.5">
              {guestActions("stage")}
            </div>
          </div>
        </header>
      ) : (
        <header className="relative overflow-hidden border-b border-white/5 px-5 pb-5 pt-6">
          <div className="absolute inset-0 bg-gradient-to-b from-[#141c18] to-transparent" />
          <div className="relative animate-rise">
            <div className="relative flex items-center justify-between gap-3">
              <LanguageSwitcher className="z-10 shrink-0 [&_select]:h-8 [&_select]:py-0" />
              <QikTikLogo className="z-10 !h-7 !w-auto !rounded-md !p-0" />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <VenueLogo
                alt={venueName}
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-brass/45"
                priority
              />
              <div className="min-w-0">
                <h1 className="truncate font-display text-xl font-semibold text-ink">
                  {venueName}
                </h1>
                <VenueContactIcons className="mt-2" />
              </div>
            </div>
            <div className="mt-5">{guestActions("compact")}</div>
            {!comingSoon ? (
              <input
                type="search"
                placeholder={t("search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-ink placeholder:text-ink-soft/50 outline-none focus:border-brass/40"
              />
            ) : null}
          </div>
        </header>
      )}

      {!menuOpen ? null : comingSoon ? (
        <section className="flex flex-col items-center px-5 py-16 text-center">
          <p className="font-display text-2xl font-semibold text-ink animate-rise">
            {tMenu("comingSoon")}
          </p>
          <p className="mt-3 max-w-sm text-sm text-ink-soft/65 animate-rise">
            {tMenu("comingSoonBody")}
          </p>
        </section>
      ) : (
        <>
          {categories.length > 0 ? (
            <div className="sticky top-0 z-30 border-b border-white/5 bg-[#0c110f]/90 px-4 py-3 backdrop-blur-md">
              <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((cat) => {
                  const on = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
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
                  {current && current.items.length > 0 && (
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
          ) : null}

          <section className="flex flex-col gap-2.5 px-4 py-5">
            {sections.map((section) => (
              <div key={section.id} className="space-y-2.5">
                <h2 className="pt-1 font-display text-xl font-semibold text-ink animate-rise">
                  {section.name}
                </h2>
                {section.items.map((item) => (
                  <article
                    key={item.id}
                    className="guest-panel flex gap-3 rounded-2xl p-3"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white/5">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-ink">{item.name}</h3>
                      {item.description ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft/65">
                          {item.description}
                        </p>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span
                          className={`font-display text-lg font-semibold ${
                            item.available ? "text-brass" : "text-ink-soft/40"
                          }`}
                        >
                          {formatPrice(item.price)}
                        </span>
                        {!item.available ? (
                          <span className="rounded-lg border border-alert/25 bg-alert/10 px-2.5 py-1.5 text-[11px] font-semibold text-alert">
                            {tMenu("soldOut")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ))}
            {(categories.length === 0 ||
              sections.every((s) => s.items.length === 0)) && (
              <p className="py-10 text-center text-sm text-ink-soft/50">—</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
