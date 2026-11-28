import { defaultLocale } from "@/i18n/config";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";

/** Cookie + header used so rewrites keep the active restaurant slug. */
export const VENUE_SLUG_COOKIE = "qiktik_venue_slug";
export const VENUE_SLUG_HEADER = "x-venue-slug";

export function normalizeVenueSlug(slug: string | null | undefined): string {
  const s = slug?.trim().toLowerCase() || "";
  return s || DEFAULT_VENUE_SLUG;
}

/** Guest paths under /r/{slug}/{locale}/… */
export function venueGuestBase(venueSlug: string, locale: string): string {
  return `/r/${normalizeVenueSlug(venueSlug)}/${locale}`;
}

/** Restaurant home (digital menu + package CTAs). */
export function venueMainPath(venueSlug: string, locale: string): string {
  return `${venueGuestBase(venueSlug, locale)}/main`;
}

/** @deprecated Use venueMainPath — guest home was renamed from /menu to /main. */
export function venueMenuPath(venueSlug: string, locale: string): string {
  return venueMainPath(venueSlug, locale);
}

export function venuePickupPath(venueSlug: string, locale: string): string {
  return `${venueGuestBase(venueSlug, locale)}/pickup`;
}

/** Guest call-waiter form (separate page, same pattern as pickup register). */
export function venueCallWaiterPath(venueSlug: string, locale: string): string {
  return `${venueGuestBase(venueSlug, locale)}/call-waiter`;
}

/** Guest ask-for-the-bill form (same alerts package as call-waiter). */
export function venueAskBillPath(venueSlug: string, locale: string): string {
  return `${venueGuestBase(venueSlug, locale)}/ask-bill`;
}

/** Guest order-at-table: enter table number → register & order. */
export function venueOrderTablePath(venueSlug: string, locale: string): string {
  return `${venueGuestBase(venueSlug, locale)}/order-table`;
}

export function venueTablePath(
  venueSlug: string,
  locale: string,
  token: string
): string {
  return `${venueGuestBase(venueSlug, locale)}/t/${token}`;
}

/** Staff boards under /r/{slug}/… */
export function venueStaffPath(
  venueSlug: string,
  board: "admin" | "pickup" | "alerts" | "kitchen" | "waiter"
): string {
  return `/r/${normalizeVenueSlug(venueSlug)}/${board}`;
}

export function venueRootPath(venueSlug: string, locale = defaultLocale): string {
  return venueMainPath(venueSlug, locale);
}
