import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { requireStaffSession } from "@/lib/staff-auth";

const schema = z.object({
  guestName: z.string().trim().min(1).max(80),
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

  const guestName = parsed.data.guestName;

  await prisma.session.update({
    where: { id: session.id },
    data: { guestName },
  });

  publish(RealtimeEvents.SESSION_UPDATED, {
    sessionId: session.id,
    tableId,
    guestName,
  });

  return Response.json({ ok: true, guestName });
}
