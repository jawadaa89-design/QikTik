import { cookies } from "next/headers";
import {
  STAFF_SESSION_COOKIE,
  staffSessionCookieOptions,
} from "@/lib/staff-auth";

/** POST /api/v1/staff/lock — clear staff session cookie (optional logout). */
export async function POST() {
  const jar = await cookies();
  jar.set(STAFF_SESSION_COOKIE, "", { ...staffSessionCookieOptions(0), maxAge: 0 });
  return Response.json({ ok: true });
}
