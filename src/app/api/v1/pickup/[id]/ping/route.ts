import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { requireStaffSession } from "@/lib/staff-auth";
import { apiError } from "@/lib/validation";
import { requireFeature } from "@/lib/features";
import { sendPickupWebPush } from "@/lib/web-push";

export const dynamic = "force-dynamic";

/** Soft anti-spam: allow re-ping, but block rapid double-taps. */
const PING_COOLDOWN_MS = 2_500;
const lastPingByTicket = new Map<string, number>();

/**
 * POST /api/v1/pickup/:id/ping — staff actively nudge the waiting guest.
 * Publishes pickup:ping without changing ticket status.
 * Also sends Web Push when the guest subscribed (background / closed tab).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const { id } = await params;
  const ticket = await prisma.pickupTicket.findUnique({ where: { id } });
  if (!ticket) return apiError("NOT_FOUND", "Pickup ticket not found", 404);

  const blocked = await requireFeature("pickup", ticket.venueId);
  if (blocked) return blocked;

  if (ticket.status === "COMPLETED" || ticket.status === "CANCELLED") {
    return apiError("INVALID_STATUS", "Cannot ping a closed pickup ticket", 400);
  }

  const now = Date.now();
  const last = lastPingByTicket.get(id) ?? 0;
  if (now - last < PING_COOLDOWN_MS) {
    return apiError(
      "RATE_LIMITED",
      "Ping sent too recently — wait a moment, then try again",
      429
    );
  }
  lastPingByTicket.set(id, now);

  // Bump updatedAt so guest polling (multi-instance) can treat it as a re-ping.
  const touched = await prisma.pickupTicket.update({
    where: { id },
    data: { customerName: ticket.customerName },
  });

  const payload = {
    id: touched.id,
    customerName: touched.customerName,
    status: touched.status,
    orderRef: touched.orderRef,
    at: new Date(now).toISOString(),
  };

  publish(RealtimeEvents.PICKUP_PING, payload);

  // Web Push for background / closed PWA (in addition to SSE / in-page Notification).
  // Await every successful ping so re-ping also delivers when the guest is backgrounded.
  const push = await sendPickupWebPush({
    ticketId: ticket.id,
    customerName: ticket.customerName,
    kind: "ping",
  });

  console.info(
    `[pickup-ping] ticket=${ticket.id}`,
    `push.sent=${push.sent}`,
    `reason=${push.reason ?? "ok"}`,
    `tag=${push.tag ?? "-"}`,
    `host=${push.endpointHost ?? "-"}`
  );

  return Response.json({ ok: true, ping: payload, push });
}
