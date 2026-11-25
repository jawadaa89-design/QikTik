import { headers } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { BrowseMenuClient } from "@/components/BrowseMenuClient";
import { hasFeature } from "@/lib/features";
import type { Locale } from "@/i18n/config";
import { getMenuForVenue } from "@/lib/menu-service";
import { venueSlugFromCookies } from "@/lib/venue-cookie.server";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";
import { resolveVenue } from "@/lib/venue";
import { VENUE_SLUG_HEADER } from "@/lib/venue-paths";

type Props = {
  params: Promise<{ locale: string }>;
};

/** Restaurant home — digital menu + package actions (pickup, order, call waiter). */
export default async function VenueMainPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const headerSlug = (await headers()).get(VENUE_SLUG_HEADER)?.trim();
  const venueSlug =
    headerSlug || (await venueSlugFromCookies()) || DEFAULT_VENUE_SLUG;
  const venue = await resolveVenue({ slug: venueSlug });
  const venueName = venue?.name ?? "Restaurant";

  const categories = venue
    ? await getMenuForVenue(venue.id, locale as Locale)
    : [];

  const enableOrderAtTable = venue
    ? await hasFeature("ordering", venue.id)
    : false;
  const enablePickup = venue ? await hasFeature("pickup", venue.id) : false;
  const enableCallWaiter = venue
    ? (await hasFeature("alerts", venue.id)) || enablePickup
    : false;

  return (
    <BrowseMenuClient
      venueName={venueName}
      categories={categories}
      comingSoon={categories.length === 0}
      enableOrderAtTable={enableOrderAtTable}
      enableCallWaiter={enableCallWaiter}
      enablePickup={enablePickup}
    />
  );
}
