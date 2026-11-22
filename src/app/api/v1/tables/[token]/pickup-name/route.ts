import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { publish, RealtimeEvents } from "@/lib/realtime";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
});

/** Guest sets / updates pickup name on the open table session. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const table = await prisma.table.findUnique({ where: { token } });
  if (!table) return apiError("TABLE_NOT_FOUND", "Invalid table token", 404);

  const session = await prisma.session.findFirst({
    where: {
      tableId: table.id,
      status: { in: ["OPEN", "BILL_REQUESTED"] },
    },
    orderBy: { openedAt: "desc" },
  });

  if (!session) {
    return apiError("NO_SESSION", "No open session on this table", 400);
  }

  const guestName = parsed.data.name;

  await prisma.session.update({
    where: { id: session.id },
    data: { guestName },
  });

  publish(RealtimeEvents.SESSION_UPDATED, {
    sessionId: session.id,
    tableId: table.id,
    guestName,
  });

  return Response.json({
    ok: true,
    sessionId: session.id,
    guestName,
    tableNumber: table.number,
  });
}
