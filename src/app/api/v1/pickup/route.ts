import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { allocatePickupTicketRef } from "@/lib/pickup-refs";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { apiError, pickupRegisterSchema } from "@/lib/validation";
import { requireFeature } from "@/lib/features";
import { requireStaffVenue } from "@/lib/staff-auth";
import { requireVenue } from "@/lib/venue";
import { expireStaleStaffBoardItems } from "@/lib/pickup-expire";

export const dynamic = "force-dynamic";

function serializeTicket(ticket: {
  id: string;
  venueId: string;
  customerName: string;
  phone: string | null;
  orderRef: string | null;
  status: string;
  readyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: ticket.id,
    venueId: ticket.venueId,
    customerName: ticket.customerName,
    phone: ticket.phone,
    orderRef: ticket.orderRef,
    status: ticket.status,
    readyAt: ticket.readyAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

/**
 * POST /api/v1/pickup — guest registers for pickup-ready notification.
 * Requires name (+ optional phone). Assigns a short unique orderRef for staff/reconnect.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = pickupRegisterSchema.safeParse(body);
  if (!parsed.success) {
    const nameIssue = parsed.error.issues.find((i) => i.path[0] === "customerName");
    if (nameIssue) {
      return apiError("NAME_REQUIRED", "Name is required", 400);
    }
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const customerName = parsed.data.customerName.trim();
  if (!customerName) {
    return apiError("NAME_REQUIRED", "Name is required", 400);
  }

  const resolved = await requireVenue(req, { slug: parsed.data.venueSlug });
  if ("error" in resolved) return resolved.error;
  const { venue } = resolved;

  const blocked = await requireFeature("pickup", venue.id);
  if (blocked) return blocked;

  const phone = parsed.data.phone?.trim() || null;
  const nameKey = customerName.toLowerCase();

  // Same name + still active → reopen that ticket (no duplicate board row).
  const active = await prisma.pickupTicket.findMany({
    where: {
      venueId: venue.id,
      status: { in: ["WAITING", "READY"] },
    },
    orderBy: { createdAt: "desc" },
  });
  const existing =
    active.find((t) => t.customerName.trim().toLowerCase() === nameKey) ?? null;

  if (existing) {
    const ticket =
      phone && phone !== (existing.phone ?? "")
        ? await prisma.pickupTicket.update({
            where: { id: existing.id },
            data: { phone },
          })
        : existing;

    const payload = serializeTicket(ticket);
    publish(RealtimeEvents.PICKUP_UPDATED, payload);
    return Response.json({ ticket: payload, reconnected: true });
  }

  const orderRef = await allocatePickupTicketRef(venue.id);

  const ticket = await prisma.pickupTicket.create({
    data: {
      venueId: venue.id,
      customerName,
      phone,
      orderRef,
      status: "WAITING",
    },
  });

  const payload = serializeTicket(ticket);
  publish(RealtimeEvents.PICKUP_UPDATED, payload);

  return Response.json({ ticket: payload, reconnected: false }, { status: 201 });
}

/**
 * GET /api/v1/pickup?venue=&status=WAITING,READY — staff pickup queue.
 */
export async function GET(req: NextRequest) {
  const statusParam = req.nextUrl.searchParams.get("status");

  const resolved = await requireStaffVenue(req);
  if ("error" in resolved) return resolved.error;
  const { venue } = resolved;

  const blocked = await requireFeature("pickup", venue.id);
  if (blocked) return blocked;

  const allowed = new Set(["WAITING", "READY", "COMPLETED", "CANCELLED"]);
  const statuses = statusParam
    ? statusParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => allowed.has(s))
    : ["WAITING", "READY"];

  if (statuses.length === 0) {
    return apiError("VALIDATION_ERROR", "No valid status filters", 400);
  }

  try {
    await expireStaleStaffBoardItems({ venueId: venue.id });
  } catch {
    /* queue still returns if expire fails */
  }

  const tickets = await prisma.pickupTicket.findMany({
    where: {
      venueId: venue.id,
      status: { in: statuses as ("WAITING" | "READY" | "COMPLETED" | "CANCELLED")[] },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  return Response.json({
    venue: { id: venue.id, name: venue.name, slug: venue.slug },
    tickets: tickets.map(serializeTicket),
  });
}
