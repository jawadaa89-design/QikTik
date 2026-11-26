import { NextRequest } from "next/server";
import { z } from "zod";
import {
  updateStoredPlatformPassword,
  verifyPlatformPassword,
} from "@/lib/platform-auth";
import { apiError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().trim().min(4).max(72),
});

/**
 * PATCH /api/v1/platform/password
 * Change platform password by verifying the current one first.
 */
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  if (!(await verifyPlatformPassword(parsed.data.currentPassword))) {
    return apiError("UNAUTHORIZED", "Wrong current password", 401);
  }

  await updateStoredPlatformPassword(parsed.data.newPassword);
  return Response.json({ ok: true });
}
