import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, pickupLookupSchema } from "@/lib/validation";
import { requireFeature } from "@/lib/features";
import { requireVenue } from "@/lib/venue";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["WAITING", "READY"] as const;

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

/** Normalize guest-entered ticket # so "5" matches stored "05". */
function normalizeOrderRef(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{1}$/.test(trimmed)) return trimmed.padStart(2, "0");
  return trimmed;
}

/**
 * POST /api/v1/pickup/lookup — reconnect to an active ticket.
 * Tries customer name first; if no match and orderRef provided, looks up by ticket #.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = pickupLookupSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("NAME_REQUIRED", "Name is required", 400);
  }

  const customerName = parsed.data.customerName.trim();
  if (!customerName) {
    return apiError("NAME_REQUIRED", "Name is required", 400);
  }

  const orderRefRaw = parsed.data.orderRef?.trim() || "";
  const orderRef = orderRefRaw ? normalizeOrderRef(orderRefRaw) : "";

  const resolved = await requireVenue(req, { slug: parsed.data.venueSlug });
  if ("error" in resolved) return resolved.error;
  const { venue } = resolved;

  const blocked = await requireFeature("pickup", venue.id);
  if (blocked) return blocked;

  const nameKey = customerName.toLowerCase();

  // Filter active tickets in-process (case-insensitive name; small queue).
  // Prefer most recent match when several share a name.
  const candidates = await prisma.pickupTicket.findMany({
    where: {
      venueId: venue.id,
      status: { in: [...ACTIVE_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });

  const byName =
    candidates.find((t) => t.customerName.trim().toLowerCase() === nameKey) ?? null;

  if (byName) {
    return Response.json({ ticket: serializeTicket(byName) });
  }

  if (!orderRef) {
    return apiError(
      "NAME_NOT_FOUND_TICKET_REQUIRED",
      "No active pickup ticket found for that name — ticket number required",
      404
    );
  }

  const byRef =
    candidates.find(
      (t) => t.orderRef != null && t.orderRef.trim() === orderRef
    ) ?? null;

  if (!byRef) {
    return apiError(
      "NOT_FOUND",
      "No active pickup ticket found for that name or ticket number",
      404
    );
  }

  return Response.json({ ticket: serializeTicket(byRef) });
}
