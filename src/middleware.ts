import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale } from "@/i18n/config";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

/** Static PWA / SW assets must never be locale-redirected. */
const PASSTHROUGH_EXACT = new Set([
  "/sw.js",
  "/manifest.webmanifest",
  "/manifest.json",
]);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Strip query (e.g. /sw.js?v=4) for exact match.
  const pathOnly = pathname.split("?")[0] || pathname;
  if (
    PASSTHROUGH_EXACT.has(pathOnly) ||
    pathOnly.startsWith("/sw.js") ||
    pathOnly.startsWith("/api/") ||
    pathOnly.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }
  return intlMiddleware(request);
}

export const config = {
  // Keep matcher narrow; passthrough above is belt-and-suspenders if broadened later.
  matcher: [
    "/",
    "/(ar|en|he|ru)/:path*",
    "/sw.js",
    "/manifest.webmanifest",
    "/manifest.json",
  ],
};
