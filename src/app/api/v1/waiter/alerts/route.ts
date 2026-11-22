import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { requireStaffSession } from "@/lib/staff-auth";

export async function GET(req: NextRequest) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const section = req.nextUrl.searchParams.get("section");

  let tableFilter: { section?: "INSIDE" | "OUTSIDE" | "TERRACE" } = {};
  if (section && section !== "ALL") {
    tableFilter = { section: section as "INSIDE" | "OUTSIDE" | "TERRACE" };
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
  const denied = await requireStaffSession();
  if (denied) return denied;

  const body = await req.json();
  const id = body?.id as string | undefined;
  const tableId = body?.tableId as string | undefined;
  const type = body?.type as string | undefined;

  // Mark a single alert read
  if (id) {
    await prisma.waiterAlert.update({
      where: { id },
      data: { read: true },
    });
    return Response.json({ ok: true });
  }

  // Mark all unread alerts for a table (optionally filtered by type)
  if (tableId) {
    await prisma.waiterAlert.updateMany({
      where: {
        tableId,
        read: false,
        ...(type ? { type } : {}),
      },
      data: { read: true },
    });
    return Response.json({ ok: true });
  }

  return apiError("VALIDATION_ERROR", "id or tableId required", 400);
}
