import "../globals.css";
import type { Metadata } from "next";
import { VenueProvider } from "@/components/VenueProvider";
import { VenueThemeProvider } from "@/components/VenueThemeProvider";
import { VenueFaviconLinks } from "@/components/VenueFaviconLinks";
import { MobilePullToRefresh } from "@/components/MobilePullToRefresh";
import { PoweredByQikTik } from "@/components/PoweredByQikTik";
import { resolveVenue } from "@/lib/venue";
import {
  brandFromVenue,
  venueIconsMetadata,
  venueLogoSrc,
  venueStaffHomeScreenName,
} from "@/lib/venue-brand";
import { venueSlugForLayout } from "@/lib/venue-request.server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const venueSlug = await venueSlugForLayout();
  const venue = await resolveVenue({ slug: venueSlug });
  const brand = brandFromVenue(venue);
  const name = venue?.name?.trim() || "Restaurant";
  const homeName = venueStaffHomeScreenName(name, "pickup");
  const manifestHref = `/api/v1/manifest?venue=${encodeURIComponent(venueSlug)}&start=pickup`;
  return {
    title: `${name} · Pickup`,
    applicationName: homeName,
    manifest: manifestHref,
    appleWebApp: {
      capable: true,
      title: homeName,
      statusBarStyle: "black-translucent",
    },
    icons: venueIconsMetadata(venueLogoSrc(brand)),
    other: {
      "mobile-web-app-capable": "yes",
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-title": homeName,
    },
  };
}

/**
 * Staff board auth lives in /pickup/live (SSR). Do not wrap with StaffAuthGate
 * here — that would force a second unlock before the redirect to live.
 */
export default async function PickupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const venueSlug = await venueSlugForLayout();
  const venue = await resolveVenue({ slug: venueSlug });
  const brand = brandFromVenue(venue);
  const logoHref = venueLogoSrc(brand);
  const homeName = venueStaffHomeScreenName(venue?.name, "pickup");
  const manifestHref = `/api/v1/manifest?venue=${encodeURIComponent(venueSlug)}&start=pickup`;

  return (
    <html lang="ar" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={homeName} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content={homeName} />
        <VenueFaviconLinks href={logoHref} />
        <link rel="manifest" href={manifestHref} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Heebo:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="staff-ink antialiased">
        <VenueProvider
          venueSlug={venueSlug}
          venueName={venue?.name ?? "Restaurant"}
        >
          <VenueThemeProvider brand={brand}>
            <MobilePullToRefresh />
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1">{children}</div>
              <PoweredByQikTik className="shrink-0 py-2" />
            </div>
          </VenueThemeProvider>
        </VenueProvider>
      </body>
    </html>
  );
}
