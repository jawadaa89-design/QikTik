import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireFeature } from "@/lib/features";
import { isVapidConfigured } from "@/lib/web-push";
import { apiError } from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const pushSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string().min(1).max(512),
      auth: z.string().min(1).max(512),
    }),
  }),
  locale: z.enum(["en", "ar", "he", "ru"]).optional(),
});

/**
 * POST /api/v1/pickup/:id/push-subscribe — save guest Web Push subscription.
 * Public (guest waiting page); scoped to an existing pickup ticket.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isVapidConfigured()) {
    return apiError(
      "VAPID_NOT_CONFIGURED",
      "Web Push is not configured on this server",
      503
    );
  }

  const { id } = await params;
  const ticket = await prisma.pickupTicket.findUnique({ where: { id } });
  if (!ticket) return apiError("NOT_FOUND", "Pickup ticket not found", 404);

  const blocked = await requireFeature("pickup", ticket.venueId);
  if (blocked) return blocked;

  if (ticket.status === "COMPLETED" || ticket.status === "CANCELLED") {
    return apiError("INVALID_STATUS", "Cannot subscribe on a closed ticket", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = pushSubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const stored = {
    endpoint: parsed.data.subscription.endpoint,
    expirationTime: parsed.data.subscription.expirationTime ?? null,
    keys: parsed.data.subscription.keys,
    locale: parsed.data.locale,
  };

  await prisma.pickupTicket.update({
    where: { id },
    data: { pushSubscription: JSON.stringify(stored) },
  });

  console.info(
    `[push-subscribe] saved for ticket ${id}`,
    `endpoint=${stored.endpoint.slice(0, 48)}…`,
    `locale=${stored.locale ?? "?"}`
  );

  return Response.json({ ok: true, hasPushSubscription: true });
}
