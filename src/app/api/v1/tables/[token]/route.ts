import { NextRequest } from "next/server";
import { createSessionSchema, apiError } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { getOrCreateSession, getTableByToken } from "@/lib/menu-service";
import type { Locale } from "@/i18n/config";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const table = await getTableByToken(token);

  if (!table) {
    return apiError("TABLE_NOT_FOUND", "Invalid table token", 404);
  }

  const session = await prisma.session.findFirst({
    where: { tableId: table.id, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });

  return Response.json({
    table: { id: table.id, number: table.number, status: table.status, section: table.section },
    session: session ? { id: session.id, status: session.status } : null,
    venue: {
      name: table.venue.name,
      currency: table.venue.currency,
      enabledLocales: Array.isArray(table.venue.enabledLocales)
        ? table.venue.enabledLocales
        : ["ar", "en", "he", "ru"],
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();
  const parsed = createSessionSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const table = await getTableByToken(token);
  if (!table) {
    return apiError("TABLE_NOT_FOUND", "Invalid table token", 404);
  }

  const session = await getOrCreateSession(
    table.id,
    table.venueId,
    parsed.data.locale as Locale
  );

  if (table.status === "FREE") {
    await prisma.table.update({
      where: { id: table.id },
      data: { status: "ACTIVE" },
    });
  }

  return Response.json(
    {
      sessionId: session.id,
      tableNumber: table.number,
      locale: session.locale,
    },
    { status: 201 }
  );
}
