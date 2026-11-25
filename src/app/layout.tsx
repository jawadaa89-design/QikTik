import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QikTik",
  description: "QR + NFC table ordering for restaurants and pubs",
  applicationName: "QikTik",
  manifest: "/api/v1/manifest",
  appleWebApp: {
    capable: true,
    title: "QikTik",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/logo.png", sizes: "192x192", type: "image/png" },
      { url: "/qiktik-mark.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/logo.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "QikTik",
  },
};

export const viewport: Viewport = {
  themeColor: "#c4a35a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
