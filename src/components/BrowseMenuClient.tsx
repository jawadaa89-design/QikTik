"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { venueCallWaiterPath, venuePickupPath } from "@/lib/venue-paths";
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
  /** Landing first — menu items expand below Call waiter after guest taps Menu. */
  const [menuOpen, setMenuOpen] = useState(false);
  const menuSectionRef = useRef<HTMLDivElement | null>(null);

  function toggleMenu() {
    setMenuOpen((open) => {
      const next = !open;
      if (next) {
        // Wait for menu DOM, then scroll it into view under the buttons
        window.setTimeout(() => {
          menuSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 80);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
        document
          .querySelector(".venue-theme")
          ?.scrollTo({ top: 0, behavior: "smooth" });
        document
          .querySelector("[data-qiktik-scroll]")
          ?.scrollTo({ top: 0, behavior: "smooth" });
      }
      return next;
    });
  }

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

  const stageBtn =
    "inline-flex w-full min-h-0 flex-1 items-center justify-center gap-2.5 rounded-2xl px-4 text-base font-semibold transition disabled:opacity-55";
  const stageOutlineBtn = `${stageBtn} border border-white/20 bg-transparent text-ink hover:bg-white/[0.04]`;

  function guestActions(variant: "stage" | "compact") {
    const stage = variant === "stage";
    return (
      <div
        className={
          stage
            ? "flex h-full min-h-0 w-full flex-1 flex-col gap-2.5"
            : "space-y-2.5"
        }
      >
        <button
          type="button"
          onClick={toggleMenu}
          aria-expanded={menuOpen}
          className={
            stage
              ? `${stageBtn} bg-brass font-bold text-[#0c100e] shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:brightness-105`
              : `guest-panel inline-flex w-full items-center justify-center rounded-2xl px-4 py-3.5 text-center transition ${
                  menuOpen ? "border-brass/45 bg-brass/15" : "hover:border-brass/35"
                }`
          }
        >
          {stage ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
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
                ? stageOutlineBtn
                : "btn-primary inline-flex w-full flex-col items-center justify-center gap-0.5 px-4 py-3.5 text-center"
            }
          >
            {stage ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="text-brass">
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
                  ? stageOutlineBtn
                  : "btn-primary inline-flex w-full items-center justify-center px-4 py-3 text-sm font-bold"
              }
            >
              {tMenu("orderAtTable")}
            </button>
          ) : (
            <form
              onSubmit={onOrderAtTable}
              className="guest-panel flex min-h-0 w-full flex-1 flex-col justify-center space-y-3 rounded-2xl border border-brass/25 p-4"
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
          <Link
            href={venueCallWaiterPath(venueSlug, locale)}
            className={
              stage
                ? stageOutlineBtn
                : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-alert/40 bg-alert/15 px-4 py-3 text-sm font-bold text-alert transition hover:bg-alert/25"
            }
          >
            <CallWaiterBellIcon
              size={22}
              className={stage ? "text-brass" : undefined}
            />
            {tPickup("callWaiter")}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`guest-shell ${
        menuOpen
          ? "pb-4"
          : "flex min-h-0 flex-1 flex-col overflow-hidden pb-0"
      }`}
    >
      {/* Stage landing always stays; menu opens below Call waiter */}
      <header
        className={`relative isolate animate-rise overflow-hidden bg-[#141414] ${
          menuOpen
            ? "min-h-[var(--app-height,100svh)]"
            : "flex h-full min-h-0 flex-1 flex-col"
        }`}
      >
        <div
          className={`relative z-10 flex flex-col ${
            menuOpen ? "min-h-[var(--app-height,100svh)]" : "min-h-0 flex-1"
          }`}
        >
          {/* Top ~40% — cafe photo fitted to this band only */}
          <div className="relative flex min-h-0 basis-0 flex-[2] flex-col overflow-hidden">
            <Image
              src={heroSrc}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/40" />
            <div className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-4 pt-2">
              <LanguageSwitcher className="shrink-0 [&_select]:h-8 [&_select]:border-white/20 [&_select]:bg-black/40 [&_select]:py-0 [&_select]:backdrop-blur-sm" />
              <QikTikLogo className="!h-6 !w-auto !rounded-md !bg-black/30 !p-1 !backdrop-blur-sm" />
            </div>
          </div>

          {/* Bottom ~60% — dark sheet; logo half overlaps the photo */}
          <div className="relative z-10 -mt-4 flex min-h-0 basis-0 flex-[3] flex-col rounded-t-[1.75rem] bg-[#141414] px-5 pb-2 pt-0 shadow-[0_-20px_40px_rgba(0,0,0,0.45)]">
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/25" />

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="-mt-[4.75rem] flex shrink-0 flex-col items-center text-center">
                <VenueLogo
                  alt={venueName}
                  width={176}
                  height={176}
                  className="relative z-20 h-[9.5rem] w-[9.5rem] rounded-full object-cover shadow-[0_16px_40px_rgba(0,0,0,0.55)] ring-[3px] ring-brass/85 ring-offset-2 ring-offset-[#141414]"
                  priority
                />
                <h1 className="mt-2 font-display text-[1.6rem] font-semibold leading-tight tracking-tight text-ink">
                  {venueName}
                </h1>
                <p className="mt-0.5 text-sm font-medium text-ink-soft/70">
                  {t("homeTagline")}
                </p>
                <VenueContactIcons className="mt-2" />
              </div>

              <div className="mx-auto mb-2 mt-2 h-px w-full max-w-[11rem] shrink-0 bg-white/12" />

              {/* Same CTA size whether menu is open or closed; menu scrolls in below */}
              <div className="flex min-h-0 w-full flex-1 flex-col pb-1">
                {guestActions("stage")}
              </div>
            </div>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div
          ref={menuSectionRef}
          className="border-t border-white/10 bg-[#0c110f]"
        >
          {comingSoon ? (
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
              <div className="px-4 pt-4">
                <input
                  type="search"
                  placeholder={t("search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-ink placeholder:text-ink-soft/50 outline-none focus:border-brass/40"
                />
              </div>

              {categories.length > 0 ? (
                <div className="sticky top-0 z-30 border-b border-white/5 bg-[#0c110f]/95 px-4 py-3 backdrop-blur-md">
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
                                item.available
                                  ? "text-brass"
                                  : "text-ink-soft/40"
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
      ) : null}
    </div>
  );
}
