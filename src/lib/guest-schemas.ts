import { z } from "zod";

export const guestRegisterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(20),
  password: z.string().min(4).max(32),
  locale: z.enum(["ar", "he", "en", "ru"]).default("ar"),
  acceptTerms: z.literal(true),
  marketingOptIn: z.boolean().optional().default(false),
});

export const guestUnlockSchema = z.object({
  password: z.string().min(4).max(32),
});
