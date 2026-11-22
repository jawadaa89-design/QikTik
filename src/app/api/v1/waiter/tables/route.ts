import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { DiningSection } from "@prisma/client";
import { requireStaffSession } from "@/lib/staff-auth";
import {
  hasHigherPriorityFloorAlert,
  maybeRemindPartySizeAlert,
  missingPartySize,
} from "@/lib/party-size";

export async function GET(req: NextRequest) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const section = req.nextUrl.searchParams.get("section") as DiningSection | "ALL" | null;

  const tables = await prisma.table.findMany({
    where: {
      status: { not: "DISABLED" },
      ...(section && section !== "ALL" ? { section } : {}),
    },
    include: {
      sessions: {
        where: { status: { in: ["OPEN", "BILL_REQUESTED"] } },
        orderBy: { openedAt: "desc" },
        take: 1,
        include: {
          orders: {
            where: { status: { not: "CANCELLED" } },
            include: { items: true, payment: true },
          },
        },
      },
    },
    orderBy: { number: "asc" },
  });

  const tableIds = tables.map((t) => t.id);
  const alerts = await prisma.waiterAlert.findMany({
    where: { tableId: { in: tableIds }, read: false },
    orderBy: { createdAt: "desc" },
  });

  const alertsByTable = new Map<string, typeof alerts>();
  for (const a of alerts) {
    const list = alertsByTable.get(a.tableId) ?? [];
    list.push(a);
    alertsByTable.set(a.tableId, list);
  }

  const mapped = [];

  for (const table of tables) {
    const session = table.sessions[0] ?? null;

    let status = table.status;
    if (status === "BILL_REQUESTED" && !session) {
      status = "FREE";
      void prisma.table.update({
        where: { id: table.id },
        data: { status: "FREE" },
      });
      void prisma.waiterAlert.updateMany({
        where: { tableId: table.id, type: "BILL_REQUESTED", read: false },
        data: { read: true },
      });
    }

    let tabBalance = 0;
    let hasReady = false;
    if (session) {
      for (const order of session.orders) {
        if (order.paymentMode === "ADD_TO_TAB" && !order.payment) {
          tabBalance += Number(order.subtotal);
        }
        if (order.items.some((i) => i.status === "READY")) hasReady = true;
      }
    }

    const tableAlerts = alertsByTable.get(table.id) ?? [];
    const waiterCalled = tableAlerts.some((a) => a.type === "WAITER_CALLED");
    const billRequested =
      status === "BILL_REQUESTED" || session?.status === "BILL_REQUESTED";
    const needsParty = Boolean(session && missingPartySize(session.partySize));
    const higherPriority = hasHigherPriorityFloorAlert({
      billRequested,
      waiterCalled,
      hasReady,
    });

    let showPartySizeAlert = false;
    if (session) {
      const reminded = await maybeRemindPartySizeAlert(table.id, session.id, {
        needsParty,
        higherPriority,
      });
      showPartySizeAlert = reminded.showPartySizeAlert;
    }

    mapped.push({
      id: table.id,
      number: table.number,
      section: table.section,
      token: table.token,
      status,
      sessionId: session?.id ?? null,
      sessionStatus: session?.status ?? null,
      guestName: session?.guestName ?? null,
      partySize: session?.partySize ?? null,
      needsPartySize: needsParty,
      requestedTip:
        session?.requestedTip != null ? Number(session.requestedTip).toFixed(2) : null,
      tabBalance: tabBalance.toFixed(2),
      hasReady,
      waiterCalled,
      partySizeAlert: showPartySizeAlert,
      billRequested,
      alertCount: tableAlerts.filter((a) => a.type !== "PARTY_SIZE").length +
        (showPartySizeAlert ? 1 : 0),
    });
  }

  const freshAlerts = await prisma.waiterAlert.findMany({
    where: { tableId: { in: tableIds }, read: false },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({
    section: section ?? "ALL",
    tables: mapped,
    alerts: freshAlerts.map((a) => ({
      id: a.id,
      tableId: a.tableId,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}
