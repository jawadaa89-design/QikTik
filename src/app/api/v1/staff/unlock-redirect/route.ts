import { NextRequest, NextResponse } from "next/server";
import {
  STAFF_SESSION_COOKIE,
  STAFF_TOKEN_COOKIE,
  createStaffSessionValue,
  demoStaffPassword,
  staffSessionCookieOptions,
  verifyStaffPassword,
} from "@/lib/staff-auth";

/** Map unlock "next" to a safe staff board path. */
function resolveStaffDest(nextPath: string): string {
  const path = (nextPath || "/pickup").split("?")[0] || "/pickup";
  if (path.startsWith("/kitchen")) return "/kitchen";
  if (path.startsWith("/waiter")) return "/waiter";
  if (path.startsWith("/admin")) return "/admin";
  // /alerts/live redirects to /pickup/live when pickup package is on
  if (path.startsWith("/alerts")) return "/alerts/live";
  // Canonical pickup board (SSR) — works on iPad / PC / phone
  return "/pickup/live";
}

/**
 * GET/POST /api/v1/staff/unlock-redirect
 * Native HTML form unlock for iPad Safari (no JS click handlers required).
 * Sets cookie + redirects to the requested staff board with a one-time URL token.
 */
async function unlockAndRedirect(
  req: NextRequest,
  password: string | null,
  nextPath: string
) {
  const trimmed = password?.trim() ?? "";
  const destPath = resolveStaffDest(nextPath);
  // Prefer request Host so iPad on http://10.0.0.x is not redirected to localhost
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host") ||
    req.nextUrl.host;
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (req.nextUrl.protocol === "https:" ? "https" : "http");
  const dest = new URL(destPath, `${proto}://${host}`);

  let ok = false;
  if (trimmed) {
    try {
      ok = await verifyStaffPassword(trimmed);
    } catch {
      // Neon/DB blip — still accept demo password for local staff boards
      ok = trimmed === demoStaffPassword();
    }
  }

  if (!ok) {
    dest.searchParams.set("staff_error", "1");
    const res = NextResponse.redirect(dest, 303);
    res.cookies.set(STAFF_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(STAFF_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  const token = createStaffSessionValue();
  dest.searchParams.delete("staff_error");
  // Pickup live board reads access_token; React boards read staff_token.
  dest.searchParams.set("access_token", token);
  dest.searchParams.set("staff_token", token);

  const res = NextResponse.redirect(dest, 303);
  const cookieOpts = staffSessionCookieOptions();
  res.cookies.set(STAFF_SESSION_COOKIE, token, cookieOpts);
  res.cookies.set(STAFF_TOKEN_COOKIE, token, {
    ...cookieOpts,
    httpOnly: false,
  });
  return res;
}

export async function GET(req: NextRequest) {
  const password = req.nextUrl.searchParams.get("password");
  const next = req.nextUrl.searchParams.get("next") || "/pickup";
  return unlockAndRedirect(req, password, next);
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  let password: string | null = null;
  let next = "/pickup";

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as {
      password?: string;
      next?: string;
    } | null;
    password = body?.password ?? null;
    next = body?.next || "/pickup";
  } else {
    const form = await req.formData().catch(() => null);
    password = form ? String(form.get("password") ?? "") : null;
    next = form ? String(form.get("next") ?? "/pickup") : "/pickup";
  }

  return unlockAndRedirect(req, password, next);
}
