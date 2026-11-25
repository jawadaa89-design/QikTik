"use client";

import { useEffect, useState } from "react";
import {
  getStoredStaffLocale,
  setStoredStaffLocale,
  locales,
  localeNames,
  isRtl,
  waiterMessages,
  kitchenMessages,
  adminMessages,
  pickupMessages,
  type Locale,
  type WaiterMessages,
  type KitchenMessages,
  type AdminMessages,
  type PickupMessages,
} from "@/i18n/staff";

export function useStaffLocale() {
  const [locale, setLocale] = useState<Locale>("ar");
  // Start ready so staff boards never stick on a blank "Loading…" screen on iPad.
  const [ready, setReady] = useState(true);

  useEffect(() => {
    try {
      const next = getStoredStaffLocale();
      setLocale(next);
      document.documentElement.lang = next;
      document.documentElement.dir = isRtl(next) ? "rtl" : "ltr";
    } catch {
      /* ignore */
    } finally {
      setReady(true);
    }
  }, []);

  function setStaffLocale(next: Locale) {
    setStoredStaffLocale(next);
    setLocale(next);
    document.documentElement.lang = next;
    document.documentElement.dir = isRtl(next) ? "rtl" : "ltr";
  }

  return {
    locale,
    setStaffLocale,
    t: waiterMessages[locale] as WaiterMessages,
    kt: kitchenMessages[locale] as KitchenMessages,
    at: adminMessages[locale] as AdminMessages,
    pt: pickupMessages[locale] as PickupMessages,
    ready,
    locales,
    localeNames,
  };
}

export function StaffLanguageSwitcher({
  locale,
  onChange,
  label,
  className,
}: {
  locale: Locale;
  onChange: (locale: Locale) => void;
  label: string;
  className?: string;
}) {
  return (
    <label className={`relative inline-flex ${className ?? ""}`}>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={locale}
        onChange={(e) => onChange(e.target.value as Locale)}
        className="appearance-none rounded-xl border border-white/20 bg-[#1a211c] py-1.5 pe-8 ps-3 text-xs font-semibold tracking-wide text-[#f2efe8] outline-none"
      >
        {locales.map((loc) => (
          <option
            key={loc}
            value={loc}
            // Native OS menus ignore theme vars — force readable black-on-white.
            style={{ backgroundColor: "#ffffff", color: "#111111" }}
          >
            {localeNames[loc]}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#f2efe8]/70">
        ▾
      </span>
    </label>
  );
}
