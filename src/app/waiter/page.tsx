"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import { formatPrice } from "@/lib/utils";
import {
  StaffLanguageSwitcher,
  useStaffLocale,
} from "@/components/StaffLanguageSwitcher";
import { QikTikLogo } from "@/components/QikTikLogo";
import { FeatureDisabled } from "@/components/FeatureDisabled";
import { useFeatures } from "@/components/FeaturesProvider";
import {
  PickupCallWaiterAlert,
  playStaffCallBeep,
  vibrateStaffCall,
} from "@/components/PickupCallWaiterAlert";

type PickupCallWaiterAlertState = {
  id: string;
  customerName: string;
  orderRef: string | null;
  comment?: string | null;
};

type Section = "INSIDE" | "OUTSIDE" | "TERRACE" | "ALL";
type Panel = "main" | "cash" | "card" | "add" | "history" | "closeConfirm";

type FloorTable = {
  id: string;
  number: number;
  section: string;
  status: string;
  sessionId: string | null;
  guestName: string | null;
  partySize: number | null;
  needsPartySize: boolean;
  partySizeAlert: boolean;
  requestedTip: string | null;
  tabBalance: string;
  hasReady: boolean;
  waiterCalled: boolean;
  billRequested: boolean;
  alertCount: number;
};

type TableDetail = {
  table: { id: string; number: number; section: string; status: string };
  session: {
    id: string;
    status: string;
    guestName: string | null;
    guestPhone?: string | null;
    partySize: number | null;
    needsPartySize: boolean;
    requestedTip: string | null;
    tipSpecified?: boolean;
    tabBalance: string;
    paidTotal: string;
    orders: {
      id: string;
      orderNumber: number;
      status: string;
      subtotal: string;
      items: {
        id: string;
        name: string;
        quantity: number;
        status: string;
        notes: string | null;
        takeaway?: boolean;
      }[];
    }[];
  } | null;
};

type BillHistory = {
  id: string;
  guestName: string | null;
  guestPhone: string | null;
  partySize: number | null;
  openedAt: string;
  closedAt: string;
  orderTotal: string;
  paidTotal: string;
  tipTotal: string;
  payments: {
    id: string;
    method: string;
    amount: string;
    tipAmount: string | null;
    paidAt: string;
  }[];
  orders: {
    id: string;
    orderNumber: number;
    status: string;
    paymentMode: string;
    subtotal: string;
    items: {
      id: string;
      name: string;
      quantity: number;
      unitPrice: string;
      notes: string | null;
    }[];
  }[];
};

type MenuItem = {
  id: string;
  name: string;
  price: string;
  available: boolean;
};

type DraftLine = {
  quantity: number;
  free: boolean;
  takeaway: boolean;
  /** Empty = menu price; set when waiter overrides */
  customPrice: string;
};

type MenuCategory = {
  id: string;
  name: string;
  parentId?: string | null;
  items: MenuItem[];
  children?: MenuCategory[];
};

function nestMenuCategories(flat: MenuCategory[]): MenuCategory[] {
  const parents = flat
    .filter((c) => !c.parentId)
    .map((c) => ({
      ...c,
      children: flat.filter((child) => child.parentId === c.id),
    }));
  // Orphan subcategories (missing parent) still appear as top-level
  const parentIds = new Set(parents.map((p) => p.id));
  const orphans = flat.filter((c) => c.parentId && !parentIds.has(c.parentId));
  return [...parents, ...orphans];
}

const SECTION_IDS: Section[] = ["INSIDE", "OUTSIDE", "TERRACE", "ALL"];

function formatWhen(iso: string, locale: string) {
  const tag =
    locale === "he" ? "he-IL" : locale === "ar" ? "ar" : locale === "ru" ? "ru-RU" : "en-GB";
  try {
    return new Date(iso).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function tableTone(t: FloorTable) {
  // Strong, distinct floor colors — status should read at a glance
  if (t.billRequested) {
    return "bg-[#7c3aed] text-white border-2 border-[#c4b5fd] shadow-[0_0_0_1px_rgba(167,139,250,0.5)]";
  }
  if (t.waiterCalled) {
    return "bg-[#dc2626] text-white border-2 border-[#fecaca] animate-soft-pulse shadow-[0_0_18px_rgba(220,38,38,0.45)]";
  }
  if (t.hasReady) {
    return "bg-[#16a34a] text-white border-2 border-[#86efac] shadow-[0_0_14px_rgba(22,163,74,0.35)]";
  }
  if (t.partySizeAlert) {
    return "bg-[#c2410c] text-white border-2 border-[#fdba74] animate-soft-pulse shadow-[0_0_16px_rgba(194,65,12,0.4)]";
  }
  if (t.status === "ACTIVE") {
    return "bg-[#ca8a04] text-[#1a1408] border-2 border-[#fde047]";
  }
  return "bg-[#1a2220] text-ink-soft/70 border-2 border-white/10";
}

export default function WaiterPage() {
  const { locale, setStaffLocale, t, ready } = useStaffLocale();
  const { ready: featuresReady, hasFeature } = useFeatures();
  const [section, setSection] = useState<Section>("INSIDE");
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [selected, setSelected] = useState<TableDetail | null>(null);
  const [panel, setPanel] = useState<Panel>("main");
  const [received, setReceived] = useState("");
  const [cardRef, setCardRef] = useState("");
  const [tipAmount, setTipAmount] = useState("");
  const [tipPercent, setTipPercent] = useState("10");
  const [tipMode, setTipMode] = useState<"percent" | "amount">("percent");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [menuCategoryId, setMenuCategoryId] = useState("");
  const [menuSubId, setMenuSubId] = useState<string | "all">("all");
  const [menuSearch, setMenuSearch] = useState("");
  const [draft, setDraft] = useState<Record<string, DraftLine>>({});
  const [adminPassOpen, setAdminPassOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPassError, setAdminPassError] = useState<string | null>(null);
  const [history, setHistory] = useState<BillHistory[]>([]);
  const [historyBill, setHistoryBill] = useState<BillHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [manualNotes, setManualNotes] = useState("");
  const [partySizeDraft, setPartySizeDraft] = useState("");
  const [guestNameDraft, setGuestNameDraft] = useState("");
  const [pickupCallAlert, setPickupCallAlert] = useState<PickupCallWaiterAlertState | null>(
    null
  );
  const [pickupCallPulseKey, setPickupCallPulseKey] = useState(0);
  const pickupCallHideTimer = useRef<number | null>(null);

  const dismissPickupCallAlert = useCallback(() => {
    setPickupCallAlert(null);
    if (pickupCallHideTimer.current) {
      window.clearTimeout(pickupCallHideTimer.current);
      pickupCallHideTimer.current = null;
    }
  }, []);

  const showPickupCallAlert = useCallback((payload: PickupCallWaiterAlertState) => {
    setPickupCallAlert(payload);
    setPickupCallPulseKey((k) => k + 1);
    playStaffCallBeep();
    vibrateStaffCall();
    if (pickupCallHideTimer.current) window.clearTimeout(pickupCallHideTimer.current);
    pickupCallHideTimer.current = window.setTimeout(() => setPickupCallAlert(null), 20_000);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("section") as Section | null;
    if (s && SECTION_IDS.includes(s)) setSection(s);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/waiter/tables?section=${section}`);
      if (!res.ok) return;
      const data = await res.json();
      setTables(data.tables ?? []);
    } catch {
      // Ignore transient network errors (dev HMR / SSE reconnect)
    }
  }, [section]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    return () => {
      if (pickupCallHideTimer.current) window.clearTimeout(pickupCallHideTimer.current);
    };
  }, []);

  useLiveEvents((event, data) => {
    if (
      event === "order:new" ||
      event === "order:item:status" ||
      event === "session:updated" ||
      event === "payment:completed" ||
      event === "alert:new"
    ) {
      void load();
    }
    if (event === "pickup:call-waiter") {
      const payload = data as PickupCallWaiterAlertState | null;
      if (!payload?.id || !payload.customerName) return;
      showPickupCallAlert({
        id: payload.id,
        customerName: payload.customerName,
        orderRef: payload.orderRef ?? null,
        comment: payload.comment ?? null,
      });
    }
  });

  useEffect(() => {
    setMenu([]);
    if (selected) {
      void openTable(selected.table.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh labels on language change only
  }, [locale]);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  function resolveTip(due: number) {
    if (tipMode === "percent") {
      const pct = Math.max(0, parseFloat(tipPercent || "0") || 0);
      return Math.round(((due * pct) / 100) * 100) / 100;
    }
    return Math.max(0, parseFloat(tipAmount || "0") || 0);
  }

  async function openTable(id: string) {
    // Opening the table means the waiter responded — clear red "called" state
    setTables((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, waiterCalled: false, alertCount: Math.max(0, row.alertCount - 1) }
          : row
      )
    );
    void fetch(`/api/v1/waiter/alerts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: id, type: "WAITER_CALLED" }),
    }).catch(() => {});

    try {
      const res = await fetch(`/api/v1/waiter/tables/${id}?locale=${locale}`);
      if (res.ok) {
        const data = (await res.json()) as TableDetail;
        setSelected(data);
        setPartySizeDraft(
          data.session?.partySize != null ? String(data.session.partySize) : ""
        );
        setGuestNameDraft(data.session?.guestName ?? "");
        setPanel("main");
        setReceived("");
        setCardRef("");
        setTipAmount("");
        setTipPercent("10");
        setTipMode("percent");
        setDraft({});
        setManualNotes("");
        setHistory([]);
        setHistoryBill(null);
        void load();
      }
    } catch {
      /* transient network */
    }
  }

  async function refreshSelected() {
    if (!selected) return;
    await openTable(selected.table.id);
    load();
  }

  async function markServed(orderId: string, itemId: string) {
    await fetch(`/api/v1/kitchen/orders/${orderId}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SERVED" }),
    });
    refreshSelected();
  }

  async function printBill() {
    if (!selected?.session) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/v1/waiter/tables/${selected.table.id}/print-bill?locale=${locale}`,
        { method: "POST" }
      );
      if (!res.ok) {
        flash(t.toastPrintFail);
        return;
      }
      const data = await res.json();
      const w = window.open("", "_blank", "noopener,noreferrer,width=420,height=640");
      if (w && data.html) {
        w.document.open();
        w.document.write(data.html as string);
        w.document.close();
      }
      flash(data.edgeQueued ? t.toastPrintedEdge : t.toastPrinted);
      await refreshSelected();
    } finally {
      setBusy(false);
    }
  }

  async function openHistory() {
    if (!selected) return;
    setPanel("history");
    setHistoryBill(null);
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/v1/waiter/tables/${selected.table.id}/history?locale=${locale}`
      );
      if (res.ok) {
        const data = await res.json();
        setHistory(data.bills ?? []);
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveGuestName() {
    if (!selected?.session) return;
    const name = guestNameDraft.trim();
    if (!name) {
      flash(t.pickupNamePlaceholder);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/waiter/tables/${selected.table.id}/guest-name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestName: name }),
      });
      if (res.ok) {
        flash(t.pickupNameSaved);
        await openTable(selected.table.id);
        await load();
      } else {
        flash("!");
      }
    } finally {
      setBusy(false);
    }
  }

  async function savePartySize() {
    if (!selected?.session) return;
    const n = parseInt(partySizeDraft, 10);
    if (!Number.isFinite(n) || n < 1) {
      flash(t.partySizeRequired);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/waiter/tables/${selected.table.id}/party-size`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partySize: n }),
      });
      if (res.ok) {
        flash(t.partySizeSaved);
        await openTable(selected.table.id);
        load();
      }
    } finally {
      setBusy(false);
    }
  }

  function requirePartySizeOrFlash() {
    if (selected?.session?.needsPartySize) {
      flash(t.partySizeRequired);
      return false;
    }
    return true;
  }

  async function takeCash() {
    if (!selected?.session) return;
    if (!requirePartySizeOrFlash()) return;
    const amount = selected.session.tabBalance;
    const tipN = resolveTip(parseFloat(amount));
    const tip = tipN.toFixed(2);
    const due = parseFloat(amount) + tipN;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/waiter/tables/${selected.table.id}/cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          tipAmount: tip,
          received: received || String(due),
          closeSession: true,
        }),
      });
      if (res.ok) {
        flash(t.toastCash);
        setSelected(null);
        setPanel("main");
        setTipAmount("");
        setTipPercent("10");
        setTipMode("percent");
        load();
      } else {
        const body = await res.json().catch(() => null);
        if (body?.error?.code === "PARTY_SIZE_REQUIRED") flash(t.partySizeRequired);
      }
    } finally {
      setBusy(false);
    }
  }

  async function takeCard() {
    if (!selected?.session) return;
    if (!requirePartySizeOrFlash()) return;
    const amount = selected.session.tabBalance;
    const tip = resolveTip(parseFloat(amount)).toFixed(2);
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/waiter/tables/${selected.table.id}/card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          tipAmount: tip,
          closeSession: true,
          reference: cardRef || undefined,
        }),
      });
      if (res.ok) {
        flash(t.toastCard);
        setSelected(null);
        setPanel("main");
        setTipAmount("");
        setTipPercent("10");
        setTipMode("percent");
        load();
      } else {
        const body = await res.json().catch(() => null);
        if (body?.error?.code === "PARTY_SIZE_REQUIRED") flash(t.partySizeRequired);
      }
    } finally {
      setBusy(false);
    }
  }

  async function closeTable() {
    if (!selected) return;
    if (!requirePartySizeOrFlash()) {
      setPanel("main");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/waiter/tables/${selected.table.id}/close`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.error?.code === "PARTY_SIZE_REQUIRED") {
          flash(t.partySizeRequired);
          setPanel("main");
          return;
        }
        flash(t.partySizeRequired);
        return;
      }
      flash(t.toastClosed);
      setSelected(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function resetGuestPassword() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/v1/waiter/tables/${selected.table.id}/reset-passcode`,
        { method: "POST" }
      );
      if (res.ok) {
        flash(t.toastPasswordReset);
        setTables((prev) =>
          prev.map((row) =>
            row.id === selected.table.id
              ? { ...row, waiterCalled: false, alertCount: Math.max(0, row.alertCount - 1) }
              : row
          )
        );
        await refreshSelected();
        load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function openAddOrder() {
    setPanel("add");
    setMenuSearch("");
    setMenuSubId("all");
    const res = await fetch(`/api/v1/admin/menu?locale=${locale}`);
    if (res.ok) {
      const data = await res.json();
      const nested = nestMenuCategories(data.categories ?? []);
      setMenu(nested);
      setMenuCategoryId(nested[0]?.id ?? "");
    }
  }

  function findMenuPrice(itemId: string): string {
    for (const cat of menu) {
      const direct = cat.items.find((i) => i.id === itemId);
      if (direct) return direct.price;
      for (const child of cat.children ?? []) {
        const hit = child.items.find((i) => i.id === itemId);
        if (hit) return hit.price;
      }
    }
    return "";
  }

  function normalizePrice(value: string) {
    const n = parseFloat(value);
    if (Number.isNaN(n) || n < 0) return null;
    return n.toFixed(2);
  }

  function priceChanged(line: DraftLine, menuPrice: string) {
    if (line.free) return true;
    const custom = normalizePrice(line.customPrice);
    const original = normalizePrice(menuPrice);
    if (custom == null || original == null) return false;
    return custom !== original;
  }

  function bumpDraft(itemId: string, delta: number) {
    setDraft((prev) => {
      const next = { ...prev };
      const menuPrice = findMenuPrice(itemId);
      const cur = next[itemId] ?? {
        quantity: 0,
        free: false,
        takeaway: false,
        customPrice: menuPrice,
      };
      const q = cur.quantity + delta;
      if (q <= 0) delete next[itemId];
      else {
        next[itemId] = {
          ...cur,
          quantity: q,
          // Keep original price as default when first added
          customPrice: cur.customPrice.trim() !== "" ? cur.customPrice : menuPrice,
        };
      }
      return next;
    });
  }

  function setDraftFree(itemId: string, free: boolean) {
    setDraft((prev) => {
      const cur = prev[itemId];
      if (!cur) return prev;
      return {
        ...prev,
        [itemId]: {
          ...cur,
          free,
          customPrice: free ? "" : findMenuPrice(itemId) || cur.customPrice,
        },
      };
    });
  }

  function setDraftTakeaway(itemId: string, takeaway: boolean) {
    setDraft((prev) => {
      const cur = prev[itemId];
      if (!cur) return prev;
      return { ...prev, [itemId]: { ...cur, takeaway } };
    });
  }

  function setDraftCustomPrice(itemId: string, customPrice: string) {
    setDraft((prev) => {
      const cur = prev[itemId];
      if (!cur) return prev;
      return {
        ...prev,
        [itemId]: {
          ...cur,
          customPrice,
          free: false,
        },
      };
    });
  }

  function draftNeedsAdmin() {
    return Object.entries(draft).some(([id, line]) =>
      priceChanged(line, findMenuPrice(id))
    );
  }

  function buildOrderItems() {
    return Object.entries(draft).map(([menuItemId, line]) => {
      const menuPrice = findMenuPrice(menuItemId);
      const payload: {
        menuItemId: string;
        quantity: number;
        notes?: string;
        takeaway?: boolean;
        free?: boolean;
        unitPrice?: string;
      } = {
        menuItemId,
        quantity: line.quantity,
        notes: manualNotes.trim() || undefined,
        takeaway: line.takeaway || undefined,
      };
      if (line.free) {
        payload.free = true;
      } else if (priceChanged(line, menuPrice)) {
        const n = normalizePrice(line.customPrice);
        if (n != null) payload.unitPrice = n;
      }
      return payload;
    });
  }

  async function submitManualOrder(adminPass?: string) {
    if (!selected) return;
    const items = buildOrderItems();
    if (items.length === 0) return;

    for (const [id, line] of Object.entries(draft)) {
      if (!line.free && priceChanged(line, findMenuPrice(id))) {
        const n = normalizePrice(line.customPrice);
        if (n == null) {
          flash(t.itemCustomPrice);
          return;
        }
      }
    }

    if (draftNeedsAdmin() && !adminPass) {
      setAdminPassword("");
      setAdminPassError(null);
      setAdminPassOpen(true);
      return;
    }

    setBusy(true);
    setAdminPassError(null);
    try {
      const res = await fetch(`/api/v1/waiter/tables/${selected.table.id}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          items,
          guestName: guestNameDraft.trim() || undefined,
          adminPassword: adminPass || undefined,
        }),
      });
      if (res.ok) {
        flash(t.toastOrderSent);
        setDraft({});
        setManualNotes("");
        setAdminPassOpen(false);
        setAdminPassword("");
        setPanel("main");
        await refreshSelected();
      } else {
        const body = await res.json().catch(() => null);
        if (body?.error?.code === "ADMIN_PASSWORD_REQUIRED") {
          setAdminPassOpen(true);
          setAdminPassError(t.adminPasswordWrong);
        } else {
          flash(body?.error?.message ?? "!");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const billRequested =
    selected?.table.status === "BILL_REQUESTED" ||
    selected?.session?.status === "BILL_REQUESTED";
  const tabDue = selected?.session ? parseFloat(selected.session.tabBalance) : 0;
  const tipN = resolveTip(tabDue);
  const totalDue = tabDue + tipN;
  const draftCount = Object.values(draft).reduce((s, n) => s + n.quantity, 0);

  const activeMenuCategory =
    menu.find((c) => c.id === menuCategoryId) ?? menu[0] ?? null;
  const menuChildren = activeMenuCategory?.children ?? [];
  const visibleMenuItems = (() => {
    if (!activeMenuCategory) return [] as MenuItem[];
    const q = menuSearch.trim().toLowerCase();
    const match = (item: MenuItem) =>
      item.available &&
      (!q || item.name.toLowerCase().includes(q));

    if (q) {
      const fromParent = activeMenuCategory.items.filter(match);
      const fromChildren = menuChildren.flatMap((c) => c.items.filter(match));
      // When searching, also scan other categories for convenience
      const fromOthers = menu
        .filter((c) => c.id !== activeMenuCategory.id)
        .flatMap((c) => [
          ...c.items.filter(match),
          ...(c.children ?? []).flatMap((ch) => ch.items.filter(match)),
        ]);
      const seen = new Set<string>();
      return [...fromParent, ...fromChildren, ...fromOthers].filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    }

    if (menuChildren.length === 0) {
      return activeMenuCategory.items.filter(match);
    }

    const parentItems =
      menuSubId === "all" || menuSubId === activeMenuCategory.id
        ? activeMenuCategory.items.filter(match)
        : [];
    const childItems = menuChildren
      .filter((c) => menuSubId === "all" || menuSubId === c.id)
      .flatMap((c) => c.items.filter(match));
    return [...parentItems, ...childItems];
  })();

  if (!ready || !featuresReady) {
    return <div className="mx-auto min-h-dvh max-w-3xl" />;
  }

  if (!hasFeature("ordering")) {
    return (
      <FeatureDisabled
        title={t.featureDisabledTitle}
        body={t.featureDisabledBody}
        adminLabel="Admin"
      />
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-3xl">
      {pickupCallAlert && (
        <PickupCallWaiterAlert
          pulseKey={pickupCallPulseKey}
          badge={t.pickupCallWaiterBadge}
          title={t.pickupCallWaiterTitle}
          nameLabel={t.pickupCallWaiterName}
          name={pickupCallAlert.customerName}
          orderRefLabel={t.pickupCallWaiterOrderRef}
          orderRef={pickupCallAlert.orderRef}
          commentLabel={t.pickupCallWaiterComment}
          comment={pickupCallAlert.comment}
          dismissLabel={t.pickupCallWaiterDismiss}
          onDismiss={dismissPickupCallAlert}
        />
      )}
      <header className="border-b border-white/8 bg-[#0c110f]/90 px-4 py-4 backdrop-blur-md">
        <div className="relative flex items-start gap-3 pl-28 pr-28">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] text-brass/80">{t.floor}</p>
            <h1 className="font-display text-2xl font-semibold text-ink">{t.title}</h1>
          </div>
          <StaffLanguageSwitcher
            locale={locale}
            onChange={setStaffLocale}
            label={t.language}
            className="absolute left-0 top-1 z-10 shrink-0"
          />
          <QikTikLogo className="absolute right-0 top-1" />
        </div>
        {hasFeature("pickup") ? (
          <div className="mt-2">
            <a href="/pickup" className="text-xs font-semibold text-ink-soft/45 hover:text-brass">
              {t.linkPickup}
            </a>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {SECTION_IDS.map((id) => (
            <button
              key={id}
              onClick={() => {
                setSection(id);
                const url = new URL(window.location.href);
                url.searchParams.set("section", id);
                window.history.replaceState({}, "", url);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                section === id
                  ? "bg-brass text-[#0c100e]"
                  : "bg-white/[0.05] text-ink-soft"
              }`}
            >
              {t.sections[id]}
            </button>
          ))}
        </div>
      </header>

      {toast && (
        <div className="mx-4 mt-3 rounded-xl border border-ready/30 bg-ready/10 px-3 py-2 text-center text-sm font-semibold text-ready">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-4 gap-2.5 p-4 sm:grid-cols-6">
        {tables.map((ft) => (
          <button
            key={ft.id}
            onClick={() => openTable(ft.id)}
            className={`flex aspect-square flex-col items-center justify-center rounded-2xl p-1.5 text-center transition hover:scale-[1.02] ${tableTone(ft)}`}
          >
            <div className="font-display text-2xl font-semibold leading-none">{ft.number}</div>
            {ft.guestName ? (
              <div className="mt-1 line-clamp-2 w-full px-0.5 text-[9px] font-semibold leading-tight opacity-90">
                {ft.guestName}
              </div>
            ) : (
              <div className="mt-1 text-[10px] uppercase tracking-wide opacity-70">
                {ft.section.slice(0, 3)}
              </div>
            )}
            {ft.partySize != null ? (
              <div className="mt-0.5 text-[10px] font-bold opacity-90">×{ft.partySize}</div>
            ) : ft.partySizeAlert ? (
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide">
                {t.partySizeAlert}
              </div>
            ) : ft.needsPartySize ? (
              <div className="mt-0.5 text-[9px] font-semibold opacity-75">×?</div>
            ) : null}
            {parseFloat(ft.tabBalance) > 0 && (
              <div className="mt-0.5 text-[10px] font-bold">{formatPrice(ft.tabBalance)}</div>
            )}
            {ft.requestedTip != null && parseFloat(ft.requestedTip) > 0 && (
              <div className="mt-0.5 text-[9px] font-semibold opacity-80">
                +{formatPrice(ft.requestedTip)} tip
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="guest-panel mx-4 mb-6 rounded-2xl p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft/50">
          {t.legendTitle}
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 sm:gap-3">
          <div className="flex items-center gap-2 text-ink-soft">
            <span className="h-3.5 w-3.5 shrink-0 rounded-md border-2 border-white/10 bg-[#1a2220]" />
            {t.legendFree}
          </div>
          <div className="flex items-center gap-2 text-ink-soft">
            <span className="h-3.5 w-3.5 shrink-0 rounded-md border-2 border-[#fde047] bg-[#ca8a04]" />
            {t.legendActive}
          </div>
          <div className="flex items-center gap-2 text-ink-soft">
            <span className="h-3.5 w-3.5 shrink-0 rounded-md border-2 border-[#86efac] bg-[#16a34a]" />
            {t.legendReady}
          </div>
          <div className="flex items-center gap-2 text-ink-soft">
            <span className="h-3.5 w-3.5 shrink-0 rounded-md border-2 border-[#fecaca] bg-[#dc2626]" />
            {t.legendCall}
          </div>
          <div className="flex items-center gap-2 text-ink-soft">
            <span className="h-3.5 w-3.5 shrink-0 rounded-md border-2 border-[#c4b5fd] bg-[#7c3aed]" />
            {t.legendBill}
          </div>
          <div className="flex items-center gap-2 text-ink-soft">
            <span className="h-3.5 w-3.5 shrink-0 rounded-md border-2 border-[#fdba74] bg-[#c2410c]" />
            {t.legendParty}
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#121816] p-5 sm:rounded-3xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-brass/80">
                  {selected.table.section}
                  {billRequested ? ` · ${t.billTag}` : ""}
                </p>
                <h2 className="font-display text-2xl font-semibold text-ink">
                  {t.table} {selected.table.number}
                </h2>
                {selected.session?.guestName && (
                  <p className="mt-0.5 text-sm font-medium text-ink-soft">
                    {selected.session.guestName}
                    {selected.session.guestPhone
                      ? ` · ${selected.session.guestPhone}`
                      : ""}
                  </p>
                )}
                {selected.session?.requestedTip != null && (
                  <p className="mt-1 text-sm font-semibold text-brass">
                    {t.guestTip}: {formatPrice(selected.session.requestedTip)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-xl text-ink-soft"
              >
                ×
              </button>
            </div>

            {panel === "main" && (
              <>
                {selected.session ? (
                  <>
                    <div
                      className={`mt-4 rounded-2xl border px-4 py-3 ${
                        !selected.session.guestName
                          ? "border-brass/35 bg-brass/10"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/55">
                        {t.pickupName}
                      </p>
                      <p className="mt-1 text-xs text-ink-soft/55">{t.pickupNameHint}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input
                          type="text"
                          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-ink"
                          value={guestNameDraft}
                          onChange={(e) => setGuestNameDraft(e.target.value.slice(0, 80))}
                          placeholder={t.pickupNamePlaceholder}
                          autoComplete="name"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={saveGuestName}
                          className="rounded-xl border border-brass/35 bg-brass/10 px-3 py-2 text-xs font-bold text-brass disabled:opacity-40"
                        >
                          {t.pickupNameSave}
                        </button>
                      </div>
                    </div>

                    <div
                      className={`mt-4 rounded-2xl border px-4 py-3 ${
                        selected.session.needsPartySize
                          ? "border-alert/40 bg-alert/10"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/55">
                        {t.partySize}
                      </p>
                      {selected.session.needsPartySize && (
                        <p className="mt-1 text-sm font-semibold text-alert">{t.partySizeAlert}</p>
                      )}
                      <p className="mt-1 text-xs text-ink-soft/55">{t.partySizeHint}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          inputMode="numeric"
                          className="w-24 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-ink"
                          value={partySizeDraft}
                          onChange={(e) => setPartySizeDraft(e.target.value)}
                          placeholder=""
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={savePartySize}
                          className="rounded-xl border border-brass/35 bg-brass/10 px-3 py-2 text-xs font-bold text-brass disabled:opacity-40"
                        >
                          {t.partySizeSave}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-brass/25 bg-brass/10 px-4 py-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-ink-soft">{t.tabUnpaid}</span>
                        <span className="font-display text-xl font-semibold text-brass">
                          {formatPrice(selected.session.tabBalance)}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-ink-soft/60">
                        <span>{t.paid}</span>
                        <span>{formatPrice(selected.session.paidTotal)}</span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        disabled={busy || !selected.session}
                        onClick={printBill}
                        className="btn-ghost px-3 py-3"
                      >
                        {t.printBill}
                      </button>
                      <button disabled={busy} onClick={openAddOrder} className="btn-ghost px-3 py-3">
                        {t.addOrder}
                      </button>
                      <button
                        disabled={busy || tabDue <= 0}
                        onClick={() => {
                          const due = parseFloat(selected.session!.tabBalance);
                          const guestTip = selected.session!.requestedTip;
                          if (guestTip != null) {
                            setTipMode("amount");
                            setTipPercent("");
                            setTipAmount(guestTip);
                            setReceived(String(due + parseFloat(guestTip)));
                          } else {
                            const tip = Math.round(due * 0.1 * 100) / 100;
                            setTipMode("percent");
                            setTipPercent("10");
                            setTipAmount("");
                            setReceived(String(due + tip));
                          }
                          setPanel("cash");
                        }}
                        className="btn-primary px-3 py-3 disabled:opacity-40"
                      >
                        {t.payCash}
                      </button>
                      <button
                        disabled={busy || tabDue <= 0}
                        onClick={() => {
                          const guestTip = selected.session!.requestedTip;
                          setCardRef("");
                          if (guestTip != null) {
                            setTipMode("amount");
                            setTipPercent("");
                            setTipAmount(guestTip);
                          } else {
                            setTipMode("percent");
                            setTipPercent("10");
                            setTipAmount("");
                          }
                          setPanel("card");
                        }}
                        className="rounded-xl border border-brass/40 bg-brass/15 px-3 py-3 text-sm font-semibold text-brass disabled:opacity-40"
                      >
                        {t.payCard}
                      </button>
                      <button
                        disabled={busy}
                        onClick={resetGuestPassword}
                        className="btn-ghost col-span-2 px-3 py-3"
                        title={t.resetPasswordHint}
                      >
                        {t.resetPassword}
                      </button>
                      <p className="-mt-1 col-span-2 px-1 text-center text-[11px] text-ink-soft/45">
                        {t.resetPasswordHint}
                      </p>
                      <button
                        disabled={busy}
                        onClick={() => setPanel("closeConfirm")}
                        className="btn-ghost col-span-2 px-3 py-3 text-ink-soft"
                      >
                        {t.closeTable}
                      </button>
                      <button
                        disabled={busy}
                        onClick={openHistory}
                        className="btn-ghost col-span-2 px-3 py-3"
                      >
                        {t.billHistory}
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {selected.session.orders.map((order) => (
                        <div key={order.id} className="guest-panel rounded-2xl p-3">
                          <div className="mb-2 flex justify-between text-sm font-semibold text-ink">
                            <span>
                              {t.orderLabel} #{order.orderNumber}
                            </span>
                            <span className="text-brass">{formatPrice(order.subtotal)}</span>
                          </div>
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between border-t border-white/5 py-2 text-sm"
                            >
                              <div>
                                <p className="font-medium text-ink">
                                  {item.quantity > 1 ? `${item.quantity}× ` : ""}
                                  {item.name}
                                </p>
                                {item.takeaway ? (
                                  <p className="text-xs font-semibold text-brass">{t.takeaway}</p>
                                ) : null}
                                {item.notes ? (
                                  <p className="text-xs text-brass/80">{item.notes}</p>
                                ) : null}
                                <p className="text-[11px] uppercase tracking-wide text-ink-soft/40">
                                  {item.status}
                                </p>
                              </div>
                              {item.status === "READY" && (
                                <button
                                  onClick={() => markServed(order.id, item.id)}
                                  className="rounded-lg border border-ready/40 bg-ready/20 px-2.5 py-1 text-xs font-semibold text-ready"
                                >
                                  {t.served}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="mt-6 space-y-3 text-center">
                    <p className="text-ink-soft/50">{t.noSession}</p>
                    <button disabled={busy} onClick={openAddOrder} className="btn-primary w-full">
                      {t.startSession}
                    </button>
                    <button disabled={busy} onClick={openHistory} className="btn-ghost w-full">
                      {t.billHistory}
                    </button>
                  </div>
                )}
              </>
            )}

            {panel === "history" && (
              <div className="mt-4 space-y-3">
                <button
                  onClick={() => {
                    if (historyBill) {
                      setHistoryBill(null);
                    } else {
                      setPanel("main");
                    }
                  }}
                  className="text-sm font-semibold text-brass"
                >
                  ← {t.back}
                </button>
                <h3 className="font-display text-xl font-semibold text-ink">
                  {historyBill
                    ? `${t.closedAt} · ${formatWhen(historyBill.closedAt, locale)}`
                    : t.billHistory}
                </h3>

                {historyLoading && (
                  <p className="py-6 text-center text-sm text-ink-soft/50">…</p>
                )}

                {!historyLoading && !historyBill && history.length === 0 && (
                  <p className="py-6 text-center text-sm text-ink-soft/50">{t.noBillHistory}</p>
                )}

                {!historyLoading && !historyBill && (
                  <div className="space-y-2">
                    {history.map((bill) => (
                      <button
                        key={bill.id}
                        type="button"
                        onClick={() => setHistoryBill(bill)}
                        className="guest-panel flex w-full items-center justify-between rounded-2xl p-3 text-start transition hover:border-brass/30"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">
                            {formatWhen(bill.closedAt, locale)}
                          </p>
                          {bill.guestName ? (
                            <p className="truncate text-xs text-ink-soft/70">{bill.guestName}</p>
                          ) : null}
                          <p className="mt-0.5 text-[11px] text-ink-soft/40">
                            {[
                              bill.partySize != null ? `×${bill.partySize}` : null,
                              bill.payments
                                .map((p) =>
                                  p.method === "CASH" ? t.methodCash : t.methodCard
                                )
                                .join(" · ") || null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                        <div className="shrink-0 text-end">
                          <p className="font-display text-lg font-semibold text-brass">
                            {formatPrice(bill.paidTotal)}
                          </p>
                          <p className="text-[11px] font-semibold text-brass/70">{t.viewBill}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!historyLoading && historyBill && (
                  <div className="space-y-3">
                    {historyBill.guestName && (
                      <p className="text-sm text-ink-soft">
                        {historyBill.guestName}
                        {historyBill.guestPhone ? ` · ${historyBill.guestPhone}` : ""}
                      </p>
                    )}
                    {historyBill.partySize != null && (
                      <p className="text-sm text-ink-soft">
                        {t.partySize}:{" "}
                        <span className="font-semibold text-ink">{historyBill.partySize}</span>
                      </p>
                    )}
                    <div className="rounded-2xl border border-brass/25 bg-brass/10 px-4 py-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-soft">{t.paid}</span>
                        <span className="font-display text-lg font-semibold text-brass">
                          {formatPrice(historyBill.paidTotal)}
                        </span>
                      </div>
                      {parseFloat(historyBill.tipTotal) > 0 && (
                        <div className="mt-1 flex justify-between text-xs text-ink-soft/60">
                          <span>{t.tipTotal}</span>
                          <span>{formatPrice(historyBill.tipTotal)}</span>
                        </div>
                      )}
                      {historyBill.payments.map((p) => (
                        <div
                          key={p.id}
                          className="mt-1 flex justify-between text-xs text-ink-soft/60"
                        >
                          <span>
                            {p.method === "CASH" ? t.methodCash : t.methodCard}
                          </span>
                          <span>{formatPrice(p.amount)}</span>
                        </div>
                      ))}
                    </div>

                    {historyBill.orders.map((order) => (
                      <div key={order.id} className="guest-panel rounded-2xl p-3">
                        <div className="mb-2 flex justify-between text-sm font-semibold text-ink">
                          <span>
                            {t.orderLabel} #{order.orderNumber}
                          </span>
                          <span className="text-brass">{formatPrice(order.subtotal)}</span>
                        </div>
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between border-t border-white/5 py-2 text-sm"
                          >
                            <div>
                              <p className="font-medium text-ink">
                                {item.quantity > 1 ? `${item.quantity}× ` : ""}
                                {item.name}
                              </p>
                              {item.notes ? (
                                <p className="text-xs text-brass/80">{item.notes}</p>
                              ) : null}
                            </div>
                            <span className="text-ink-soft/60">
                              {formatPrice(
                                (parseFloat(item.unitPrice) * item.quantity).toFixed(2)
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {panel === "closeConfirm" && (
              <div className="mt-4 space-y-3">
                <button
                  onClick={() => setPanel("main")}
                  className="text-sm font-semibold text-brass"
                >
                  ← {t.back}
                </button>
                <h3 className="font-display text-xl font-semibold text-ink">
                  {t.confirmCloseTitle}
                </h3>
                <p className="text-sm text-ink-soft/80">{t.confirmCloseBody}</p>
                {tabDue > 0 && (
                  <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm font-semibold text-alert">
                    {t.confirmCloseUnpaid.replace("{amount}", formatPrice(tabDue))}
                  </p>
                )}
                <button
                  disabled={busy}
                  onClick={closeTable}
                  className="w-full rounded-xl border border-alert/40 bg-alert/15 px-3 py-3 text-sm font-semibold text-alert disabled:opacity-40"
                >
                  {t.confirmCloseYes}
                </button>
                <button
                  disabled={busy}
                  onClick={() => setPanel("main")}
                  className="btn-ghost w-full px-3 py-3"
                >
                  {t.confirmCloseNo}
                </button>
              </div>
            )}

            {panel === "cash" && selected.session && (
              <div className="mt-4 space-y-3">
                <button
                  onClick={() => setPanel("main")}
                  className="text-sm font-semibold text-brass"
                >
                  ← {t.back}
                </button>
                <h3 className="font-display text-xl font-semibold text-ink">{t.cashPayment}</h3>
                <p className="text-sm text-ink-soft">
                  {t.due} {formatPrice(selected.session.tabBalance)}
                </p>
                <label className="block">
                  <span className="text-xs font-semibold text-ink-soft">
                    {selected.session.requestedTip != null ? t.guestTip : t.tip}
                  </span>
                  {selected.session.requestedTip != null && (
                    <p className="mt-1 text-xs text-brass/80">{t.guestTipHint}</p>
                  )}
                  {selected.session.requestedTip == null && (
                    <p className="mt-1 text-xs text-ink-soft/50">{t.askTipHint}</p>
                  )}
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTipMode("percent")}
                      className={`rounded-xl px-2 py-2 text-sm font-semibold ${
                        tipMode === "percent"
                          ? "border border-brass/50 bg-brass/20 text-brass"
                          : "border border-white/10 bg-white/[0.04] text-ink-soft"
                      }`}
                    >
                      {t.tipPercent}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipMode("amount")}
                      className={`rounded-xl px-2 py-2 text-sm font-semibold ${
                        tipMode === "amount"
                          ? "border border-brass/50 bg-brass/20 text-brass"
                          : "border border-white/10 bg-white/[0.04] text-ink-soft"
                      }`}
                    >
                      {t.tipFixed}
                    </button>
                  </div>
                  {tipMode === "percent" ? (
                    <div className="relative mt-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={tipPercent}
                        onChange={(e) => {
                          setTipPercent(e.target.value);
                          const next =
                            Math.round(
                              ((tabDue * (parseFloat(e.target.value || "0") || 0)) / 100) * 100
                            ) / 100;
                          setReceived(String(tabDue + next));
                        }}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pe-10 ps-3 text-ink"
                        placeholder={t.tipPercentPlaceholder}
                      />
                      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-soft/50">
                        %
                      </span>
                    </div>
                  ) : (
                    <div className="relative mt-1.5">
                      <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-brass">
                        ₪
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={tipAmount}
                        onChange={(e) => {
                          setTipAmount(e.target.value);
                          setReceived(
                            String(tabDue + (parseFloat(e.target.value || "0") || 0))
                          );
                        }}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pe-3 ps-8 text-ink"
                        placeholder={t.tipAmountPlaceholder}
                      />
                    </div>
                  )}
                </label>
                <p className="text-sm font-semibold text-brass">
                  {t.totalWithTip} {formatPrice(totalDue)}
                </p>
                <input
                  type="number"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink"
                  placeholder={t.amountReceived}
                />
                <p className="text-sm text-ink-soft/50">
                  {t.change}{" "}
                  {formatPrice(Math.max(0, parseFloat(received || "0") - totalDue))}
                </p>
                <button disabled={busy} onClick={takeCash} className="btn-primary w-full">
                  {t.confirmCash}
                </button>
              </div>
            )}

            {panel === "card" && selected.session && (
              <div className="mt-4 space-y-3">
                <button
                  onClick={() => setPanel("main")}
                  className="text-sm font-semibold text-brass"
                >
                  ← {t.back}
                </button>
                <h3 className="font-display text-xl font-semibold text-ink">{t.cardPayment}</h3>
                <p className="text-sm text-ink-soft">
                  {t.cardHint} {formatPrice(selected.session.tabBalance)}
                </p>
                <label className="block">
                  <span className="text-xs font-semibold text-ink-soft">
                    {selected.session.requestedTip != null ? t.guestTip : t.tip}
                  </span>
                  {selected.session.requestedTip != null && (
                    <p className="mt-1 text-xs text-brass/80">{t.guestTipHint}</p>
                  )}
                  {selected.session.requestedTip == null && (
                    <p className="mt-1 text-xs text-ink-soft/50">{t.askTipHint}</p>
                  )}
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTipMode("percent")}
                      className={`rounded-xl px-2 py-2 text-sm font-semibold ${
                        tipMode === "percent"
                          ? "border border-brass/50 bg-brass/20 text-brass"
                          : "border border-white/10 bg-white/[0.04] text-ink-soft"
                      }`}
                    >
                      {t.tipPercent}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipMode("amount")}
                      className={`rounded-xl px-2 py-2 text-sm font-semibold ${
                        tipMode === "amount"
                          ? "border border-brass/50 bg-brass/20 text-brass"
                          : "border border-white/10 bg-white/[0.04] text-ink-soft"
                      }`}
                    >
                      {t.tipFixed}
                    </button>
                  </div>
                  {tipMode === "percent" ? (
                    <div className="relative mt-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={tipPercent}
                        onChange={(e) => setTipPercent(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pe-10 ps-3 text-ink"
                        placeholder={t.tipPercentPlaceholder}
                      />
                      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-soft/50">
                        %
                      </span>
                    </div>
                  ) : (
                    <div className="relative mt-1.5">
                      <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-brass">
                        ₪
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={tipAmount}
                        onChange={(e) => setTipAmount(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pe-3 ps-8 text-ink"
                        placeholder={t.tipAmountPlaceholder}
                      />
                    </div>
                  )}
                </label>
                <p className="text-sm font-semibold text-brass">
                  {t.totalWithTip} {formatPrice(totalDue)}
                </p>
                <input
                  type="text"
                  value={cardRef}
                  onChange={(e) => setCardRef(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink"
                  placeholder={t.cardRef}
                />
                <button disabled={busy} onClick={takeCard} className="btn-primary w-full">
                  {t.confirmCard}
                </button>
              </div>
            )}

            {panel === "add" && (
              <div className="mt-4 space-y-3">
                <button
                  onClick={() => setPanel("main")}
                  className="text-sm font-semibold text-brass"
                >
                  ← {t.back}
                </button>
                <h3 className="font-display text-xl font-semibold text-ink">{t.addOrder}</h3>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft/55">
                    {t.pickupName}
                  </p>
                  <input
                    value={guestNameDraft}
                    onChange={(e) => setGuestNameDraft(e.target.value.slice(0, 80))}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink"
                    placeholder={t.pickupNamePlaceholder}
                    autoComplete="name"
                  />
                </div>
                <input
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value.slice(0, 200))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink"
                  placeholder={t.kitchenNote}
                />
                <input
                  type="search"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/40"
                  placeholder={t.menuSearch}
                />

                {menu.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {menu.map((cat) => {
                      const on = (activeMenuCategory?.id ?? "") === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setMenuCategoryId(cat.id);
                            setMenuSubId("all");
                          }}
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
                )}

                {!menuSearch.trim() && menuChildren.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button
                      type="button"
                      onClick={() => setMenuSubId("all")}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        menuSubId === "all"
                          ? "border border-brass/50 bg-brass/20 text-brass"
                          : "border border-white/10 bg-white/[0.03] text-ink-soft/70"
                      }`}
                    >
                      {t.menuAll}
                    </button>
                    {menuChildren.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setMenuSubId(sub.id)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          menuSubId === sub.id
                            ? "border border-brass/50 bg-brass/20 text-brass"
                            : "border border-white/10 bg-white/[0.03] text-ink-soft/70"
                        }`}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="max-h-[42dvh] space-y-1.5 overflow-y-auto">
                  {visibleMenuItems.length === 0 ? (
                    <p className="py-8 text-center text-sm text-ink-soft/45">—</p>
                  ) : (
                    visibleMenuItems.map((item) => {
                      const line = draft[item.id];
                      const qty = line?.quantity ?? 0;
                      const isFree = Boolean(line?.free);
                      const custom = line?.customPrice ?? item.price;
                      const changed =
                        Boolean(line) && priceChanged(line!, item.price) && !isFree;
                      return (
                        <div
                          key={item.id}
                          className="guest-panel space-y-2 rounded-xl px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                              <p className="text-xs text-brass">
                                {isFree ? (
                                  <span className="font-semibold text-ready">{t.itemFree}</span>
                                ) : changed ? (
                                  <>
                                    <span className="text-ink-soft/40 line-through">
                                      {formatPrice(item.price)}
                                    </span>{" "}
                                    <span className="font-semibold">
                                      {formatPrice(custom)}
                                    </span>
                                  </>
                                ) : (
                                  formatPrice(item.price)
                                )}
                              </p>
                            </div>
                            <button
                              onClick={() => bumpDraft(item.id, -1)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]"
                            >
                              −
                            </button>
                            <span className="min-w-5 text-center text-sm font-semibold">
                              {qty}
                            </span>
                            <button
                              onClick={() => bumpDraft(item.id, 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]"
                            >
                              +
                            </button>
                          </div>
                          {qty > 0 && (
                            <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-2">
                              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-semibold text-ink-soft">
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 accent-[#f97316]"
                                  checked={Boolean(line?.takeaway)}
                                  onChange={(e) =>
                                    setDraftTakeaway(item.id, e.target.checked)
                                  }
                                />
                                {t.takeaway}
                              </label>
                              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-semibold text-ink-soft">
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 accent-[#f97316]"
                                  checked={isFree}
                                  onChange={(e) => setDraftFree(item.id, e.target.checked)}
                                />
                                {t.itemFree}
                              </label>
                              <label className="flex min-w-0 flex-1 basis-full items-center gap-1.5 text-xs text-ink-soft sm:basis-auto">
                                <span className="shrink-0 font-semibold">{t.itemCustomPrice}</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  inputMode="decimal"
                                  disabled={isFree}
                                  value={isFree ? "" : custom}
                                  onChange={(e) =>
                                    setDraftCustomPrice(item.id, e.target.value)
                                  }
                                  placeholder={item.price}
                                  className="w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-ink outline-none focus:border-brass/40 disabled:opacity-40"
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <button
                  disabled={busy || draftCount === 0}
                  onClick={() => void submitManualOrder()}
                  className="btn-primary w-full disabled:opacity-40"
                >
                  {t.sendKitchen} ({draftCount})
                </button>

                {adminPassOpen && (
                  <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
                    <button
                      type="button"
                      aria-label={t.back}
                      className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                      onClick={() => {
                        if (!busy) {
                          setAdminPassOpen(false);
                          setAdminPassword("");
                          setAdminPassError(null);
                        }
                      }}
                    />
                    <div className="relative w-full max-w-md space-y-3 rounded-t-3xl border border-white/10 bg-[#121816] p-5 sm:rounded-3xl">
                      <h4 className="font-display text-xl font-semibold text-ink">
                        {t.adminPasswordTitle}
                      </h4>
                      <p className="text-sm text-ink-soft/70">{t.adminPasswordHint}</p>
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => {
                          setAdminPassword(e.target.value);
                          setAdminPassError(null);
                        }}
                        placeholder={t.adminPassword}
                        autoFocus
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink outline-none focus:border-brass/40"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void submitManualOrder(adminPassword);
                          }
                        }}
                      />
                      {adminPassError && (
                        <p className="text-sm font-semibold text-alert">{adminPassError}</p>
                      )}
                      <button
                        disabled={busy || !adminPassword.trim()}
                        onClick={() => void submitManualOrder(adminPassword)}
                        className="btn-primary w-full disabled:opacity-40"
                      >
                        {t.confirmWithPassword}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
