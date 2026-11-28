"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { cn, formatPrice } from "@/lib/utils";
import type { MenuItem } from "@/lib/demo-data";

type Props = {
  item: MenuItem;
  onClose: () => void;
};

/** View-only item detail — large photo, full description, allergens, extras. */
export function MenuItemDetailSheet({ item, onClose }: Props) {
  const t = useTranslations("menu");
  const tCommon = useTranslations("common");
  const additionals = item.additionals ?? [];
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      data-portal
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
    >
      <button
        type="button"
        aria-label={tCommon("close")}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-item-detail-title"
        className="relative flex max-h-[min(92dvh,var(--app-height,100svh))] w-full max-w-md flex-col overflow-hidden animate-rise rounded-t-3xl border border-white/10 bg-[#121816] sm:rounded-3xl"
      >
        {/* Sticky close — always above photo / safe area */}
        <div className="absolute inset-x-0 top-0 z-20 flex justify-end px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-2xl leading-none text-white shadow-lg backdrop-blur-md"
            aria-label={tCommon("close")}
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#1a2420]">
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt=""
                fill
                sizes="(max-width: 448px) 100vw, 448px"
                className={cn("object-cover", !item.available && "grayscale")}
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-display text-6xl font-semibold text-brass/50">
                  {item.name.trim().charAt(0)}
                </span>
              </div>
            )}
            {!item.available ? (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
                <span className="rounded-lg border border-alert/40 bg-alert/20 px-2.5 py-1 text-xs font-bold text-alert">
                  {t("soldOut")}
                </span>
              </div>
            ) : null}
          </div>

          <div className="px-5 pt-4">
            <div className="flex items-start justify-between gap-3">
              <h2
                id="menu-item-detail-title"
                className={cn(
                  "font-display text-2xl font-semibold leading-tight text-ink",
                  !item.available && "text-ink-soft/70"
                )}
              >
                {item.name}
              </h2>
              <span
                className={cn(
                  "shrink-0 font-display text-xl font-semibold",
                  item.available ? "text-brass" : "text-ink-soft/40"
                )}
              >
                {formatPrice(item.price)}
              </span>
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

            {additionals.length > 0 ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-ink-soft">{t("extras")}</p>
                <ul className="mt-2 space-y-2">
                  {additionals.map((extra) => (
                    <li
                      key={extra.id}
                      className="guest-panel flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5"
                    >
                      <span className="min-w-0 text-sm font-medium text-ink">
                        {extra.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-brass">
                        +{formatPrice(extra.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-ink-soft"
            >
              {tCommon("close")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
