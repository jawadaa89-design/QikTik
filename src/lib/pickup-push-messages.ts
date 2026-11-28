/** Server-side push copy (guest may not have the waiting page open). */
export type PickupPushLocale = "en" | "ar" | "he" | "ru";

export const pickupPushMessages: Record<
  PickupPushLocale,
  {
    ready: { title: string; body: string };
    ping: { title: string; body: string };
    seen: { title: string; body: string };
  }
> = {
  en: {
    ready: {
      title: "Order ready",
      body: "{name}, your order is ready for pickup!",
    },
    ping: {
      title: "Pickup reminder",
      body: "{name}, come pick up your order!",
    },
    seen: {
      title: "Staff saw your call",
      body: "{name}, a waiter has seen your request and is coming.",
    },
  },
  ar: {
    ready: {
      title: "الطلب جاهز",
      body: "{name}، طلبك جاهز للاستلام!",
    },
    ping: {
      title: "تذكير بالاستلام",
      body: "{name}، تفضّل لاستلام طلبك!",
    },
    seen: {
      title: "رأى الطاقم طلبك",
      body: "{name}، رأى النادل طلبك وهو في الطريق.",
    },
  },
  he: {
    ready: {
      title: "ההזמנה מוכנה",
      body: "{name}, ההזמנה מוכנה לאיסוף!",
    },
    ping: {
      title: "תזכורת לאיסוף",
      body: "{name}, בואו לאסוף את ההזמנה!",
    },
    seen: {
      title: "הצוות ראה את הקריאה",
      body: "{name}, מלצר ראה את הבקשה ובדרך אליכם.",
    },
  },
  ru: {
    ready: {
      title: "Заказ готов",
      body: "{name}, ваш заказ готов к выдаче!",
    },
    ping: {
      title: "Напоминание о выдаче",
      body: "{name}, заберите заказ!",
    },
    seen: {
      title: "Персонал увидел вызов",
      body: "{name}, официант увидел ваш запрос и идёт к вам.",
    },
  },
};
