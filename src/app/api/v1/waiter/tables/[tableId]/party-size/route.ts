import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { clearPartySizeAlert } from "@/lib/party-size";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { requireStaffSession } from "@/lib/staff-auth";

const schema = z.object({
  partySize: z.number().int().min(1).max(99),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const { tableId } = await params;
  const parsed = schema.safeParse(await req.json());
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
  const session = table.sessions[0];
  if (!session) return apiError("NO_SESSION", "No open session", 400);

  await prisma.session.update({
    where: { id: session.id },
    data: { partySize: parsed.data.partySize },
  });
  await clearPartySizeAlert(tableId);

  publish(RealtimeEvents.SESSION_UPDATED, {
    sessionId: session.id,
    tableId,
    partySize: parsed.data.partySize,
  });

  return Response.json({ ok: true, partySize: parsed.data.partySize });
}
