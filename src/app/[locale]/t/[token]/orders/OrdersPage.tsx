"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { BottomNav } from "@/components/BottomNav";
import { OrderProgressBar } from "@/components/OrderProgressBar";
import { QikTikLogo } from "@/components/QikTikLogo";
import { formatPrice } from "@/lib/utils";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import { useCart } from "@/components/CartProvider";
import { useGuestAuth } from "@/components/GuestAuthProvider";

type Props = {
  locale: string;
  token: string;
};

type OrderItem = {
  id: string;
  name: string;
  status: string;
  quantity: number;
  notes?: string | null;
  takeaway?: boolean;
};

type Order = {
  id: string;
  orderNumber: number;
  subtotal: string;
  status: string;
  submittedAt?: string;
  items: OrderItem[];
};

type OrdersPayload = {
  table: { number: number; section: string };
  sessionId: string | null;
  sessionStatus: string | null;
  guestName: string | null;
  tabBalance: string;
  paidTotal: string;
  orders: Order[];
};

function collectReadyIds(orders: Order[]) {
  const ids = new Set<string>();
  for (const order of orders) {
    for (const item of order.items) {
      if (item.status === "READY") ids.add(item.id);
    }
  }
  return ids;
}

function notifyBrowser(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: "qiktik-pickup-ready" });
  } catch {
    /* ignore unsupported environments */
  }
}

function formatTime(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function OrdersPage({ locale, token }: Props) {
  const t = useTranslations("order");
  const tPay = useTranslations("payment");
  const tCommon = useTranslations("common");
  const { count, clear } = useCart();
  const { refreshStatus, clearLocalAuth, guestName: authGuestName } = useGuestAuth();
  const [data, setData] = useState<OrdersPayload | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<"cash" | "card" | "leave" | "pickup" | null>(null);
  const [paidThanks, setPaidThanks] = useState(false);
  const [leftThanks, setLeftThanks] = useState(false);
  const [tipMode, setTipMode] = useState<"none" | "percent" | "amount">("percent");
  const [tipPercent, setTipPercent] = useState("10");
  const [tipFixed, setTipFixed] = useState("");
  const [pickupDraft, setPickupDraft] = useState("");
  const [pickupReadyFlash, setPickupReadyFlash] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string | null>(null);
  const lastSessionId = useRef<string | null>(null);
  const knownReadyIds = useRef<Set<string>>(new Set());
  const readyHydrated = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const guestNameRef = useRef<string | null>(null);
  const tableNumberRef = useRef<number | null>(null);
  const pickupPrefillDone = useRef(false);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2800);
  }

  const flashRef = useRef(flash);
  flashRef.current = flash;

  const announceReady = useCallback(
    (payload: OrdersPayload) => {
      const nextReady = collectReadyIds(payload.orders);
      if (!readyHydrated.current) {
        knownReadyIds.current = nextReady;
        readyHydrated.current = true;
        if (nextReady.size > 0) setPickupReadyFlash(true);
        return;
      }
      let newlyReady = false;
      for (const id of nextReady) {
        if (!knownReadyIds.current.has(id)) newlyReady = true;
      }
      knownReadyIds.current = nextReady;
      if (nextReady.size === 0) {
        setPickupReadyFlash(false);
        return;
      }
      setPickupReadyFlash(true);
      if (!newlyReady) return;
      const namePart = payload.guestName
        ? t("readyMessageNamed", { name: payload.guestName })
        : "";
      const body = t("readyMessage", {
        table: String(payload.table.number),
        name: namePart,
      });
      notifyBrowser(t("readyTitle"), body);
      flashRef.current(t("readyTitle"));
    },
    [t]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/tables/${token}/orders?locale=${locale}`);
      if (!res.ok) return;
      const next = (await res.json()) as OrdersPayload;
      const hadSession = Boolean(lastSessionId.current);
      lastSessionId.current = next.sessionId;
      sessionIdRef.current = next.sessionId;
      guestNameRef.current = next.guestName;
      tableNumberRef.current = next.table.number;
      setData(next);
      if (next.guestName) {
        setPickupDraft(next.guestName);
        pickupPrefillDone.current = true;
      } else if (authGuestName && !pickupPrefillDone.current) {
        setPickupDraft(authGuestName);
        pickupPrefillDone.current = true;
      }
      announceReady(next);
      if (hadSession && !next.sessionId) {
        clear();
        clearLocalAuth();
        void refreshStatus();
        knownReadyIds.current = new Set();
        readyHydrated.current = false;
        pickupPrefillDone.current = false;
        setPickupReadyFlash(false);
      }
    } catch {
      /* ignore transient network */
    }
  }, [token, locale, clear, clearLocalAuth, refreshStatus, announceReady, authGuestName]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load]);

  useLiveEvents((event, payload) => {
    if (
      event === "order:item:status" ||
      event === "order:new" ||
      event === "payment:completed" ||
      event === "session:updated"
    ) {
      if (event === "order:item:status" && payload && typeof payload === "object") {
        const p = payload as {
          status?: string;
          sessionId?: string;
          guestName?: string | null;
          tableNumber?: number;
        };
        if (
          p.status === "READY" &&
          sessionIdRef.current &&
          p.sessionId === sessionIdRef.current
        ) {
          setPickupReadyFlash(true);
          const who = p.guestName || guestNameRef.current;
          const namePart = who ? t("readyMessageNamed", { name: who }) : "";
          const body = t("readyMessage", {
            table: String(p.tableNumber ?? tableNumberRef.current ?? ""),
            name: namePart,
          });
          notifyBrowser(t("readyTitle"), body);
        }
      }
      load();
    }
  });

  async function savePickupName() {
    const name = pickupDraft.trim();
    if (!name || !data?.sessionId) return;
    setBusy("pickup");
    try {
      const res = await fetch(`/api/v1/tables/${token}/pickup-name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        flash("!");
        return;
      }
      flash(t("pickupNameSaved"));
      void refreshStatus();
      await load();
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          setNotifPermission(perm);
        }
      }
    } finally {
      setBusy(null);
    }
  }

  async function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  }

  function resolveTip(due: number) {
    if (tipMode === "percent") {
      const pct = Math.max(0, parseFloat(tipPercent || "0") || 0);
      return Math.round(((due * pct) / 100) * 100) / 100;
    }
    if (tipMode === "amount") {
      return Math.max(0, parseFloat(tipFixed || "0") || 0);
    }
    return 0;
  }

  async function callWaiter() {
    const res = await fetch(`/api/v1/tables/${token}/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "WAITER_CALLED" }),
    });
    flash(res.ok ? t("waiterComing") : "!");
  }

  /** Cash: notify waiter — table shows bill requested (purple) + tip if chosen */
  async function payCash() {
    setBusy("cash");
    try {
      const due = data ? parseFloat(data.tabBalance) : 0;
      const tipAmount = resolveTip(due).toFixed(2);
      const res = await fetch(`/api/v1/tables/${token}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "BILL_REQUESTED",
          payWith: "cash",
          tipAmount,
        }),
      });
      if (!res.ok) {
        flash("!");
        return;
      }
      // Banner below shows cashBillRequested once after reload — no extra toast
      await load();
    } finally {
      setBusy(null);
    }
  }

  /** Card: pay full remaining tab (+ tip) and close session */
  async function payCard() {
    setBusy("card");
    try {
      const due = data ? parseFloat(data.tabBalance) : 0;
      const tipAmount = resolveTip(due).toFixed(2);
      const res = await fetch(`/api/v1/tables/${token}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipAmount }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        flash(
          body?.error?.code === "PARTY_SIZE_REQUIRED"
            ? t("payFailPartySize")
            : (body?.error?.message as string) || "!"
        );
        return;
      }
      if (body.closed) {
        setPaidThanks(true);
        clear();
        clearLocalAuth();
        void refreshStatus();
        await load();
      } else if (body.clientSecret) {
        flash(tPay("cardPending"));
      } else {
        flash(tPay("thankYou"));
        await load();
      }
    } finally {
      setBusy(null);
    }
  }

  /** End visit when nothing is owed */
  async function leaveTable() {
    const due = data ? parseFloat(data.tabBalance) : 0;
    if (!data?.sessionId || due > 0) return;
    setBusy("leave");
    try {
      const res = await fetch(`/api/v1/tables/${token}/close`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        flash(
          body?.error?.code === "PARTY_SIZE_REQUIRED"
            ? t("leaveFailPartySize")
            : t("leaveFail")
        );
        await load();
        return;
      }
      clear();
      clearLocalAuth();
      void refreshStatus();
      setLeftThanks(true);
    } finally {
      setBusy(null);
    }
  }

  const currentOrders = data?.orders ?? [];
  const hasAny = currentOrders.length > 0;
  const tabDue = data ? parseFloat(data.tabBalance) : 0;
  const tipValue = resolveTip(tabDue);
  const payTotal = tabDue + tipValue;
  const billRequested = data?.sessionStatus === "BILL_REQUESTED";
  const canPay = tabDue > 0 && !!data?.sessionId;
  const canLeave = !!data?.sessionId && tabDue <= 0;
  const hasReadyItems = currentOrders.some((o) =>
    o.items.some((i) => i.status === "READY")
  );
  const showReadyPopup = pickupReadyFlash;
  const showReadyBanner = !pickupReadyFlash && hasReadyItems;
  const pickupName = data?.guestName?.trim() || "";
  const canEditPickup = Boolean(data?.sessionId);

  if (paidThanks || leftThanks) {
    return (
      <div className="guest-shell relative flex min-h-dvh flex-col items-center justify-center px-6 pb-24">
        <QikTikLogo className="absolute top-3 right-5 z-10" />
        <div className="guest-panel w-full max-w-md rounded-3xl p-6 text-center animate-rise">
          <p className="font-display text-3xl font-semibold text-ink">
            {leftThanks ? t("leaveThanks") : tPay("thankYou")}
          </p>
          <p className="mt-2 text-sm text-ink-soft/60">{tPay("sessionClosed")}</p>
          <Link href={`/${locale}/t/${token}`} className="btn-primary mt-6 inline-flex w-full">
            {tPay("scanAgain")}
          </Link>
        </div>
        <BottomNav locale={locale} tableToken={token} cartCount={0} active="orders" />
      </div>
    );
  }

  return (
    <div className="guest-shell pb-24">
      <header className="px-5 pb-2 pt-6 animate-rise">
        <div className="relative flex items-start gap-3 pr-28">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-brass/80">
              {tCommon("table")} {data?.table.number ?? "—"}
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-ink">
              {tCommon("orders")}
            </h1>
            {pickupName ? (
              <p className="mt-1 text-sm font-medium text-ink-soft">
                {t("pickupName")}: <span className="text-brass">{pickupName}</span>
              </p>
            ) : null}
            {currentOrders.length > 0 && (
              <p className="mt-1 text-sm font-medium text-ready">
                {currentOrders.length} · {t("sent")}
              </p>
            )}
          </div>
          <QikTikLogo className="absolute right-0 top-1" />
        </div>
      </header>

      {showReadyPopup && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="orders-ready-title"
          aria-describedby="orders-ready-body"
          className="animate-guest-alert-backdrop fixed inset-0 z-50 flex items-center justify-center p-5"
          onClick={() => setPickupReadyFlash(false)}
        >
          <button
            type="button"
            className="animate-guest-alert-flash w-full max-w-lg rounded-3xl border-4 border-[#9fe3bf] bg-[#1f9a5a] px-6 py-10 text-center shadow-[0_0_60px_rgba(61,200,120,0.65)] outline-none focus-visible:ring-4 focus-visible:ring-[#c8f5da]"
            onClick={(e) => {
              e.stopPropagation();
              setPickupReadyFlash(false);
            }}
          >
            <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-[#d8ffe9]">
              {t("readyStatus")}
            </p>
            <h2
              id="orders-ready-title"
              className="mt-4 font-display text-4xl font-extrabold leading-tight text-white sm:text-5xl"
            >
              {t("readyTitle")}
            </h2>
            <p
              id="orders-ready-body"
              className="mt-4 text-xl font-bold leading-snug text-[#eafff3] sm:text-2xl"
            >
              {t("readyMessage", {
                table: String(data?.table.number ?? "—"),
                name: pickupName ? t("readyMessageNamed", { name: pickupName }) : "",
              })}
            </p>
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[#c8f5da]/90">
              {tCommon("close")}
            </p>
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 px-4 pt-4">
        {showReadyBanner && (
          <div className="rounded-2xl border-2 border-ready/50 bg-ready/15 px-4 py-4 text-center">
            <p className="font-display text-2xl font-semibold text-ready">{t("readyTitle")}</p>
            <p className="mt-1 text-sm font-medium text-ink">
              {t("readyMessage", {
                table: String(data?.table.number ?? "—"),
                name: pickupName
                  ? t("readyMessageNamed", { name: pickupName })
                  : "",
              })}
            </p>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ready/80">
              {t("readyStatus")}
            </p>
          </div>
        )}

        {canEditPickup && (
          <div
            className={`guest-panel rounded-2xl p-4 ${
              !pickupName ? "border border-brass/30" : ""
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/55">
              {t("pickupName")}
            </p>
            {!pickupName && (
              <p className="mt-1 text-sm font-semibold text-brass">{t("pickupNameMissing")}</p>
            )}
            <p className="mt-1 text-xs text-ink-soft/55">{t("pickupNameHint")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="text"
                value={pickupDraft}
                onChange={(e) => setPickupDraft(e.target.value.slice(0, 80))}
                placeholder={t("pickupNamePlaceholder")}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                autoComplete="name"
              />
              <button
                type="button"
                disabled={busy !== null || !pickupDraft.trim()}
                onClick={savePickupName}
                className="rounded-xl border border-brass/35 bg-brass/10 px-3 py-2 text-xs font-bold text-brass disabled:opacity-40"
              >
                {busy === "pickup" ? "…" : t("pickupNameSave")}
              </button>
            </div>
            {notifPermission === "default" && (
                <button
                  type="button"
                  onClick={enableNotifications}
                  className="mt-2 text-xs font-semibold text-brass underline-offset-2 hover:underline"
                >
                  {t("enableNotifications")}
                </button>
              )}
          </div>
        )}

        {!hasAny ? (
          <div className="guest-panel rounded-2xl px-4 py-12 text-center">
            <p className="font-display text-xl text-ink-soft/60">{t("empty")}</p>
            <p className="mt-2 text-sm text-ink-soft/40">{t("emptyHint")}</p>
            {canLeave && (
              <p className="mt-3 text-xs text-ink-soft/50">{t("leaveTableHint")}</p>
            )}
          </div>
        ) : null}

        {currentOrders.map((order, oi) => (
          <section
            key={order.id}
            className="space-y-2 animate-rise"
            style={{ animationDelay: `${oi * 50}ms` }}
          >
            <div className="flex items-end justify-between gap-2 px-1">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">
                  {t("orderLabel")} #{order.orderNumber}
                </h2>
                <p className="text-xs text-ink-soft/50">
                  {formatTime(order.submittedAt)} · {order.status.replaceAll("_", " ")}
                </p>
              </div>
              <span className="font-display font-semibold text-brass">
                {formatPrice(order.subtotal)}
              </span>
            </div>
            {order.items.map((item) => (
              <OrderProgressBar
                key={item.id}
                name={item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name}
                status={item.status}
                notes={item.notes}
                takeaway={item.takeaway}
              />
            ))}
          </section>
        ))}

        {data && (currentOrders.length > 0 || tabDue > 0) && (
          <div className="guest-panel space-y-2 rounded-2xl p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft/70">{t("tabUnpaid")}</span>
              <span className="font-display font-semibold text-brass">
                {formatPrice(tabDue)}
              </span>
            </div>
            <div className="flex justify-between border-t border-white/5 pt-2">
              <span className="text-ink-soft/70">{t("paidSession")}</span>
              <span className="font-medium text-ink">
                {formatPrice(parseFloat(data.paidTotal))}
              </span>
            </div>
          </div>
        )}

        {billRequested && (
          <p className="rounded-xl border border-[#6b4d88]/40 bg-[#4a3560]/40 px-3 py-2.5 text-center text-sm font-semibold text-[#d4c4ef]">
            {t("cashBillRequested")}
          </p>
        )}

        {msg && (
          <p className="rounded-xl border border-ready/30 bg-ready/10 px-3 py-2 text-center text-sm font-semibold text-ready">
            {msg}
          </p>
        )}

        <Link href={`/${locale}/t/${token}`} className="btn-ghost w-full">
          {t("orderMore")}
        </Link>

        {canPay && (
          <div className="space-y-3">
            <p className="px-1 text-sm font-semibold text-ink-soft">{tPay("title")}</p>

            <div className="guest-panel space-y-3 rounded-2xl p-4">
              <p className="text-xs font-semibold text-ink-soft">{tPay("tip")}</p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["none", tPay("tipNone")],
                    ["percent", tPay("tipPercent")],
                    ["amount", tPay("tipFixed")],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setTipMode(mode);
                      if (mode === "percent" && !tipPercent) setTipPercent("10");
                    }}
                    className={`rounded-xl px-2 py-2.5 text-sm font-semibold transition ${
                      tipMode === mode
                        ? "border border-brass/50 bg-brass/20 text-brass"
                        : "border border-white/10 bg-white/[0.04] text-ink-soft"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tipMode === "percent" && (
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    inputMode="decimal"
                    value={tipPercent}
                    onChange={(e) => setTipPercent(e.target.value)}
                    placeholder={tPay("tipPercentPlaceholder")}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pe-10 ps-3 text-ink outline-none focus:border-brass/40"
                  />
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-soft/50">
                    %
                  </span>
                </div>
              )}

              {tipMode === "amount" && (
                <div className="relative">
                  <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-brass">
                    ₪
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    inputMode="decimal"
                    value={tipFixed}
                    onChange={(e) => setTipFixed(e.target.value)}
                    placeholder={tPay("tipAmountPlaceholder")}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pe-3 ps-8 text-ink outline-none focus:border-brass/40"
                  />
                </div>
              )}

              <div className="flex justify-between border-t border-white/5 pt-2 text-sm">
                <span className="text-ink-soft/70">{tPay("tip")}</span>
                <span className="font-medium text-ink">{formatPrice(tipValue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-ink-soft">{tPay("totalWithTip")}</span>
                <span className="font-display text-lg font-semibold text-brass">
                  {formatPrice(payTotal)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={payCash}
              disabled={busy !== null || billRequested}
              className="btn-ghost w-full disabled:opacity-50"
            >
              {busy === "cash"
                ? "…"
                : billRequested
                  ? t("requestBill")
                  : `${t("payCash")} — ${formatPrice(tabDue)}`}
            </button>
            <button
              type="button"
              onClick={payCard}
              disabled={busy !== null}
              className="btn-primary w-full disabled:opacity-50"
            >
              {busy === "card" ? "…" : `${t("payCard")} — ${formatPrice(payTotal)}`}
            </button>
          </div>
        )}

        {canLeave && (
          <div className="space-y-2">
            {hasAny && (
              <p className="px-1 text-center text-xs text-ink-soft/50">{t("leaveTableHint")}</p>
            )}
            <button
              type="button"
              onClick={leaveTable}
              disabled={busy !== null}
              className="btn-ghost w-full disabled:opacity-50"
            >
              {busy === "leave" ? "…" : t("leaveTable")}
            </button>
          </div>
        )}

        <button type="button" onClick={callWaiter} className="btn-ghost w-full">
          {t("callWaiter")}
        </button>
      </div>

      <BottomNav locale={locale} tableToken={token} cartCount={count} active="orders" />
    </div>
  );
}
