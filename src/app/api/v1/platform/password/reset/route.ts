import { NextRequest } from "next/server";
import { z } from "zod";
import {
  confirmPlatformPasswordReset,
  platformAdminEmail,
  requestPlatformPasswordReset,
} from "@/lib/platform-auth";
import { apiError } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/platform/password/reset
 * Send a 6-digit reset code to PLATFORM_ADMIN_EMAIL.
 */
export async function POST() {
  const result = await requestPlatformPasswordReset();
  if (!result.ok) {
    return apiError("RESET_FAILED", result.error, result.status);
  }
  const email = platformAdminEmail();
  const masked =
    email.length > 4
      ? `${email.slice(0, 2)}…@${email.split("@")[1] || "…"}`
      : "admin email";
  return Response.json({
    ok: true,
    message: `Reset code sent to ${masked}`,
  });
}

const confirmSchema = z.object({
  code: z.string().min(4).max(12),
  newPassword: z.string().trim().min(4).max(72),
});

/**
 * PATCH /api/v1/platform/password/reset
 * Confirm email code and set a new platform password.
 */
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const result = await confirmPlatformPasswordReset(
    parsed.data.code,
    parsed.data.newPassword
  );
  if (!result.ok) {
    return apiError("RESET_FAILED", result.error, result.status);
  }
  return Response.json({ ok: true });
}
