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

const bodySchema = z.object({
  password: z.string().min(1).max(128),
});

/**
 * POST /api/v1/staff/unlock — staff password gate for /admin, /pickup, /kitchen, /waiter.
 * Demo password (seed): qiktik2026
 * Returns `token` in JSON so iPad Safari can auth via header when cookies are dropped.
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

  const ok = await verifyStaffPassword(parsed.data.password);
  if (!ok) {
    return apiError("INVALID_PASSWORD", "Wrong staff password", 401);
  }

  const token = createStaffSessionValue();
  const res = NextResponse.json({ ok: true, token });
  const cookieOpts = staffSessionCookieOptions();
  res.cookies.set(STAFF_SESSION_COOKIE, token, cookieOpts);
  res.cookies.set(STAFF_TOKEN_COOKIE, token, { ...cookieOpts, httpOnly: false });
  return res;
}
