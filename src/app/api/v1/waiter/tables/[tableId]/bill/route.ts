import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { billActionSchema, apiError } from "@/lib/validation";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { suppressPartySizeAlert } from "@/lib/party-size";
import { requireStaffSession } from "@/lib/staff-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
    const { tableId } = await params;
  const body = await req.json();
  const parsed = billActionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      sessions: {
        where: { status: { in: ["OPEN", "BILL_REQUESTED"] } },
        orderBy: { openedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!table) return apiError("TABLE_NOT_FOUND", "Table not found", 404);
  const denied = await requireStaffSession(req, table.venueId);
  if (denied) return denied;
  const session = table.sessions[0];

  if (parsed.data.action === "request") {
    if (!session) return apiError("NO_SESSION", "No open session", 400);

    await prisma.table.update({
      where: { id: tableId },
      data: { status: "BILL_REQUESTED" },
    });
    await prisma.session.update({
      where: { id: session.id },
      data: { status: "BILL_REQUESTED" },
    });
    await suppressPartySizeAlert(tableId);
    await prisma.waiterAlert.create({
      data: {
        tableId,
        sessionId: session.id,
        type: "BILL_REQUESTED",
        message: `Table ${table.number} — bill requested by waiter`,
      },
    });

    publish(RealtimeEvents.ALERT_NEW, { tableId, type: "BILL_REQUESTED" });
    publish(RealtimeEvents.SESSION_UPDATED, {
      sessionId: session.id,
      tableId,
      status: "BILL_REQUESTED",
    });

    return Response.json({ ok: true, status: "BILL_REQUESTED" });
  }

  // cancel / stop bill — always clear table bill state (even if session already gone)
  const nextTableStatus = session ? "ACTIVE" : "FREE";
  await prisma.table.update({
    where: { id: tableId },
    data: { status: nextTableStatus },
  });

  if (session) {
    await prisma.session.update({
      where: { id: session.id },
      data: { status: "OPEN" },
    });
    publish(RealtimeEvents.SESSION_UPDATED, {
      sessionId: session.id,
      tableId,
      status: "OPEN",
    });
  }

  await prisma.waiterAlert.updateMany({
    where: { tableId, type: "BILL_REQUESTED", read: false },
    data: { read: true },
  });

  return Response.json({ ok: true, status: nextTableStatus });
}
