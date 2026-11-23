import "../globals.css";
import { FeaturesProvider } from "@/components/FeaturesProvider";
import { StaffAuthGate } from "@/components/StaffAuthGate";
import { VenueProvider } from "@/components/VenueProvider";
import { venueSlugFromCookies } from "@/lib/venue-cookie.server";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";

export const metadata = {
  title: "QikTik Admin",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const venueSlug = (await venueSlugFromCookies()) || DEFAULT_VENUE_SLUG;

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
        <VenueProvider venueSlug={venueSlug}>
          <FeaturesProvider fetchOnMount venueSlug={venueSlug}>
            <StaffAuthGate>{children}</StaffAuthGate>
          </FeaturesProvider>
        </VenueProvider>
      </body>
    </html>
  );
}
