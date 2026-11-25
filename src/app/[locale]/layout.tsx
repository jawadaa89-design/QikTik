import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { VenueProvider } from "@/components/VenueProvider";
import { VenueThemeProvider } from "@/components/VenueThemeProvider";
import { locales, isRtl, type Locale } from "@/i18n/config";
import { headers } from "next/headers";
import { venueSlugFromCookies } from "@/lib/venue-cookie.server";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";
import { resolveVenue } from "@/lib/venue";
import {
  brandFromVenue,
  venueIconsMetadata,
  venueLogoSrc,
} from "@/lib/venue-brand";
import { VenueFaviconLinks } from "@/components/VenueFaviconLinks";
import { VENUE_SLUG_HEADER } from "@/lib/venue-paths";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** Venue data is per-request; avoid build-time DB prerender. */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const headerSlug = (await headers()).get(VENUE_SLUG_HEADER)?.trim();
  const venueSlug =
    headerSlug || (await venueSlugFromCookies()) || DEFAULT_VENUE_SLUG;
  const venue = await resolveVenue({ slug: venueSlug });
  const brand = brandFromVenue(venue);
  const name = venue?.name?.trim() || "Restaurant";
  return {
    title: name,
    icons: venueIconsMetadata(venueLogoSrc(brand)),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = isRtl(locale as Locale) ? "rtl" : "ltr";
  const headerSlug = (await headers()).get(VENUE_SLUG_HEADER)?.trim();
  const venueSlug =
    headerSlug || (await venueSlugFromCookies()) || DEFAULT_VENUE_SLUG;
  const venue = await resolveVenue({ slug: venueSlug });
  const brand = brandFromVenue(venue);
  const iconHref = venueLogoSrc(brand);

  return (
    <html lang={locale} dir={dir}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <VenueFaviconLinks href={iconHref} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,650;9..144,700&family=Noto+Sans+Hebrew:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <VenueProvider
          venueSlug={venueSlug}
          venueName={venue?.name ?? "Restaurant"}
        >
          <VenueThemeProvider brand={brand}>
            <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
          </VenueThemeProvider>
        </VenueProvider>
      </body>
    </html>
  );
}
