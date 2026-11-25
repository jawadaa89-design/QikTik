import "../globals.css";
import { FeaturesProvider } from "@/components/FeaturesProvider";
import { StaffAuthGate } from "@/components/StaffAuthGate";
import { VenueProvider } from "@/components/VenueProvider";
import { VenueThemeProvider } from "@/components/VenueThemeProvider";
import type { Metadata } from "next";
import { resolveVenue } from "@/lib/venue";
import {
  brandFromVenue,
  venueIconsMetadata,
  venueLogoSrc,
} from "@/lib/venue-brand";
import { VenueFaviconLinks } from "@/components/VenueFaviconLinks";
import { PoweredByQikTik } from "@/components/PoweredByQikTik";
import { venueSlugForLayout } from "@/lib/venue-request.server";

/** Per-request venue from /r/{slug}/… header — avoid shared-cookie bleed across tabs. */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const venueSlug = await venueSlugForLayout();
  const venue = await resolveVenue({ slug: venueSlug });
  const brand = brandFromVenue(venue);
  const name = venue?.name?.trim() || "Restaurant";
  return {
    title: `${name} · Admin`,
    icons: venueIconsMetadata(venueLogoSrc(brand)),
  };
}

export default async function AdminLayout({
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
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <VenueProvider
          venueSlug={venueSlug}
          venueName={venue?.name ?? "Restaurant"}
        >
          <VenueThemeProvider brand={brand}>
            <div className="flex min-h-dvh flex-col">
              <div className="flex-1">
                <FeaturesProvider fetchOnMount venueSlug={venueSlug}>
                  <StaffAuthGate>{children}</StaffAuthGate>
                </FeaturesProvider>
              </div>
              <PoweredByQikTik />
            </div>
          </VenueThemeProvider>
        </VenueProvider>
      </body>
    </html>
  );
}
