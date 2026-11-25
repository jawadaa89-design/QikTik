import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { venueSlugFromCookies } from "@/lib/venue-cookie.server";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";
import { VENUE_SLUG_HEADER, venueMenuPath } from "@/lib/venue-paths";

type Props = {
  params: Promise<{ locale: string }>;
};

/** Locale root → digital menu (restaurant home for every package). */
export default async function LocaleHome({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const headerSlug = (await headers()).get(VENUE_SLUG_HEADER)?.trim();
  const venueSlug =
    headerSlug || (await venueSlugFromCookies()) || DEFAULT_VENUE_SLUG;

  redirect(venueMenuPath(venueSlug, locale));
}
