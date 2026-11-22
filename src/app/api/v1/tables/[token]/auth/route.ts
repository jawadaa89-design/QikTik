import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const table = await prisma.table.findUnique({ where: { token } });
  if (!table) return apiError("TABLE_NOT_FOUND", "Invalid table token", 404);

  const session = await prisma.session.findFirst({
    where: { tableId: table.id, status: { in: ["OPEN", "BILL_REQUESTED"] } },
    orderBy: { openedAt: "desc" },
  });

  if (!session || !session.passcodeHash) {
    return Response.json({
      needsRegistration: true,
      needsUnlock: false,
      tableNumber: table.number,
      sessionId: session?.id ?? null,
      guestName: session?.guestName ?? null,
      passcodeReset: Boolean(session && !session.passcodeHash),
    });
  }

  return Response.json({
    needsRegistration: false,
    needsUnlock: true,
    tableNumber: table.number,
    sessionId: session.id,
    guestName: session.guestName,
  });
}
