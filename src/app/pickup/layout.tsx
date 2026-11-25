import "../globals.css";
import type { Metadata } from "next";
import { VenueProvider } from "@/components/VenueProvider";
import { VenueThemeProvider } from "@/components/VenueThemeProvider";
import { VenueFaviconLinks } from "@/components/VenueFaviconLinks";
import { resolveVenue } from "@/lib/venue";
import {
  brandFromVenue,
  venueIconsMetadata,
  venueLogoSrc,
} from "@/lib/venue-brand";
import { venueSlugForLayout } from "@/lib/venue-request.server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const venueSlug = await venueSlugForLayout();
  const venue = await resolveVenue({ slug: venueSlug });
  const brand = brandFromVenue(venue);
  const name = venue?.name?.trim() || "Restaurant";
  return {
    title: `${name} · Pickup`,
    icons: venueIconsMetadata(venueLogoSrc(brand)),
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

  return (
    <html lang="ar" suppressHydrationWarning>
      <head>
        <VenueFaviconLinks href={logoHref} />
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
          <VenueThemeProvider brand={brand}>{children}</VenueThemeProvider>
        </VenueProvider>
      </body>
    </html>
  );
}
