"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useFeatures } from "@/components/FeaturesProvider";
import { cn } from "@/lib/utils";

type Props = {
  locale: string;
  tableToken: string;
  cartCount: number;
  active: "menu" | "orders" | "cart";
};

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.18 : 0}
      />
    </svg>
  );
}

function IconOrders({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4h10a2 2 0 0 1 2 2v14l-3.5-2L12 20l-3.5-2L5 20V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.18 : 0}
      />
      <path d="M9 9h6M9 13h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconCart({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5h2l1.2 9.2A2 2 0 0 0 9.2 16h7.5a2 2 0 0 0 2-1.6L20 8H7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      <circle cx="10" cy="19.5" r="1.3" fill="currentColor" />
      <circle cx="17" cy="19.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function BottomNav({ locale, tableToken, cartCount, active }: Props) {
  const t = useTranslations("common");
  const { hasFeature } = useFeatures();
  const ordering = hasFeature("ordering");
  const base = `/${locale}/t/${tableToken}`;

  if (!ordering) return null;

  const items = [
    { key: "menu" as const, label: t("menu"), href: base, Icon: IconHome },
    { key: "orders" as const, label: t("orders"), href: `${base}/orders`, Icon: IconOrders },
    { key: "cart" as const, label: t("cart"), href: `${base}/cart`, Icon: IconCart, badge: cartCount },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/8 bg-[#0c110f]/95 pb-safe backdrop-blur-xl">
      <div className="mx-auto flex max-w-md">
        {items.map((item) => {
          const isActive = active === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] tracking-wide transition",
                isActive ? "text-brass font-semibold" : "text-ink-soft/55"
              )}
            >
              <span className="relative">
                <item.Icon active={isActive} />
                {item.badge ? (
                  <span className="absolute -top-1.5 -end-2.5 flex h-4 min-w-4 items-center justify-center rounded-md bg-brass px-1 text-[10px] font-bold text-[#0c100e]">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              {item.label}
              {isActive && (
                <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-brass" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
