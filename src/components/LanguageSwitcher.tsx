"use client";

import { useLocale, useTranslations } from "next-intl";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("language");

  function switchLocale(newLocale: Locale) {
    const segments = pathname.split("/");
    if (locales.includes(segments[1] as Locale)) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }
    router.push(segments.join("/") || "/");
  }

  return (
    <label className={cn("relative inline-flex", className)}>
      <span className="sr-only">{t("select")}</span>
      <select
        aria-label={t("select")}
        value={locale}
        onChange={(e) => switchLocale(e.target.value as Locale)}
        className="appearance-none rounded-xl border border-white/10 bg-white/[0.06] py-1.5 pe-8 ps-3 text-xs font-semibold tracking-wide text-ink outline-none"
      >
        {locales.map((loc) => (
          <option key={loc} value={loc} className="bg-[#161c19] text-ink">
            {localeNames[loc]}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-soft/50">
        ▾
      </span>
    </label>
  );
}
