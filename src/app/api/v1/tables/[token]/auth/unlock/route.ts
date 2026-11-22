import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { guestUnlockSchema } from "@/lib/guest-schemas";
import { verifyPasscode } from "@/lib/guest-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();
  const parsed = guestUnlockSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const table = await prisma.table.findUnique({ where: { token } });
  if (!table) return apiError("TABLE_NOT_FOUND", "Invalid table token", 404);

  const session = await prisma.session.findFirst({
    where: { tableId: table.id, status: { in: ["OPEN", "BILL_REQUESTED"] } },
    orderBy: { openedAt: "desc" },
  });

  if (!session?.passcodeHash) {
    return apiError("NOT_REGISTERED", "Register for this table first", 404);
  }

  if (!verifyPasscode(parsed.data.password, session.passcodeHash)) {
    return apiError("INVALID_PASSWORD", "Wrong table password", 401);
  }

  return Response.json({
    sessionId: session.id,
    guestName: session.guestName,
    tableNumber: table.number,
  });
}
