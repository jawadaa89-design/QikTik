import "../globals.css";
import { FeaturesProvider } from "@/components/FeaturesProvider";
import { StaffAuthGate } from "@/components/StaffAuthGate";

export const metadata = {
  title: "QikTik Kitchen Display System",
};

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Heebo:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="staff-ink antialiased">
        <FeaturesProvider fetchOnMount>
          <StaffAuthGate>{children}</StaffAuthGate>
        </FeaturesProvider>
      </body>
    </html>
  );
}
