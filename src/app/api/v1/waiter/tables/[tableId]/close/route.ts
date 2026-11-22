import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { partySizeRequiredResponse } from "@/lib/party-size";
import { requireStaffSession } from "@/lib/staff-auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const { tableId } = await params;

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
  const session = table.sessions[0];
  if (!session) return apiError("NO_SESSION", "No open session", 400);

  const blocked = partySizeRequiredResponse(session.partySize);
  if (blocked) return blocked;

  await prisma.session.update({
    where: { id: session.id },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  await prisma.table.update({
    where: { id: tableId },
    data: { status: "FREE" },
  });
  await prisma.waiterAlert.updateMany({
    where: { tableId, read: false },
    data: { read: true },
  });

  publish(RealtimeEvents.SESSION_UPDATED, { sessionId: session.id, tableId, status: "CLOSED" });

  return Response.json({ closed: true });
}
