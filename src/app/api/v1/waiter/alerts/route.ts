import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { requireStaffVenue } from "@/lib/staff-auth";

export async function GET(req: NextRequest) {
  const resolved = await requireStaffVenue(req);
  if ("error" in resolved) return resolved.error;
  const { venue } = resolved;

  const section = req.nextUrl.searchParams.get("section");

  let tableFilter: {
    venueId: string;
    section?: "INSIDE" | "OUTSIDE" | "TERRACE";
  } = { venueId: venue.id };
  if (section && section !== "ALL") {
    tableFilter = {
      venueId: venue.id,
      section: section as "INSIDE" | "OUTSIDE" | "TERRACE",
    };
  }

  const tables = await prisma.table.findMany({
    where: tableFilter,
    select: { id: true },
  });

  const alerts = await prisma.waiterAlert.findMany({
    where: {
      read: false,
      tableId: { in: tables.map((t) => t.id) },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json({
    alerts: alerts.map((a) => ({
      id: a.id,
      tableId: a.tableId,
      sessionId: a.sessionId,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const resolved = await requireStaffVenue(req);
  if ("error" in resolved) return resolved.error;
  const { venue } = resolved;

  const body = await req.json();
  const id = body?.id as string | undefined;
  const tableId = body?.tableId as string | undefined;
  const type = body?.type as string | undefined;

  // Mark a single alert read (must belong to this venue’s table)
  if (id) {
    const alert = await prisma.waiterAlert.findFirst({
      where: { id, table: { venueId: venue.id } },
      select: { id: true },
    });
    if (!alert) return apiError("NOT_FOUND", "Alert not found", 404);
    await prisma.waiterAlert.update({
      where: { id: alert.id },
      data: { read: true },
    });
    return Response.json({ ok: true });
  }

  // Mark all unread alerts for a table (optionally filtered by type)
  if (tableId) {
    const table = await prisma.table.findFirst({
      where: { id: tableId, venueId: venue.id },
      select: { id: true },
    });
    if (!table) return apiError("TABLE_NOT_FOUND", "Table not found", 404);
    await prisma.waiterAlert.updateMany({
      where: {
        tableId: table.id,
        read: false,
        ...(type ? { type } : {}),
      },
      data: { read: true },
    });
    return Response.json({ ok: true });
  }

  return apiError("VALIDATION_ERROR", "id or tableId required", 400);
}
