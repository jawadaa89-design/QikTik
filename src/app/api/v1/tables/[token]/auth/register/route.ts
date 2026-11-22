import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { guestRegisterSchema } from "@/lib/guest-schemas";
import { hashPasscode } from "@/lib/guest-auth";
import { ensurePartySizeAlert, missingPartySize } from "@/lib/party-size";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();
  const parsed = guestRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const table = await prisma.table.findUnique({ where: { token } });
  if (!table) return apiError("TABLE_NOT_FOUND", "Invalid table token", 404);
  if (table.status === "DISABLED") {
    return apiError("TABLE_DISABLED", "Table is disabled", 400);
  }

  const existing = await prisma.session.findFirst({
    where: { tableId: table.id, status: { in: ["OPEN", "BILL_REQUESTED"] } },
    orderBy: { openedAt: "desc" },
  });

  // Table already secured — must unlock with existing password
  if (existing?.passcodeHash) {
    return apiError(
      "ALREADY_REGISTERED",
      "This table already has a guest session. Enter the table password to continue.",
      409
    );
  }

  const passcodeHash = hashPasscode(parsed.data.password);

  let session;
  if (existing) {
    session = await prisma.session.update({
      where: { id: existing.id },
      data: {
        guestName: parsed.data.name,
        guestPhone: parsed.data.phone,
        passcodeHash,
        locale: parsed.data.locale,
        marketingOptIn: parsed.data.marketingOptIn ?? false,
      },
    });
  } else {
    session = await prisma.session.create({
      data: {
        tableId: table.id,
        venueId: table.venueId,
        locale: parsed.data.locale,
        status: "OPEN",
        guestName: parsed.data.name,
        guestPhone: parsed.data.phone,
        passcodeHash,
        marketingOptIn: parsed.data.marketingOptIn ?? false,
      },
    });
  }

  if (table.status === "FREE") {
    await prisma.table.update({
      where: { id: table.id },
      data: { status: "ACTIVE" },
    });
  }

  if (missingPartySize(session.partySize)) {
    await ensurePartySizeAlert(table.id, session.id);
  }

  return Response.json(
    {
      sessionId: session.id,
      guestName: session.guestName,
      tableNumber: table.number,
    },
    { status: 201 }
  );
}
