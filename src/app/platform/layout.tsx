import "../globals.css";
import { PoweredByQikTik } from "@/components/PoweredByQikTik";

export const metadata = {
  title: "QikTik Platform",
};

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <div className="flex min-h-dvh flex-col">
          <div className="flex-1">{children}</div>
          <PoweredByQikTik />
        </div>
      </body>
    </html>
  );
}
