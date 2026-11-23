"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { BottomNav } from "@/components/BottomNav";
import { useCart, lineUnitPrice } from "@/components/CartProvider";
import { useGuestAuth } from "@/components/GuestAuthProvider";
import { QikTikLogo } from "@/components/QikTikLogo";
import { formatPrice } from "@/lib/utils";

type Props = {
  locale: string;
  token: string;
};

export default function CartPage({ locale, token }: Props) {
  const t = useTranslations("cart");
  const tCommon = useTranslations("common");
  const { lines, updateQuantity, removeItem, total, count, clear } = useCart();
  const { ensureUnlocked, sessionId: authSessionId } = useGuestAuth();
  const [paymentMode, setPaymentMode] = useState<"PAY_NOW" | "ADD_TO_TAB">("ADD_TO_TAB");
  const [placing, setPlacing] = useState(false);

  async function placeOrder() {
    if (!ensureUnlocked()) return;
    if (!authSessionId) return;
    setPlacing(true);
    try {
      const res = await fetch(`/api/v1/sessions/${authSessionId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMode,
          items: lines.map((l) => ({
            menuItemId: l.item.id,
            quantity: l.quantity,
            notes: l.notes,
            takeaway: l.takeaway,
            additionalIds: l.additionals.map((a) => a.id),
          })),
        }),
      });
      if (res.ok) {
        clear();
        window.location.href = `/${locale}/t/${token}/orders`;
      }
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="guest-shell pb-24">
      <header className="px-5 pb-4 pt-6 animate-rise">
        <div className="relative flex items-start gap-3 pe-28">
          <Link
            href={`/${locale}/t/${token}`}
            className="text-sm font-semibold text-brass hover:text-brass-glow"
          >
            ← {tCommon("back")}
          </Link>
          <QikTikLogo className="absolute end-0 top-1" />
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ink">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-soft/60">
          {count} · {formatPrice(total)}
        </p>
      </header>

      <div className="flex flex-col gap-3 px-4">
        {lines.length === 0 ? (
          <div className="guest-panel rounded-2xl px-4 py-14 text-center animate-rise">
            <p className="font-display text-xl text-ink-soft/50">Cart is empty</p>
            <Link href={`/${locale}/t/${token}`} className="btn-primary mt-5 inline-flex">
              {tCommon("menu")}
            </Link>
          </div>
        ) : (
          lines.map((line, i) => (
            <div
              key={line.key}
              className="guest-panel animate-rise rounded-2xl p-4"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-semibold text-ink">{line.item.name}</span>
                  {line.additionals.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-sm text-ink-soft/70">
                      {line.additionals.map((a) => (
                        <li key={a.id}>
                          + {a.name} ({formatPrice(a.price)})
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {line.takeaway ? (
                    <p className="mt-1 text-sm font-semibold text-brass">{t("takeaway")}</p>
                  ) : null}
                  {line.notes ? (
                    <p className="mt-1 text-sm text-brass/90">“{line.notes}”</p>
                  ) : null}
                </div>
                <span className="shrink-0 font-display font-semibold text-brass">
                  {formatPrice(lineUnitPrice(line) * line.quantity)}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(line.key, line.quantity - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-lg font-medium text-ink"
                >
                  −
                </button>
                <span className="min-w-6 text-center font-semibold">{line.quantity}</span>
                <button
                  onClick={() => updateQuantity(line.key, line.quantity + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-lg font-medium text-ink"
                >
                  +
                </button>
                <button
                  onClick={() => removeItem(line.key)}
                  className="ms-auto flex h-9 w-9 items-center justify-center rounded-lg text-lg text-alert/90 hover:bg-alert/10"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}

        {lines.length > 0 && (
          <div className="animate-rise-delay-2 space-y-3 pb-4">
            <div className="guest-panel flex items-center justify-between rounded-2xl px-4 py-3">
              <span className="text-sm font-medium text-ink-soft/70">{tCommon("total")}</span>
              <span className="font-display text-2xl font-semibold text-ink">
                {formatPrice(total)}
              </span>
            </div>

            <p className="px-1 text-sm font-semibold text-ink-soft">{t("howToPay")}</p>
            {(
              [
                ["ADD_TO_TAB", t("addToTab")],
                ["PAY_NOW", t("payNow")],
              ] as const
            ).map(([mode, label]) => (
              <label
                key={mode}
                className={`guest-panel flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 transition ${
                  paymentMode === mode ? "border-brass/50 ring-1 ring-brass/40" : ""
                }`}
              >
                <input
                  type="radio"
                  className="accent-[#f97316]"
                  checked={paymentMode === mode}
                  onChange={() => setPaymentMode(mode)}
                />
                <span className="text-sm font-medium text-ink">{label}</span>
              </label>
            ))}

            <button onClick={placeOrder} disabled={placing} className="btn-primary w-full">
              {placing ? "…" : `${t("placeOrder")} — ${formatPrice(total)}`}
            </button>
          </div>
        )}
      </div>

      <BottomNav locale={locale} tableToken={token} cartCount={count} active="cart" />
    </div>
  );
}
