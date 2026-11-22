import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireFeature } from "@/lib/features";
import { isVapidConfigured, sendPickupWebPush } from "@/lib/web-push";
import { apiError } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/pickup/:id/push-test — guest self-test of Web Push delivery.
 * Sends immediately to the subscription saved on this ticket (no staff needed).
 */
export async function POST(
  _req: NextRequest,
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
    return apiError("INVALID_STATUS", "Cannot test push on a closed ticket", 400);
  }

  if (!ticket.pushSubscription?.trim()) {
    return apiError(
      "NO_SUBSCRIPTION",
      "No push subscription saved for this ticket — enable notifications first",
      400
    );
  }

  let endpointHost: string | null = null;
  try {
    const stored = JSON.parse(ticket.pushSubscription) as { endpoint?: string };
    if (stored?.endpoint) endpointHost = new URL(stored.endpoint).hostname;
  } catch {
    /* ignore */
  }

  const push = await sendPickupWebPush({
    ticketId: ticket.id,
    customerName: ticket.customerName,
    kind: "test",
  });

  console.info(
    `[push-test] ticket=${id}`,
    `sent=${push.sent}`,
    `reason=${push.reason ?? "ok"}`,
    `host=${push.endpointHost ?? endpointHost ?? "?"}`
  );

  return Response.json({
    ok: push.sent,
    push,
    endpointHost: push.endpointHost ?? endpointHost,
    hasPushSubscription: true,
  });
}
