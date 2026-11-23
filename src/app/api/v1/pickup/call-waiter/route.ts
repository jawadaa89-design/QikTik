import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { allocateAssistanceOrderRef } from "@/lib/pickup-refs";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { apiError, pickupCallWaiterByRefSchema } from "@/lib/validation";
import { hasFeature } from "@/lib/features";
import { requireVenue } from "@/lib/venue";

export const dynamic = "force-dynamic";

/** Same cooldown as POST /api/v1/pickup/:id/call-waiter. */
const CALL_COOLDOWN_MS = 15_000;
/** Keyed by venueId:normalizedName so repeat landing calls share a cooldown. */
const lastCallByKey = new Map<string, number>();

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
 * POST /api/v1/pickup/call-waiter — call waiter from landing (no order ticket).
 * Creates/updates a PickupAssistanceCall in the dedicated assistance queue (not food pickup).
 * Assigns a short W-## orderRef for the staff board.
 * Publishes pickup:call-waiter SSE + pickup:assistance-updated for the staff board.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = pickupCallWaiterByRefSchema.safeParse(body);
  if (!parsed.success) {
    const nameIssue = parsed.error.issues.find((i) => i.path[0] === "customerName");
    if (nameIssue) {
      return apiError("NAME_REQUIRED", "Name is required", 400);
    }
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const customerName = parsed.data.customerName.trim();
  const comment = parsed.data.comment?.trim() || null;
  if (!customerName) {
    return apiError("NAME_REQUIRED", "Name is required", 400);
  }

  const resolved = await requireVenue(req, { slug: parsed.data.venueSlug });
  if ("error" in resolved) return resolved.error;
  const { venue } = resolved;

  // Menu+alerts (no pickup) and pickup packages both allow venue-wide waiter calls.
  const alertsOn = await hasFeature("alerts", venue.id);
  const pickupOn = await hasFeature("pickup", venue.id);
  if (!alertsOn && !pickupOn) {
    return apiError(
      "FEATURE_DISABLED",
      "Waiter alerts are not enabled for this venue",
      403
    );
  }

  const cooldownKey = `${venue.id}:${customerName.toLowerCase()}`;
  const now = Date.now();
  const last = lastCallByKey.get(cooldownKey) ?? 0;
  if (now - last < CALL_COOLDOWN_MS) {
    const retryAfterSec = Math.ceil((CALL_COOLDOWN_MS - (now - last)) / 1000);
    return apiError(
      "RATE_LIMITED",
      `Please wait ${retryAfterSec}s before calling again`,
      429
    );
  }

  // Reuse an active assistance call for the same guest name instead of stacking OPEN rows.
  let call = await prisma.pickupAssistanceCall.findFirst({
    where: {
      venueId: venue.id,
      customerName,
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  let created = false;

  if (!call) {
    const orderRef = await allocateAssistanceOrderRef(venue.id);
    call = await prisma.pickupAssistanceCall.create({
      data: {
        venueId: venue.id,
        customerName,
        orderRef,
        comment,
        status: "OPEN",
      },
    });
    created = true;
  } else {
    call = await prisma.pickupAssistanceCall.update({
      where: { id: call.id },
      data: {
        customerName,
        comment,
        // Re-open if staff had only acknowledged — guest is calling again.
        status: "OPEN",
      },
    });
  }

  lastCallByKey.set(cooldownKey, now);

  const assistance = serializeAssistance(call);
  publish(RealtimeEvents.PICKUP_ASSISTANCE_UPDATED, assistance);

  const callPayload = {
    id: call.id,
    customerName: call.customerName,
    orderRef: call.orderRef,
    comment: call.comment,
    kind: "ASSISTANCE" as const,
    status: call.status,
    at: new Date().toISOString(),
  };

  publish(RealtimeEvents.PICKUP_CALL_WAITER, callPayload);

  return Response.json(
    { ok: true, created, call: callPayload, assistance },
    { status: created ? 201 : 200 }
  );
}
