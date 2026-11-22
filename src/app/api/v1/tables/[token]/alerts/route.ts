import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { suppressPartySizeAlert } from "@/lib/party-size";
import { z } from "zod";

const schema = z.object({
  type: z.enum(["WAITER_CALLED", "BILL_REQUESTED"]),
  /** Guest intends to settle with cash — waiter sees bill request */
  payWith: z.enum(["cash"]).optional(),
  /** Tip guest already chose (optional); stored for waiter cash collection */
  tipAmount: z.string().optional(),
  /** Extra context for waiter call */
  reason: z.enum(["forgot_password"]).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const table = await prisma.table.findUnique({ where: { token } });
  if (!table) return apiError("TABLE_NOT_FOUND", "Invalid table token", 404);

  const session = await prisma.session.findFirst({
    where: { tableId: table.id, status: { in: ["OPEN", "BILL_REQUESTED"] } },
    orderBy: { openedAt: "desc" },
  });

  if (parsed.data.type === "BILL_REQUESTED") {
    await prisma.table.update({
      where: { id: table.id },
      data: { status: "BILL_REQUESTED" },
    });
    if (session) {
      let requestedTip: string | null | undefined = undefined;
      if (parsed.data.tipAmount != null && parsed.data.tipAmount !== "") {
        const tip = parseFloat(parsed.data.tipAmount);
        requestedTip = Number.isNaN(tip) || tip < 0 ? "0.00" : tip.toFixed(2);
      }

      await prisma.session.update({
        where: { id: session.id },
        data: {
          status: "BILL_REQUESTED",
          ...(requestedTip !== undefined ? { requestedTip } : {}),
        },
      });
    }
  }

  const tipNum =
    parsed.data.tipAmount != null && parsed.data.tipAmount !== ""
      ? parseFloat(parsed.data.tipAmount)
      : NaN;
  const tipLabel =
    !Number.isNaN(tipNum) && tipNum > 0
      ? ` · tip ₪${tipNum.toFixed(2)}`
      : !Number.isNaN(tipNum) && tipNum === 0
        ? " · no tip"
        : "";

  const waiterMessage =
    parsed.data.type === "WAITER_CALLED"
      ? parsed.data.reason === "forgot_password"
        ? `Table ${table.number} forgot password — please reset`
        : `Table ${table.number} called waiter`
      : parsed.data.payWith === "cash"
        ? `Table ${table.number} wants to pay cash${tipLabel}`
        : `Table ${table.number} requested bill${tipLabel}`;

  // Avoid duplicate unread alerts of the same type for this table
  const existing = await prisma.waiterAlert.findFirst({
    where: {
      tableId: table.id,
      type: parsed.data.type,
      read: false,
    },
  });

  const alert =
    existing ??
    (await prisma.waiterAlert.create({
      data: {
        tableId: table.id,
        sessionId: session?.id,
        type: parsed.data.type,
        message: waiterMessage,
      },
    }));

  await suppressPartySizeAlert(table.id);

  // Refresh message if guest calls again (e.g. forgot password while already called)
  if (existing && parsed.data.type === "WAITER_CALLED") {
    await prisma.waiterAlert.update({
      where: { id: existing.id },
      data: { message: waiterMessage },
    });
  }

  // Refresh tip message if re-requesting cash bill
  if (
    existing &&
    parsed.data.type === "BILL_REQUESTED" &&
    parsed.data.payWith === "cash"
  ) {
    await prisma.waiterAlert.update({
      where: { id: existing.id },
      data: { message: waiterMessage },
    });
  }

  if (!existing) {
    publish(RealtimeEvents.ALERT_NEW, {
      alertId: alert.id,
      tableId: table.id,
      type: parsed.data.type,
    });
  }

  publish(RealtimeEvents.SESSION_UPDATED, {
    sessionId: session?.id,
    tableId: table.id,
    status: parsed.data.type === "BILL_REQUESTED" ? "BILL_REQUESTED" : session?.status,
  });

  return Response.json({ ok: true, alertId: alert.id }, { status: existing ? 200 : 201 });
}
