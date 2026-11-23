"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import {
  StaffLanguageSwitcher,
  useStaffLocale,
} from "@/components/StaffLanguageSwitcher";
import { QikTikLogo } from "@/components/QikTikLogo";
import { FeatureDisabled } from "@/components/FeatureDisabled";
import { useFeatures } from "@/components/FeaturesProvider";

type Station = "MAIN_KITCHEN" | "MEAT_KITCHEN" | "BAR" | "ALL";
type ColumnKey = "RECEIVED" | "PREPARING" | "READY";

type KitchenItem = {
  id: string;
  menuItemId?: string;
  name: string;
  quantity: number;
  notes: string | null;
  takeaway: boolean;
  route: string;
  status: string;
};

type KitchenOrder = {
  id: string;
  tableNumber: number;
  section: string;
  orderNumber: number;
  ageMinutes: number;
  status: string;
  items: KitchenItem[];
};

type FlatRow = { order: KitchenOrder; item: KitchenItem };

type ItemGroup = {
  key: string;
  name: string;
  notes: string | null;
  takeaway: boolean;
  status: string;
  quantity: number;
  ageMinutes: number;
  tables: number[];
  members: FlatRow[];
};

type DragPayload = {
  members: { orderId: string; itemId: string }[];
  fromStatus: string;
};

const STATION_IDS: Station[] = ["MAIN_KITCHEN", "MEAT_KITCHEN", "BAR", "ALL"];
const COLUMN_KEYS: ColumnKey[] = ["RECEIVED", "PREPARING", "READY"];
const GROUP_KEY = "qiktik-kitchen-group-similar";

const COLUMN_ACCENT: Record<ColumnKey, string> = {
  RECEIVED: "border-[#f97316]",
  PREPARING: "border-[#6a9bb8]",
  READY: "border-[#3d8f68]",
};

function nextStatus(status: string): string | null {
  if (status === "RECEIVED") return "PREPARING";
  if (status === "PREPARING") return "READY";
  if (status === "READY") return "SERVED";
  return null;
}

function groupKey(item: KitchenItem) {
  const id = item.menuItemId ?? item.name;
  return `${id}::${(item.notes ?? "").trim()}::${item.takeaway ? "1" : "0"}`;
}

function buildGroups(rows: FlatRow[], groupSimilar: boolean): ItemGroup[] {
  if (!groupSimilar) {
    return rows.map(({ order, item }) => ({
      key: item.id,
      name: item.name,
      notes: item.notes,
      takeaway: Boolean(item.takeaway),
      status: item.status,
      quantity: item.quantity,
      ageMinutes: order.ageMinutes,
      tables: [order.tableNumber],
      members: [{ order, item }],
    }));
  }

  const map = new Map<string, ItemGroup>();
  for (const row of rows) {
    const key = groupKey(row.item);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        name: row.item.name,
        notes: row.item.notes,
        takeaway: Boolean(row.item.takeaway),
        status: row.item.status,
        quantity: row.item.quantity,
        ageMinutes: row.order.ageMinutes,
        tables: [row.order.tableNumber],
        members: [row],
      });
      continue;
    }
    existing.quantity += row.item.quantity;
    existing.ageMinutes = Math.max(existing.ageMinutes, row.order.ageMinutes);
    existing.members.push(row);
    if (!existing.tables.includes(row.order.tableNumber)) {
      existing.tables.push(row.order.tableNumber);
    }
  }
  return [...map.values()]
    .map((g) => ({
      ...g,
      tables: [...g.tables].sort((a, b) => a - b),
    }))
    .sort((a, b) => b.ageMinutes - a.ageMinutes);
}

export default function KitchenPage() {
  const { locale, setStaffLocale, kt, ready } = useStaffLocale();
  const { ready: featuresReady, hasFeature } = useFeatures();
  const [station, setStation] = useState<Station>("MAIN_KITCHEN");
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupSimilar, setGroupSimilar] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<ColumnKey | null>(null);
  const dragPayload = useRef<DragPayload | null>(null);
  const didDrag = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("station") as Station | null;
    if (s && STATION_IDS.includes(s)) setStation(s);
    try {
      setGroupSimilar(localStorage.getItem(GROUP_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ locale });
      if (station !== "ALL") params.set("station", station);
      const res = await fetch(`/api/v1/kitchen/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
      }
    } catch {
      // Ignore transient network errors (dev HMR / SSE reconnect)
    } finally {
      setLoading(false);
    }
  }, [station, locale]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  useLiveEvents((event) => {
    if (
      event === "order:new" ||
      event === "order:item:status" ||
      event === "session:updated" ||
      event === "payment:completed"
    ) {
      load();
    }
  });

  function toggleGroupSimilar() {
    setGroupSimilar((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(GROUP_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  async function setItemsStatus(
    members: { orderId: string; itemId: string }[],
    status: string
  ) {
    const ids = new Set(members.map((m) => m.itemId));

    if (status === "SERVED") {
      setOrders((prev) =>
        prev
          .map((order) => ({
            ...order,
            items: order.items.filter((i) => !ids.has(i.id)),
          }))
          .filter((order) => order.items.length > 0)
      );
    } else {
      setOrders((prev) =>
        prev.map((order) => ({
          ...order,
          items: order.items.map((i) =>
            ids.has(i.id) ? { ...i, status } : i
          ),
        }))
      );
    }

    await Promise.all(
      members.map((m) =>
        fetch(`/api/v1/kitchen/orders/${m.orderId}/items/${m.itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        })
      )
    );
    load();
  }

  async function bumpGroup(group: ItemGroup) {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    const next = nextStatus(group.status);
    if (!next) return;
    await setItemsStatus(
      group.members.map((m) => ({
        orderId: m.order.id,
        itemId: m.item.id,
      })),
      next
    );
  }

  function onCardDragStart(e: DragEvent, group: ItemGroup) {
    didDrag.current = false;
    dragPayload.current = {
      members: group.members.map((m) => ({
        orderId: m.order.id,
        itemId: m.item.id,
      })),
      fromStatus: group.status,
    };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify(dragPayload.current)
    );
    e.dataTransfer.setData("text/plain", group.key);
  }

  function onCardDragEnd() {
    dragPayload.current = null;
    setDragOverCol(null);
  }

  function onColumnDragOver(e: DragEvent, col: ColumnKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== col) setDragOverCol(col);
  }

  function onColumnDragLeave(e: DragEvent, col: ColumnKey) {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    if (dragOverCol === col) setDragOverCol(null);
  }

  async function onColumnDrop(e: DragEvent, col: ColumnKey) {
    e.preventDefault();
    setDragOverCol(null);

    let payload = dragPayload.current;
    if (!payload) {
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (raw) payload = JSON.parse(raw) as DragPayload;
      } catch {
        payload = null;
      }
    }
    if (!payload) return;
    if (payload.fromStatus === col) return;

    didDrag.current = true;
    dragPayload.current = null;
    await setItemsStatus(payload.members, col);
  }

  const columnGroups = useMemo(() => {
    const result: Record<ColumnKey, ItemGroup[]> = {
      RECEIVED: [],
      PREPARING: [],
      READY: [],
    };
    for (const key of COLUMN_KEYS) {
      const rows: FlatRow[] = [];
      for (const order of orders) {
        for (const item of order.items) {
          if (item.status === key) rows.push({ order, item });
        }
      }
      result[key] = buildGroups(rows, groupSimilar);
    }
    return result;
  }, [orders, groupSimilar]);

  if (!ready || !featuresReady) {
    return <div className="min-h-dvh" />;
  }

  if (!hasFeature("ordering")) {
    return (
      <FeatureDisabled
        title={kt.featureDisabledTitle}
        body={kt.featureDisabledBody}
        adminLabel="Admin"
      />
    );
  }

  return (
    <div className={`min-h-dvh${locale === "he" ? " staff-locale-he" : ""}`}>
      <header className="relative flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-5 ps-28 pe-28">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f97316]">{kt.floor}</p>
          <h1
            className={`text-3xl font-bold tracking-tight text-white md:text-4xl ${
              locale === "he" ? "" : "font-display"
            }`}
          >
            {kt.title}
          </h1>
          <p className="mt-1 text-sm text-white/55">{kt.dragHint}</p>
        </div>
        <StaffLanguageSwitcher
          locale={locale}
          onChange={setStaffLocale}
          label={kt.language}
          className="absolute start-4 top-5 z-10"
        />
        <QikTikLogo className="absolute end-4 top-5" />
        {hasFeature("pickup") ? (
          <a
            href="/pickup"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/85 hover:border-[#f97316]/40 hover:text-[#f97316]"
          >
            {kt.linkPickup}
          </a>
        ) : null}
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/85">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#f97316]"
            checked={groupSimilar}
            onChange={toggleGroupSimilar}
          />
          {kt.groupSimilar}
        </label>
        <div className="flex flex-wrap gap-2">
          {STATION_IDS.map((id) => (
            <button
              key={id}
              onClick={() => {
                setStation(id);
                const url = new URL(window.location.href);
                url.searchParams.set("station", id);
                window.history.replaceState({}, "", url);
              }}
              className={`rounded-lg px-3.5 py-2 text-base font-bold transition ${
                station === id
                  ? "bg-[#f97316] text-[#0d1c1a]"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {kt.stations[id]}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <p className="p-8 text-white/40">{kt.loading}</p>
      ) : (
        <div className="grid gap-3 p-3 md:grid-cols-3">
          {COLUMN_KEYS.map((key) => {
            const groups = columnGroups[key];
            const isOver = dragOverCol === key;
            return (
              <section
                key={key}
                onDragOver={(e) => onColumnDragOver(e, key)}
                onDragLeave={(e) => onColumnDragLeave(e, key)}
                onDrop={(e) => onColumnDrop(e, key)}
                className={`rounded-2xl border-t-2 ${COLUMN_ACCENT[key]} bg-white/[0.04] backdrop-blur transition ${
                  isOver
                    ? "bg-white/[0.09] ring-2 ring-[#f97316]/60 ring-offset-2 ring-offset-[#0a1412]"
                    : ""
                }`}
              >
                <h2 className="border-b border-white/10 px-3 py-3.5 text-lg font-bold uppercase tracking-[0.12em] text-white md:text-xl">
                  {kt.columns[key]}
                  <span className="ms-2.5 rounded-md bg-[#f97316]/20 px-2 py-0.5 text-base font-extrabold text-[#fb923c]">
                    {groupSimilar
                      ? groups.reduce((s, g) => s + g.quantity, 0)
                      : groups.length}
                  </span>
                </h2>
                <div className="flex min-h-[12rem] max-h-[calc(100dvh-8rem)] flex-col gap-2 overflow-y-auto p-2">
                  {groups.length === 0 && (
                    <p className="px-2 py-10 text-center text-sm text-white/25">
                      {isOver ? "↓" : kt.empty}
                    </p>
                  )}
                  {groups.map((group) => {
                    const next = nextStatus(group.status);
                    const isTakeaway = group.takeaway;
                    return (
                      <button
                        key={group.key}
                        type="button"
                        draggable
                        onDragStart={(e) => onCardDragStart(e, group)}
                        onDrag={() => {
                          didDrag.current = true;
                        }}
                        onDragEnd={onCardDragEnd}
                        onClick={() => bumpGroup(group)}
                        className={
                          isTakeaway
                            ? "cursor-grab rounded-xl border-2 border-[#f97316] bg-[#f97316]/15 p-3 text-start shadow-[inset_4px_0_0_0_#f97316] transition hover:bg-[#f97316]/25 active:cursor-grabbing"
                            : "cursor-grab rounded-xl border border-white/5 bg-[#0a1412]/80 p-3 text-start transition hover:border-[#f97316]/50 active:cursor-grabbing"
                        }
                      >
                        {isTakeaway ? (
                          <div className="mb-2 flex items-center justify-center rounded-lg bg-[#f97316] px-2 py-1.5 text-center text-sm font-black uppercase tracking-[0.18em] text-[#0c100e]">
                            {kt.takeaway}
                          </div>
                        ) : null}
                        <div className="flex items-start justify-between gap-2 text-[11px] text-white/40">
                          {groupSimilar ? (
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">
                                {kt.tables}
                              </p>
                              <p className="mt-0.5 text-sm font-bold leading-snug text-white">
                                {group.tables.map((n) => `T${n}`).join(" · ")}
                              </p>
                            </div>
                          ) : (
                            <span>
                              {group.members[0].order.section} · T
                              {group.members[0].order.tableNumber} · #
                              {group.members[0].order.orderNumber}
                            </span>
                          )}
                          <span
                            className={
                              group.ageMinutes >= 8
                                ? "shrink-0 font-semibold text-[#e08a8a] animate-soft-pulse"
                                : "shrink-0"
                            }
                          >
                            {group.ageMinutes}m
                          </span>
                        </div>
                        <p className="mt-1.5 text-lg font-bold leading-snug text-white">
                          <span className="me-1.5 inline-block min-w-[1.75rem] rounded-md bg-white/10 px-1.5 text-center text-[#fb923c]">
                            {group.quantity}×
                          </span>
                          {group.name}
                        </p>
                        {group.notes && (
                          <p className="mt-1 text-sm font-medium text-[#e4d4a8]">{group.notes}</p>
                        )}
                        <p className="mt-2 text-[10px] uppercase tracking-wider text-white/30">
                          {kt.tapNext}{" "}
                          {next === "SERVED"
                            ? kt.done
                            : next
                              ? kt.columns[next]
                              : kt.done}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
