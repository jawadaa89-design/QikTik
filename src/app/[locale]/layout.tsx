import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { VenueProvider } from "@/components/VenueProvider";
import { locales, isRtl, type Locale } from "@/i18n/config";
import { venueSlugFromCookies } from "@/lib/venue-cookie.server";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** Venue data is per-request; avoid build-time DB prerender. */
export const dynamic = "force-dynamic";

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = isRtl(locale as Locale) ? "rtl" : "ltr";
  const venueSlug = (await venueSlugFromCookies()) || DEFAULT_VENUE_SLUG;

  return (
    <html lang={locale} dir={dir}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,650;9..144,700&family=Noto+Sans+Hebrew:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <VenueProvider venueSlug={venueSlug}>
          <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        </VenueProvider>
      </body>
    </html>
  );
}
