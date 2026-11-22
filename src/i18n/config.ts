export const locales = ["ar", "he", "en", "ru"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ar";

/** RTL locales */
export const rtlLocales: Locale[] = ["ar", "he"];

export function isRtl(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

export const localeNames: Record<Locale, string> = {
  ar: "العربية",
  he: "עברית",
  en: "English",
  ru: "Русский",
};

export const localeFlags: Record<Locale, string> = {
  ar: "🇸🇦",
  he: "🇮🇱",
  en: "🇬🇧",
  ru: "🇷🇺",
};
