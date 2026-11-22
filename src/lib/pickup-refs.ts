import { randomInt } from "crypto";
import { prisma } from "@/lib/db";

const ACTIVE_TICKET_STATUSES = ["WAITING", "READY"] as const;
const ACTIVE_ASSISTANCE_STATUSES = ["OPEN", "ACKNOWLEDGED"] as const;

const TWO_DIGIT_MIN = 1;
const TWO_DIGIT_MAX = 99;

function formatTwoDigit(n: number): string {
  return String(n).padStart(2, "0");
}

/** Pick a random unused value from 01–99; null if every slot is taken. */
function pickUnusedTwoDigit(used: Set<string>): string | null {
  const free: string[] = [];
  for (let n = TWO_DIGIT_MIN; n <= TWO_DIGIT_MAX; n++) {
    const ref = formatTwoDigit(n);
    if (!used.has(ref)) free.push(ref);
  }
  if (free.length === 0) return null;
  return free[randomInt(free.length)]!;
}

/**
 * 2-digit guest ticket # (01–99), unique among active WAITING/READY tickets.
 * If every 2-digit slot is busy, expands slightly to 100–999.
 */
export async function allocatePickupTicketRef(venueId: string): Promise<string> {
  const active = await prisma.pickupTicket.findMany({
    where: {
      venueId,
      status: { in: [...ACTIVE_TICKET_STATUSES] },
      orderRef: { not: null },
    },
    select: { orderRef: true },
  });
  const used = new Set(
    active.map((t) => t.orderRef).filter((ref): ref is string => Boolean(ref))
  );

  const twoDigit = pickUnusedTwoDigit(used);
  if (twoDigit) return twoDigit;

  // All 01–99 held by active tickets — expand slightly.
  for (let attempt = 0; attempt < 32; attempt++) {
    const orderRef = String(randomInt(100, 1000));
    if (!used.has(orderRef)) return orderRef;
  }

  return `T-${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

/**
 * Assistance queue ref like W-12 (2 digits), unique among open/acknowledged calls.
 * If every W-01–W-99 slot is busy, expands slightly to W-100–W-999.
 */
export async function allocateAssistanceOrderRef(venueId: string): Promise<string> {
  const active = await prisma.pickupAssistanceCall.findMany({
    where: {
      venueId,
      status: { in: [...ACTIVE_ASSISTANCE_STATUSES] },
    },
    select: { orderRef: true },
  });
  const used = new Set(active.map((c) => c.orderRef));

  const free: string[] = [];
  for (let n = TWO_DIGIT_MIN; n <= TWO_DIGIT_MAX; n++) {
    const orderRef = `W-${formatTwoDigit(n)}`;
    if (!used.has(orderRef)) free.push(orderRef);
  }
  if (free.length > 0) return free[randomInt(free.length)]!;

  for (let attempt = 0; attempt < 32; attempt++) {
    const orderRef = `W-${randomInt(100, 1000)}`;
    if (!used.has(orderRef)) return orderRef;
  }

  return `W-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}
