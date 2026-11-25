"use client";

import { useLocale, useTranslations } from "next-intl";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("language");

  function switchLocale(newLocale: Locale) {
    const segments = pathname.split("/");
    // /r/{slug}/{locale}/… → locale is segment index 3 (1-based path parts: r, slug, locale)
    if (segments[1] === "r" && segments[2] && locales.includes(segments[3] as Locale)) {
      segments[3] = newLocale;
    } else if (locales.includes(segments[1] as Locale)) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }
    const path = segments.join("/") || "/";
    const qs = searchParams.toString();
    router.push(qs ? `${path}?${qs}` : path);
  }

  return (
    <label className={cn("relative inline-flex", className)}>
      <span className="sr-only">{t("select")}</span>
      <select
        aria-label={t("select")}
        value={locale}
        onChange={(e) => switchLocale(e.target.value as Locale)}
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
