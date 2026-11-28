import type { Locale } from "@/i18n/config";

/** Same wording as guest pickup `askBillSent` — shown on staff boards as the comment. */
export const BILL_REQUESTED_LABELS: Record<Locale, string> = {
  en: "Bill requested",
  ar: "تم طلب الفاتورة",
  he: "החשבון התבקש",
  ru: "Счёт запрошен",
};

export function billRequestedLabel(locale?: string | null): string {
  const key = (locale || "").trim().toLowerCase() as Locale;
  return BILL_REQUESTED_LABELS[key] ?? BILL_REQUESTED_LABELS.en;
}

/** True when a staff assistance comment is a localized bill request (with optional guest note). */
export function isBillRequestedComment(comment?: string | null): boolean {
  const text = (comment || "").trim();
  if (!text) return false;
  return Object.values(BILL_REQUESTED_LABELS).some(
    (label) => text === label || text.startsWith(`${label} —`) || text.startsWith(`${label} -`)
  );
}
