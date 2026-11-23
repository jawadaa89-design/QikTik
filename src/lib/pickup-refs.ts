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

/** Pick a random unused 3-digit value from 100–999. */
function pickUnusedThreeDigit(used: Set<string>): string | null {
  for (let attempt = 0; attempt < 64; attempt++) {
    const orderRef = String(randomInt(100, 1000));
    if (!used.has(orderRef)) return orderRef;
  }
  return null;
}

async function loadUsedTicketRefs(venueId: string): Promise<Set<string>> {
  const active = await prisma.pickupTicket.findMany({
    where: {
      venueId,
      status: { in: [...ACTIVE_TICKET_STATUSES] },
      orderRef: { not: null },
    },
    select: { orderRef: true },
  });
  return new Set(
    active.map((t) => t.orderRef).filter((ref): ref is string => Boolean(ref))
  );
}

/**
 * Guest ticket #: prefer 2 digits (01–99) while any of those slots are free.
 * Once all 01–99 are held by active WAITING/READY tickets (or parallel load
 * fills them), allocate 3 digits (100–999). Safe to call under concurrency —
 * callers should create the row soon after; rare races get a unique fallback.
 */
export async function allocatePickupTicketRef(venueId: string): Promise<string> {
  // Re-read a few times so parallel registrants don’t all grab the same free slot.
  for (let round = 0; round < 4; round++) {
    const used = await loadUsedTicketRefs(venueId);

    const twoDigit = pickUnusedTwoDigit(used);
    if (twoDigit) return twoDigit;

    // More than 99 active 2-digit tickets — use 3 digits.
    const threeDigit = pickUnusedThreeDigit(used);
    if (threeDigit) return threeDigit;
  }

  return `T-${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

/**
 * Assistance queue ref like W-12 (2 digits), unique among open/acknowledged calls.
 * If every W-01–W-99 slot is busy, expands to W-100–W-999.
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
