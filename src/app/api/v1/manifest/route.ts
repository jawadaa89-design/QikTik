import { NextRequest, NextResponse } from "next/server";
import {
  defaultLocale,
  isRtl,
  locales,
  type Locale,
} from "@/i18n/config";
import { resolveVenueFromRequest } from "@/lib/venue";
import {
  brandFromVenue,
  venueHomeScreenName,
  venueLogoSrc,
  venueStaffHomeScreenName,
} from "@/lib/venue-brand";
import { venueMainPath, venueStaffPath } from "@/lib/venue-paths";

export const dynamic = "force-dynamic";

const STAFF_BOARDS = ["admin", "pickup", "alerts", "kitchen", "waiter"] as const;
type StaffBoard = (typeof STAFF_BOARDS)[number];

function isStaffBoard(value: string | null | undefined): value is StaffBoard {
  return Boolean(value && (STAFF_BOARDS as readonly string[]).includes(value));
}

/**
 * Per-venue Web App Manifest for “Add to Home Screen”.
 * Guest: ?start=main (default) → "{Venue} QikTik" → /r/{slug}/{locale}/main
 * Staff: ?start=admin|kitchen|waiter|pickup|alerts → "{Venue} Admin" etc.
 */
export async function GET(req: NextRequest) {
  const venue = await resolveVenueFromRequest(req);
  const brand = brandFromVenue(venue);
  const slug = venue?.slug || "myrestaurant";
  const logo = venueLogoSrc(brand);
  const localeParam = req.nextUrl.searchParams.get("locale")?.trim();
  const lang: Locale = locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : defaultLocale;
  const startParam =
    req.nextUrl.searchParams.get("start")?.trim().toLowerCase() || "main";

  const staffBoard = isStaffBoard(startParam) ? startParam : null;
  const displayName = staffBoard
    ? venueStaffHomeScreenName(venue?.name, staffBoard)
    : venueHomeScreenName(venue?.name);
  const startUrl = staffBoard
    ? venueStaffPath(slug, staffBoard)
    : venueMainPath(slug, lang);
  const scope = `/r/${slug}/`;
  const description = staffBoard
    ? `${displayName} — staff board`
    : `${displayName} — guest menu and ordering`;

  const body = {
    id: staffBoard ? `${scope}${staffBoard}` : scope,
    name: displayName,
    short_name: displayName,
    description,
    start_url: startUrl,
    scope,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: brand.backgroundColor,
    theme_color: brand.accentColor,
    orientation: "portrait-primary",
    lang,
    dir: isRtl(lang) ? "rtl" : "ltr",
    icons: [
      { src: logo, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: logo, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: logo, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}
