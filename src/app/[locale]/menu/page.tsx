import { setRequestLocale } from "next-intl/server";
import { BrowseMenuClient } from "@/components/BrowseMenuClient";
import { hasFeature } from "@/lib/features";
import { getMenuForVenue } from "@/lib/menu-service";
import { resolveVenue } from "@/lib/venue";
import type { Locale } from "@/i18n/config";

type Props = {
  params: Promise<{ locale: string }>;
};

/** Public digital menu — no table token. Order-by-number and/or call waiter when enabled. */
export default async function PublicMenuPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const venue = await resolveVenue();
  const venueName = venue?.name ?? process.env.NEXT_PUBLIC_VENUE_NAME ?? "My Restaurant";
  const categories = venue
    ? await getMenuForVenue(venue.id, locale as Locale)
    : [];

  const enableOrderAtTable = venue
    ? await hasFeature("ordering", venue.id)
    : false;
  const enableCallWaiter = venue
    ? (await hasFeature("alerts", venue.id)) || (await hasFeature("pickup", venue.id))
    : false;

  return (
    <BrowseMenuClient
      venueName={venueName}
      categories={categories}
      enableOrderAtTable={enableOrderAtTable}
      enableCallWaiter={enableCallWaiter}
    />
  );
}
