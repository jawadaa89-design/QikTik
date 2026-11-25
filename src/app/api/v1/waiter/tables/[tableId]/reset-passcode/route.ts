import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { requireStaffSession } from "@/lib/staff-auth";

/** Clear table password so guest can register a new one (orders stay). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
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
  const denied = await requireStaffSession(req, table.venueId);
  if (denied) return denied;
  const session = table.sessions[0];
  if (!session) return apiError("NO_SESSION", "No open session", 400);

  await prisma.session.update({
    where: { id: session.id },
    data: { passcodeHash: null },
  });

  // Clear unread “forgot password” / call alerts for this table
  await prisma.waiterAlert.updateMany({
    where: { tableId, type: "WAITER_CALLED", read: false },
    data: { read: true },
  });

  publish(RealtimeEvents.SESSION_UPDATED, {
    sessionId: session.id,
    tableId,
    status: session.status,
    passcodeReset: true,
  });

  return Response.json({ ok: true, sessionId: session.id });
}
