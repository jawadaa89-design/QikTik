import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes("sk_test_...")) return null;
  if (!stripe) {
    // apiVersion pinned by installed stripe package typings
    stripe = new Stripe(key);
  }
  return stripe;
}

export function isStripeConfigured(): boolean {
  return getStripe() !== null;
}

export async function createPaymentIntent(opts: {
  amountIls: number;
  orderId: string;
  sessionId: string;
  currency?: string;
}): Promise<{ clientSecret: string | null; paymentIntentId: string | null; demo: boolean }> {
  const s = getStripe();
  if (!s) {
    return {
      clientSecret: `pi_demo_${opts.orderId}_secret`,
      paymentIntentId: `pi_demo_${opts.orderId}`,
      demo: true,
    };
  }

  const intent = await s.paymentIntents.create({
    amount: Math.round(opts.amountIls * 100),
    currency: (opts.currency ?? "ils").toLowerCase(),
    metadata: { orderId: opts.orderId, sessionId: opts.sessionId },
    automatic_payment_methods: { enabled: true },
  });

  return {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    demo: false,
  };
}
