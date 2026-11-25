import "../globals.css";
import { FeaturesProvider } from "@/components/FeaturesProvider";
import { StaffAuthGate } from "@/components/StaffAuthGate";
import { VenueProvider } from "@/components/VenueProvider";
import { VenueThemeProvider } from "@/components/VenueThemeProvider";
import { resolveVenue } from "@/lib/venue";
import { brandFromVenue } from "@/lib/venue-brand";
import { venueSlugForLayout } from "@/lib/venue-request.server";

export const metadata = {
  title: "QikTik Waiter",
};

export const dynamic = "force-dynamic";

export default async function WaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const venueSlug = await venueSlugForLayout();
  const venue = await resolveVenue({ slug: venueSlug });
  const brand = brandFromVenue(venue);

  return (
    <html lang="ar" suppressHydrationWarning>
      <head>
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
            <FeaturesProvider fetchOnMount venueSlug={venueSlug}>
              <StaffAuthGate>{children}</StaffAuthGate>
            </FeaturesProvider>
          </VenueThemeProvider>
        </VenueProvider>
      </body>
    </html>
  );
}
