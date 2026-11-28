import { z } from "zod";

export const createSessionSchema = z.object({
  locale: z.enum(["en", "ar", "he", "ru"]),
});

/** Public menu → resolve table number to opaque token (Menu + ordering). */
export const resolveTableNumberSchema = z.object({
  tableNumber: z.coerce.number().int().min(1).max(9999),
  venueSlug: z.string().trim().min(1).max(64).optional(),
  locale: z.enum(["en", "ar", "he", "ru"]).optional(),
});

export const createOrderSchema = z.object({
  paymentMode: z.enum(["PAY_NOW", "ADD_TO_TAB"]),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().min(1).max(20),
        notes: z.string().max(200).optional(),
        additionalIds: z.array(z.string()).optional(),
        takeaway: z.boolean().optional(),
      })
    )
    .min(1),
  tipPct: z.number().min(0).max(30).optional(),
});

export const updateItemStatusSchema = z.object({
  status: z.enum(["RECEIVED", "PREPARING", "READY", "SERVED", "CANCELLED"]),
});

export const cashPaymentSchema = z.object({
  amount: z.string(),
  received: z.string(),
  tipAmount: z.string().optional().default("0"),
  closeSession: z.boolean().default(true),
});

export const cardPaymentSchema = z.object({
  amount: z.string(),
  tipAmount: z.string().optional().default("0"),
  closeSession: z.boolean().default(true),
  /** Last 4 digits or reference for waiter-run terminal */
  reference: z.string().max(40).optional(),
});

export const guestPaySchema = z.object({
  tipPct: z.number().min(0).max(30).optional(),
  tipAmount: z.string().optional(),
});

export const billActionSchema = z.object({
  action: z.enum(["request", "cancel"]),
});

/** Guest kiosk/phone registration for pickup-ready notifications. orderRef is assigned server-side. */
export const pickupRegisterSchema = z.object({
  customerName: z.string().trim().min(1).max(80),
  phone: z.string().max(40).optional(),
  venueSlug: z.string().trim().min(1).max(64).optional(),
});

/**
 * Guest reconnect: try active WAITING/READY by customer name first
 * (case-insensitive trim; most recent match wins). If no name match,
 * optional orderRef (assigned ticket #) is used as fallback.
 */
export const pickupLookupSchema = z.object({
  customerName: z.string().trim().min(1).max(80),
  orderRef: z.string().trim().min(1).max(32).optional(),
  venueSlug: z.string().trim().min(1).max(64).optional(),
});

/** Guest call-waiter / ask-bill from landing (no food ticket): name + optional comment; orderRef assigned server-side. */
export const pickupCallWaiterByRefSchema = z.object({
  customerName: z.string().trim().min(1).max(80),
  comment: z.string().trim().max(280).optional(),
  venueSlug: z.string().trim().min(1).max(64).optional(),
  /** Guest UI locale — used to localize the “bill requested” staff comment. */
  locale: z.enum(["en", "ar", "he", "ru"]).optional(),
  /** ASSISTANCE = call waiter; BILL = ask for the bill (staff queue + overlay). */
  reason: z.enum(["ASSISTANCE", "BILL"]).optional().default("ASSISTANCE"),
});

/** Optional comment when calling waiter from an existing ORDER pickup ticket. */
export const pickupCallWaiterOnTicketSchema = z.object({
  comment: z.string().trim().max(280).optional(),
});

export const pickupStatusUpdateSchema = z.object({
  status: z.enum(["WAITING", "READY", "COMPLETED", "CANCELLED"]),
});

export const pickupAssistanceStatusUpdateSchema = z.object({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "DONE"]),
});

export const waiterOrderSchema = z.object({
  locale: z.enum(["en", "ar", "he", "ru"]).default("ar"),
  /** Pickup / guest name for the table session (POS register) */
  guestName: z.string().trim().min(1).max(80).optional(),
  /** Required when any item is free or has a custom unit price */
  adminPassword: z.string().min(1).max(64).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().min(1).max(20),
        notes: z.string().max(200).optional(),
        takeaway: z.boolean().optional(),
        /** Complimentary — unit price becomes 0 (needs adminPassword) */
        free: z.boolean().optional(),
        /** Override menu unit price as decimal string (needs adminPassword) */
        unitPrice: z
          .string()
          .regex(/^\d+(\.\d{1,2})?$/)
          .optional(),
      })
    )
    .min(1),
});

export type ApiError = {
  error: { code: string; message: string };
};

export function apiError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } } satisfies ApiError, { status });
}
