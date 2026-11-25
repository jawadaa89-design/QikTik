import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale } from "@/i18n/config";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";
import { VENUE_SLUG_COOKIE, VENUE_SLUG_HEADER } from "@/lib/venue-paths";

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

const STAFF_ROOTS = new Set([
  "admin",
  "pickup",
  "alerts",
  "kitchen",
  "waiter",
  "platform",
]);

function isLocale(seg: string | undefined): boolean {
  return Boolean(seg && (locales as readonly string[]).includes(seg));
}

function withVenueCookie(res: NextResponse, slug: string) {
  res.cookies.set(VENUE_SLUG_COOKIE, slug, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathOnly = pathname.split("?")[0] || pathname;

  if (
    PASSTHROUGH_EXACT.has(pathOnly) ||
    pathOnly.startsWith("/sw.js") ||
    pathOnly.startsWith("/api/") ||
    pathOnly.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }

  const parts = pathOnly.split("/").filter(Boolean);

  // Canonical multi-venue: /r/{slug}/… → rewrite to internal app paths
  if (parts[0] === "r") {
    const slug = parts[1]?.trim().toLowerCase();
    if (!slug) {
      return NextResponse.redirect(
        new URL(`/r/${DEFAULT_VENUE_SLUG}/${defaultLocale}/menu`, request.url)
      );
    }

    const restParts = parts.slice(2);

    // /r/{slug} → default locale menu
    if (restParts.length === 0) {
      return withVenueCookie(
        NextResponse.redirect(
          new URL(`/r/${slug}/${defaultLocale}/menu`, request.url)
        ),
        slug
      );
    }

    // Staff board roots: keep /r/{slug}/pickup in the address bar (no bounce to /pickup/live)
    let restPath = `/${restParts.join("/")}`;
    if (restParts.length === 1 && restParts[0] === "pickup") {
      restPath = "/pickup/live";
    } else if (restParts.length === 1 && restParts[0] === "alerts") {
      restPath = "/alerts/live";
    }

    const url = request.nextUrl.clone();
    url.pathname = restPath;

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(VENUE_SLUG_HEADER, slug);

    const res = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
    return withVenueCookie(res, slug);
  }

  // Internal live boards are posted to by form/fetch (redirect:manual). Redirecting
  // them to /r/{slug}/… drops the POST body on iPad/Safari and Ready/Done never apply.
  if (
    (parts[0] === "pickup" && parts[1] === "live") ||
    (parts[0] === "alerts" && parts[1] === "live")
  ) {
    const slug =
      request.nextUrl.searchParams.get("venue")?.trim() ||
      request.cookies.get(VENUE_SLUG_COOKIE)?.value?.trim() ||
      DEFAULT_VENUE_SLUG;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(VENUE_SLUG_HEADER, slug);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    return withVenueCookie(res, slug);
  }

  // Legacy staff roots → /r/{activeVenue}/… (cookie keeps multi-venue; else demo)
  if (parts[0] && STAFF_ROOTS.has(parts[0])) {
    const slug =
      request.cookies.get(VENUE_SLUG_COOKIE)?.value?.trim() || DEFAULT_VENUE_SLUG;
    const dest = `/r/${slug}${pathOnly}${request.nextUrl.search}`;
    return withVenueCookie(NextResponse.redirect(new URL(dest, request.url)), slug);
  }

  // Legacy /{locale}/… guest paths → /r/{activeVenue}/{locale}/…
  // Must not force DEFAULT — that wiped Coffee Up when guests followed /ar/pickup/…
  if (isLocale(parts[0])) {
    const slug =
      request.cookies.get(VENUE_SLUG_COOKIE)?.value?.trim() || DEFAULT_VENUE_SLUG;
    const dest = `/r/${slug}${pathOnly}${request.nextUrl.search}`;
    return withVenueCookie(NextResponse.redirect(new URL(dest, request.url)), slug);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/",
    "/r/:path*",
    "/(ar|en|he|ru)/:path*",
    "/admin/:path*",
    "/admin",
    "/pickup/:path*",
    "/pickup",
    "/alerts/:path*",
    "/alerts",
    "/kitchen/:path*",
    "/kitchen",
    "/waiter/:path*",
    "/waiter",
    "/platform/:path*",
    "/platform",
    "/sw.js",
    "/manifest.webmanifest",
    "/manifest.json",
  ],
};
