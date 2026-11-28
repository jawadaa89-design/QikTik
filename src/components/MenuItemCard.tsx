"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { cn, formatPrice } from "@/lib/utils";
import type { MenuItem, MenuItemAdditional } from "@/lib/demo-data";
import { useGuestAuth } from "@/components/GuestAuthProvider";
import { useFeatures } from "@/components/FeaturesProvider";
import { MenuItemDetailSheet } from "@/components/MenuItemDetailSheet";

type Props = {
  item: MenuItem;
  onAdd: (
    item: MenuItem,
    options?: {
      notes?: string;
      quantity?: number;
      takeaway?: boolean;
      additionals?: MenuItemAdditional[];
    }
  ) => void;
  index?: number;
};

export function MenuItemCard({ item, onAdd, index = 0 }: Props) {
  const t = useTranslations("menu");
  const tCommon = useTranslations("common");
  const { ensureUnlocked } = useGuestAuth();
  const { hasFeature } = useFeatures();
  const searchParams = useSearchParams();
  // Pickup digital menu uses ?browse=1 — view only, no table ordering.
  const ordering = hasFeature("ordering") && searchParams.get("browse") !== "1";
  const [open, setOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [takeaway, setTakeaway] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const additionals = item.additionals ?? [];

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const selectedList = useMemo(
    () => additionals.filter((a) => selected[a.id]),
    [additionals, selected]
  );

  const unitTotal =
    parseFloat(item.price) +
    selectedList.reduce((s, a) => s + parseFloat(a.price), 0);

  function openSheet() {
    if (!ordering) {
      setBrowseOpen(true);
      return;
    }
    if (!ensureUnlocked()) return;
    setNotes("");
    setQuantity(1);
    setTakeaway(false);
    setSelected({});
    setOpen(true);
  }

  function confirmAdd() {
    if (!ensureUnlocked()) {
      setOpen(false);
      return;
    }
    onAdd(item, {
      quantity,
      notes: notes.trim() || undefined,
      takeaway,
      additionals: selectedList,
    });
    setOpen(false);
  }

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={openSheet}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openSheet();
          }
        }}
        className={cn(
          "guest-panel group flex cursor-pointer gap-3 rounded-2xl p-3 transition animate-rise",
          item.available ? "hover:border-brass/30" : "opacity-70"
        )}
        style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      >
        <div className="relative h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-xl bg-[#1a2420]">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              sizes="76px"
              className={cn(
                "object-cover transition duration-300",
                item.available ? "group-hover:scale-105" : "grayscale"
              )}
            />
          ) : (
            <div className="flex h-full w-full items-end p-2">
              <span className="font-display text-2xl font-semibold text-brass/80">
                {item.name.trim().charAt(0)}
              </span>
            </div>
          )}
          {!item.available && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45">
              <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-alert">
                {t("notAvailableShort")}
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div>
            <h3
              className={cn(
                "font-semibold leading-snug",
                item.available
                  ? "text-ink"
                  : "text-ink-soft/70 line-through decoration-ink-soft/30"
              )}
            >
              {item.name}
            </h3>
            {item.description ? (
              <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-ink-soft/70">
                {item.description}
              </p>
            ) : null}
            {!item.available && (
              <p className="mt-1 text-xs font-semibold text-alert/90">{t("notAvailable")}</p>
            )}
            {additionals.length > 0 && (
              <p className="mt-1 text-[11px] text-ink-soft/45">
                {t("extrasAvailable", { count: additionals.length })}
              </p>
            )}
            {item.allergens.length > 0 && (
              <p className="mt-1 text-[11px] uppercase tracking-wide text-ink-soft/40">
                {t("allergens")}: {item.allergens.join(", ")}
              </p>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span
              className={cn(
                "font-display text-lg font-semibold",
                item.available ? "text-brass" : "text-ink-soft/40"
              )}
            >
              {formatPrice(item.price)}
            </span>
            {item.available ? (
              ordering ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openSheet();
                  }}
                  className="rounded-lg border border-brass/40 bg-brass/10 px-3 py-1.5 text-xs font-semibold text-brass-glow transition hover:bg-brass hover:text-[#0c100e]"
                >
                  {tCommon("add")}
                </button>
              ) : null
            ) : (
              <span className="rounded-lg border border-alert/25 bg-alert/10 px-2.5 py-1.5 text-[11px] font-semibold text-alert">
                {t("soldOut")}
              </span>
            )}
          </div>
        </div>
      </article>

      {browseOpen && !ordering ? (
        <MenuItemDetailSheet
          item={item}
          onClose={() => setBrowseOpen(false)}
        />
      ) : null}

      {open && ordering && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label={tCommon("close")}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto animate-rise rounded-t-3xl border border-white/10 bg-[#121816] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#1a2420]">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 448px) 100vw, 448px"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-display text-6xl font-semibold text-brass/50">
                    {item.name.trim().charAt(0)}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute end-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-xl text-white backdrop-blur-sm"
                aria-label={tCommon("close")}
              >
                ×
              </button>
            </div>

            <div className="px-5 pt-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-2xl font-semibold leading-tight text-ink">
                  {item.name}
                </h3>
                <p className="shrink-0 font-display text-xl text-brass">
                  {formatPrice(item.price)}
                </p>
              </div>
              {item.description ? (
                <p className="mt-3 text-sm leading-relaxed text-ink-soft/75">
                  {item.description}
                </p>
              ) : null}
              {item.allergens.length > 0 ? (
                <p className="mt-3 text-xs uppercase tracking-wide text-ink-soft/45">
                  {t("allergens")}: {item.allergens.join(", ")}
                </p>
              ) : null}

              {additionals.length > 0 && (
                <div className="mt-5 space-y-2">
                  <p className="text-sm font-semibold text-ink-soft">{t("extras")}</p>
                  {additionals.map((extra) => (
                    <label
                      key={extra.id}
                      className="guest-panel flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#f97316]"
                        checked={Boolean(selected[extra.id])}
                        onChange={(e) =>
                          setSelected((prev) => ({
                            ...prev,
                            [extra.id]: e.target.checked,
                          }))
                        }
                      />
                      <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                        {extra.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-brass">
                        +{formatPrice(extra.price)}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <label className="guest-panel mt-5 flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#f97316]"
                  checked={takeaway}
                  onChange={(e) => setTakeaway(e.target.checked)}
                />
                <span className="text-sm font-medium text-ink">{t("takeaway")}</span>
              </label>

              <label className="mt-5 block">
                <span className="text-sm font-semibold text-ink-soft">
                  {t("specialInstructions")}
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                  rows={3}
                  maxLength={200}
                  placeholder={t("notesPlaceholder")}
                  className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/40 outline-none focus:border-brass/40"
                />
                <span className="mt-1 block text-end text-[11px] text-ink-soft/35">
                  {notes.length}/200
                </span>
              </label>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-soft">{t("quantity")}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-lg text-ink"
                  >
                    −
                  </button>
                  <span className="min-w-6 text-center font-semibold text-ink">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-lg text-ink"
                  >
                    +
                  </button>
                </div>
              </div>

              <button type="button" onClick={confirmAdd} className="btn-primary mt-5 w-full">
                {t("addToCart")} · {formatPrice(unitTotal * quantity)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
