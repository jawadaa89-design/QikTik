/**
 * Guest restaurant home lives at `/r/{venueSlug}/{locale}/main`.
 * Table QR ordering uses `/r/{venueSlug}/{locale}/t/{token}`.
 * In-app links stay same-origin relative.
 */
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";
import { venueMainPath } from "@/lib/venue-paths";

export const DEMO_TABLE_TOKEN =
  process.env.NEXT_PUBLIC_DEMO_TABLE_TOKEN ?? "t_table7demo2026";

export function guestDigitalMenuPath(
  locale: string,
  venueSlug: string = DEFAULT_VENUE_SLUG
): string {
  return venueMainPath(venueSlug, locale);
}

/** Always same-origin relative — never hardcode LAN / MENU_BASE_URL. */
export function guestDigitalMenuHref(
  locale: string,
  venueSlug: string = DEFAULT_VENUE_SLUG
): string {
  return guestDigitalMenuPath(locale, venueSlug);
}
