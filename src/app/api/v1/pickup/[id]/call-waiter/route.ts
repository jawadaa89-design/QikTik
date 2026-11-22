import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { apiError, pickupCallWaiterOnTicketSchema } from "@/lib/validation";
import { requireFeature } from "@/lib/features";

export const dynamic = "force-dynamic";

/** Light per-ticket cooldown so guests cannot spam staff alerts. */
const CALL_COOLDOWN_MS = 15_000;
const lastCallByTicket = new Map<string, number>();

function serializeAssistance(call: {
  id: string;
  venueId: string;
  customerName: string;
  orderRef: string;
  comment: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: call.id,
    venueId: call.venueId,
    customerName: call.customerName,
    orderRef: call.orderRef,
    comment: call.comment,
    status: call.status,
    createdAt: call.createdAt.toISOString(),
    updatedAt: call.updatedAt.toISOString(),
  };
}

/**
 * POST /api/v1/pickup/:id/call-waiter — guest asks staff for help from the waiting page.
 * Creates/updates a PickupAssistanceCall (Waiter calls queue) linked by the ticket orderRef,
 * and publishes pickup:call-waiter for the staff popup/sound.
 * Optional JSON body: { comment?: string }.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ticket = await prisma.pickupTicket.findUnique({ where: { id } });
  if (!ticket) return apiError("NOT_FOUND", "Pickup ticket not found", 404);

  const blocked = await requireFeature("pickup", ticket.venueId);
  if (blocked) return blocked;

  if (ticket.status === "COMPLETED" || ticket.status === "CANCELLED") {
    return apiError("INVALID_STATUS", "Cannot call waiter for a closed pickup ticket", 400);
  }

  let comment: string | null = null;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("INVALID_JSON", "Invalid JSON body", 400);
    }
    const parsed = pickupCallWaiterOnTicketSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.message, 400);
    }
    comment = parsed.data.comment?.trim() || null;
  }

  const now = Date.now();
  const last = lastCallByTicket.get(ticket.id) ?? 0;
  if (now - last < CALL_COOLDOWN_MS) {
    const retryAfterSec = Math.ceil((CALL_COOLDOWN_MS - (now - last)) / 1000);
    return apiError(
      "RATE_LIMITED",
      `Please wait ${retryAfterSec}s before calling again`,
      429
    );
  }

  // Reuse an active assistance row for this ticket # instead of stacking OPEN calls.
  let call = await prisma.pickupAssistanceCall.findFirst({
    where: {
      venueId: ticket.venueId,
      orderRef: ticket.orderRef,
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  let created = false;

  if (!call) {
    call = await prisma.pickupAssistanceCall.create({
      data: {
        venueId: ticket.venueId,
        customerName: ticket.customerName,
        orderRef: ticket.orderRef,
        comment,
        status: "OPEN",
      },
    });
    created = true;
  } else {
    call = await prisma.pickupAssistanceCall.update({
      where: { id: call.id },
      data: {
        customerName: ticket.customerName,
        comment,
        // Re-open if staff had only acknowledged — guest is calling again.
        status: "OPEN",
      },
    });
  }

  lastCallByTicket.set(ticket.id, now);

  const assistance = serializeAssistance(call);
  publish(RealtimeEvents.PICKUP_ASSISTANCE_UPDATED, assistance);

  const callPayload = {
    id: ticket.id,
    customerName: ticket.customerName,
    orderRef: ticket.orderRef,
    comment,
    kind: "ORDER" as const,
    status: ticket.status,
    at: new Date().toISOString(),
  };

  publish(RealtimeEvents.PICKUP_CALL_WAITER, callPayload);

  return Response.json(
    { ok: true, created, call: callPayload, assistance },
    { status: created ? 201 : 200 }
  );
}
