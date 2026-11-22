import type { Locale } from "@/i18n/config";

export type MenuItemAdditional = {
  id: string;
  name: string;
  price: string;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl?: string;
  allergens: string[];
  route: "MAIN_KITCHEN" | "MEAT_KITCHEN" | "BAR" | "HOOKAH";
  available: boolean;
  additionals?: MenuItemAdditional[];
};

export type MenuCategory = {
  id: string;
  name: string;
  emoji: string;
  items: MenuItem[];
  children?: MenuCategory[];
};

/** Demo menu data — replaced by DB in production */
export const demoMenu: Record<Locale, MenuCategory[]> = {
  en: [
    {
      id: "starters",
      name: "Starters",
      emoji: "🥗",
      items: [
        {
          id: "s1",
          name: "Soup of the Day",
          description: "Chef's seasonal soup",
          price: "6.50",
          allergens: [],
          route: "MAIN_KITCHEN",
          available: true,
        },
      ],
    },
    {
      id: "mains",
      name: "Mains",
      emoji: "🍔",
      items: [
        {
          id: "m1",
          name: "Classic Burger",
          description: "Angus beef, cheddar, pickles, house sauce",
          price: "12.00",
          allergens: ["dairy", "gluten"],
          route: "MEAT_KITCHEN",
          available: true,
        },
        {
          id: "m2",
          name: "Fish & Chips",
          description: "Crispy cod, mushy peas, tartar sauce",
          price: "14.50",
          allergens: ["fish", "gluten"],
          route: "MAIN_KITCHEN",
          available: true,
        },
      ],
    },
    {
      id: "drinks",
      name: "Drinks",
      emoji: "🍺",
      items: [
        {
          id: "d1",
          name: "Local Ale",
          description: "Craft beer on tap",
          price: "5.00",
          allergens: ["gluten"],
          route: "BAR",
          available: true,
        },
      ],
    },
  ],
  ar: [
    {
      id: "starters",
      name: "المقبلات",
      emoji: "🥗",
      items: [
        {
          id: "m1",
          name: "برجر كلاسيك",
          description: "لحم أنغوس، جبنة شيدر، مخلل، صوص خاص",
          price: "12.00",
          allergens: ["dairy", "gluten"],
          route: "MAIN_KITCHEN",
          available: true,
        },
      ],
    },
    {
      id: "mains",
      name: "الأطباق الرئيسية",
      emoji: "🍔",
      items: [
        {
          id: "m2",
          name: "سمك وبطاطا",
          description: "سمك مقرمش مع البازلاء",
          price: "14.50",
          allergens: ["fish", "gluten"],
          route: "MAIN_KITCHEN",
          available: true,
        },
      ],
    },
    {
      id: "drinks",
      name: "المشروبات",
      emoji: "🍺",
      items: [
        {
          id: "d1",
          name: "بيرة محلية",
          description: "بيرة حرفية من الصنبور",
          price: "5.00",
          allergens: ["gluten"],
          route: "BAR",
          available: true,
        },
      ],
    },
  ],
  he: [
    {
      id: "mains",
      name: "מנות עיקריות",
      emoji: "🍔",
      items: [
        {
          id: "m1",
          name: "המבורגר קלאסי",
          description: "בקר אנגוס, צ'דר, חמוצים, רוטב הבית",
          price: "12.00",
          allergens: ["dairy", "gluten"],
          route: "MAIN_KITCHEN",
          available: true,
        },
      ],
    },
    {
      id: "drinks",
      name: "משקאות",
      emoji: "🍺",
      items: [
        {
          id: "d1",
          name: "בירה מקומית",
          description: "בירה מחבית",
          price: "5.00",
          allergens: ["gluten"],
          route: "BAR",
          available: true,
        },
      ],
    },
  ],
  ru: [
    {
      id: "mains",
      name: "Основные блюда",
      emoji: "🍔",
      items: [
        {
          id: "m1",
          name: "Классический бургер",
          description: "Говядина ангус, чеддер, соленья, соус",
          price: "12.00",
          allergens: ["dairy", "gluten"],
          route: "MAIN_KITCHEN",
          available: true,
        },
      ],
    },
    {
      id: "drinks",
      name: "Напитки",
      emoji: "🍺",
      items: [
        {
          id: "d1",
          name: "Местный эль",
          description: "Крафтовое пиво из кега",
          price: "5.00",
          allergens: ["gluten"],
          route: "BAR",
          available: true,
        },
      ],
    },
  ],
};

export const demoTable = {
  token: "demo-token",
  number: 12,
  venueName: "The Golden Pub",
};
