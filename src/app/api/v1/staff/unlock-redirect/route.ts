import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  STAFF_SESSION_COOKIE,
  STAFF_TOKEN_COOKIE,
  createStaffSessionValue,
  staffSessionCookieOptions,
  verifyStaffPassword,
} from "@/lib/staff-auth";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";
import { VENUE_SLUG_COOKIE } from "@/lib/venue-paths";

/** Map unlock "next" to a safe staff board path under /r/{slug}/… */
function resolveStaffDest(nextPath: string, fallbackSlug: string): {
  path: string;
  slug: string;
} {
  const path = (nextPath || "/admin").split("?")[0] || "/admin";
  const venueMatch = path.match(/^\/r\/([^/]+)(\/.*)?$/);
  if (venueMatch) {
    const slug = venueMatch[1];
    const rest = venueMatch[2] || "";
    if (rest.startsWith("/kitchen")) return { path: `/r/${slug}/kitchen`, slug };
    if (rest.startsWith("/waiter")) return { path: `/r/${slug}/waiter`, slug };
    if (rest.startsWith("/admin")) return { path: `/r/${slug}/admin`, slug };
    if (rest.startsWith("/alerts")) return { path: `/r/${slug}/alerts`, slug };
    if (rest.startsWith("/pickup")) return { path: `/r/${slug}/pickup`, slug };
    return { path: `/r/${slug}/admin`, slug };
  }

  const slug = fallbackSlug || DEFAULT_VENUE_SLUG;
  if (path.startsWith("/kitchen")) return { path: `/r/${slug}/kitchen`, slug };
  if (path.startsWith("/waiter")) return { path: `/r/${slug}/waiter`, slug };
  if (path.startsWith("/alerts")) return { path: `/r/${slug}/alerts`, slug };
  if (path.startsWith("/pickup")) return { path: `/r/${slug}/pickup`, slug };
  return { path: `/r/${slug}/admin`, slug };
}

async function unlockAndRedirect(
  req: NextRequest,
  password: string | null,
  nextPath: string,
  venueSlugHint?: string | null
) {
  const cookieSlug =
    venueSlugHint?.trim() ||
    req.cookies.get(VENUE_SLUG_COOKIE)?.value?.trim() ||
    DEFAULT_VENUE_SLUG;
  const { path: destPath, slug } = resolveStaffDest(nextPath, cookieSlug);

  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host") ||
    req.nextUrl.host;
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (req.nextUrl.protocol === "https:" ? "https" : "http");
  const dest = new URL(destPath, `${proto}://${host}`);

  const venue =
    (await prisma.venue.findUnique({ where: { slug } })) ||
    (await prisma.venue.findFirst({ orderBy: { createdAt: "asc" } }));

  const trimmed = password?.trim() ?? "";
  let ok = false;
  if (trimmed && venue?.id) {
    try {
      ok = await verifyStaffPassword(trimmed, venue.id);
    } catch {
      ok = false;
    }
  }

  if (!ok) {
    dest.searchParams.set("staff_error", "1");
    const res = NextResponse.redirect(dest, 303);
    res.cookies.set(STAFF_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(STAFF_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(VENUE_SLUG_COOKIE, slug, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  }

  if (!venue?.id) {
    dest.searchParams.set("staff_error", "1");
    return NextResponse.redirect(dest, 303);
  }
  const token = createStaffSessionValue(venue.id);
  dest.searchParams.delete("staff_error");
  dest.searchParams.set("access_token", token);
  dest.searchParams.set("staff_token", token);

  const res = NextResponse.redirect(dest, 303);
  const cookieOpts = staffSessionCookieOptions();
  res.cookies.set(STAFF_SESSION_COOKIE, token, cookieOpts);
  res.cookies.set(STAFF_TOKEN_COOKIE, token, {
    ...cookieOpts,
    httpOnly: false,
  });
  res.cookies.set(VENUE_SLUG_COOKIE, slug, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export async function GET(req: NextRequest) {
  const password = req.nextUrl.searchParams.get("password");
  const next = req.nextUrl.searchParams.get("next") || "/admin";
  const venue = req.nextUrl.searchParams.get("venue");
  return unlockAndRedirect(req, password, next, venue);
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  let password: string | null = null;
  let next = "/admin";
  let venue: string | null = null;

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as {
      password?: string;
      next?: string;
      venue?: string;
    } | null;
    password = body?.password ?? null;
    next = body?.next || "/admin";
    venue = body?.venue ?? null;
  } else {
    const form = await req.formData().catch(() => null);
    password = form ? String(form.get("password") ?? "") : null;
    next = form ? String(form.get("next") ?? "/admin") : "/admin";
    venue = form ? String(form.get("venue") ?? "") : null;
  }

  return unlockAndRedirect(req, password, next, venue);
}
