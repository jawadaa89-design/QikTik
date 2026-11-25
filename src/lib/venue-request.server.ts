import { headers } from "next/headers";
import { venueSlugFromCookies } from "@/lib/venue-cookie.server";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";
import { VENUE_SLUG_HEADER, normalizeVenueSlug } from "@/lib/venue-paths";

/**
 * Active restaurant for staff/guest layouts.
 * Prefer middleware rewrite header (from /r/{slug}/…) over the shared cookie —
 * the cookie is last-tab-wins and breaks multi-venue Chrome tabs.
 */
export async function venueSlugForLayout(): Promise<string> {
  try {
    const headerSlug = (await headers()).get(VENUE_SLUG_HEADER)?.trim();
    if (headerSlug) return normalizeVenueSlug(headerSlug);
  } catch {
    /* headers() unavailable */
  }
  const cookieSlug = await venueSlugFromCookies();
  return normalizeVenueSlug(cookieSlug || DEFAULT_VENUE_SLUG);
}
