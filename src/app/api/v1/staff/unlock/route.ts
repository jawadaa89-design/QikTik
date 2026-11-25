import { NextResponse } from "next/server";
import { z } from "zod";
import {
  STAFF_SESSION_COOKIE,
  STAFF_TOKEN_COOKIE,
  createStaffSessionValue,
  staffSessionCookieOptions,
  verifyStaffPassword,
} from "@/lib/staff-auth";
import { apiError } from "@/lib/validation";
import { resolveVenue } from "@/lib/venue";
import { VENUE_SLUG_COOKIE } from "@/lib/venue-paths";

const bodySchema = z.object({
  password: z.string().min(1).max(128),
  venueSlug: z.string().trim().min(1).optional(),
});

/**
 * POST /api/v1/staff/unlock — staff password gate for /admin, /pickup, /kitchen, /waiter.
 * Password is checked against the active venue’s admin user only.
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError("INVALID_BODY", "Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiError("INVALID_PASSWORD", "Password required", 400);
  }

  const venue = await resolveVenue({
    req,
    slug: parsed.data.venueSlug,
  });
  if (!venue) {
    return apiError("VENUE_NOT_FOUND", "Venue not found", 404);
  }

  const ok = await verifyStaffPassword(parsed.data.password, venue.id);
  if (!ok) {
    return apiError("INVALID_PASSWORD", "Wrong staff password", 401);
  }

  const token = createStaffSessionValue(venue.id);
  const res = NextResponse.json({ ok: true, token, venueSlug: venue.slug });
  const cookieOpts = staffSessionCookieOptions();
  res.cookies.set(STAFF_SESSION_COOKIE, token, cookieOpts);
  res.cookies.set(STAFF_TOKEN_COOKIE, token, { ...cookieOpts, httpOnly: false });
  res.cookies.set(VENUE_SLUG_COOKIE, venue.slug, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
