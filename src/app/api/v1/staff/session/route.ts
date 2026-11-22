import { cookies, headers } from "next/headers";
import {
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_HEADER,
  verifyStaffSessionValue,
} from "@/lib/staff-auth";

/** GET /api/v1/staff/session — whether this browser has an unlocked staff session. */
export async function GET() {
  const jar = await cookies();
  if (verifyStaffSessionValue(jar.get(STAFF_SESSION_COOKIE)?.value)) {
    return Response.json({ unlocked: true });
  }

  const h = await headers();
  if (verifyStaffSessionValue(h.get(STAFF_SESSION_HEADER))) {
    return Response.json({ unlocked: true });
  }

  const auth = h.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    if (verifyStaffSessionValue(auth.slice(7).trim())) {
      return Response.json({ unlocked: true });
    }
  }

  return Response.json({ unlocked: false });
}
