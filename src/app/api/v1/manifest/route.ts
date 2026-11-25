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
} from "@/lib/venue-brand";
import { venueMainPath } from "@/lib/venue-paths";

export const dynamic = "force-dynamic";

/**
 * Per-venue Web App Manifest for “Add to Home Screen” on the guest main link.
 * name / short_name → "{Venue} QikTik"
 */
export async function GET(req: NextRequest) {
  const venue = await resolveVenueFromRequest(req);
  const brand = brandFromVenue(venue);
  const slug = venue?.slug || "myrestaurant";
  const displayName = venueHomeScreenName(venue?.name);
  const logo = venueLogoSrc(brand);
  const localeParam = req.nextUrl.searchParams.get("locale")?.trim();
  const lang: Locale = locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : defaultLocale;
  const startUrl = venueMainPath(slug, lang);

  const body = {
    id: `/r/${slug}/`,
    name: displayName,
    short_name: displayName,
    description: `${displayName} — guest menu and ordering`,
    start_url: startUrl,
    scope: `/r/${slug}/`,
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
