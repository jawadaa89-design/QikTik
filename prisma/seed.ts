import { PrismaClient, StationRoute, DiningSection } from "@prisma/client";
import { generateTableToken } from "../src/lib/utils";

const prisma = new PrismaClient();

const DEMO_TOKEN = "t_table7demo2026";

type MenuSeed = {
  sku: string;
  price: string;
  route: StationRoute;
  sortOrder: number;
  names: Record<string, string>;
  descriptions: Record<string, string>;
  allergens?: string[];
  imageUrl?: string;
};

const categories: {
  key: string;
  sortOrder: number;
  names: Record<string, string>;
  items: MenuSeed[];
}[] = [
  {
    key: "salads",
    sortOrder: 1,
    names: { en: "Salads", ar: "سلطات", he: "סלטים", ru: "Салаты" },
    items: [
      {
        sku: "salad-house",
        price: "72.00",
        route: "MAIN_KITCHEN",
        sortOrder: 1,
        names: { en: "House Salad", ar: "سلطة البيت", he: "סלט הבית", ru: "Салат дома" },
        descriptions: {
          en: "House signature salad",
          ar: "سلطة البيت المميزة",
          he: "סלט חתימה של הבית",
          ru: "Фирменный салат",
        },
      },
      {
        sku: "tabbouleh",
        price: "52.00",
        route: "MAIN_KITCHEN",
        sortOrder: 2,
        names: { en: "Tabbouleh", ar: "تبولة", he: "טאבולה", ru: "Табуле" },
        descriptions: {
          en: "Parsley, tomato, bulgur, lemon",
          ar: "بقدونس، طماطم، برغل، ليمون",
          he: "פטרוזיליה, עגבניות, בורגול",
          ru: "Петрушка, томаты, булгур",
        },
      },
      {
        sku: "fattoush",
        price: "58.00",
        route: "MAIN_KITCHEN",
        sortOrder: 3,
        names: { en: "Fattoush", ar: "فتوش", he: "פתוש", ru: "Фаттуш" },
        descriptions: {
          en: "Crispy pita, sumac, fresh vegetables",
          ar: "خبز مقرمش، سماق، خضار طازجة",
          he: "פיתה פריכה, סומאק, ירקות",
          ru: "Хрустящий хлеб, сумах",
        },
      },
      {
        sku: "greek-salad",
        price: "62.00",
        route: "MAIN_KITCHEN",
        sortOrder: 4,
        allergens: ["dairy"],
        names: { en: "Greek Salad", ar: "سلطة يونانية", he: "סלט יווני", ru: "Греческий салат" },
        descriptions: {
          en: "Feta, olives, cucumber, tomato",
          ar: "جبنة فيتا، زيتون، خيار، طماطم",
          he: "פטה, זיתים, מלפפון",
          ru: "Фета, оливки, огурец",
        },
      },
    ],
  },
  {
    key: "meats",
    sortOrder: 2,
    names: { en: "Meats", ar: "لحوم", he: "בשרים", ru: "Мясо" },
    items: [
      {
        sku: "kebab-house",
        price: "90.00",
        route: "MEAT_KITCHEN",
        sortOrder: 1,
        names: { en: "House Kebab", ar: "كباب البيت", he: "קבב הבית", ru: "Кебаб дома" },
        descriptions: {
          en: "Charcoal grilled kebab",
          ar: "كباب مشوي على الفحم",
          he: "קבב על גחלים",
          ru: "Кебаб на углях",
        },
      },
      {
        sku: "entrecote",
        price: "169.00",
        route: "MEAT_KITCHEN",
        sortOrder: 2,
        names: { en: "Entrecote", ar: "أنتريكوت", he: "אנטריקוט", ru: "Антрекот" },
        descriptions: {
          en: "Premium cut, your choice of doneness",
          ar: "قطعة فاخرة، درجة استواء حسب الطلب",
          he: "נתח פרימיום, מידת עשייה לבחירה",
          ru: "Премиальный стейк",
        },
      },
      {
        sku: "fillet",
        price: "185.00",
        route: "MEAT_KITCHEN",
        sortOrder: 3,
        names: { en: "Beef Fillet", ar: "فيليه لحم", he: "פילה בקר", ru: "Филе говядины" },
        descriptions: {
          en: "Tender fillet steak",
          ar: "فيليه طري",
          he: "סטייק פילה רך",
          ru: "Нежный стейк",
        },
      },
      {
        sku: "mixed-grill",
        price: "128.00",
        route: "MEAT_KITCHEN",
        sortOrder: 4,
        names: { en: "Mixed Grill", ar: "مشاوي مشكلة", he: "מעורב גריל", ru: "Смешанный гриль" },
        descriptions: {
          en: "Kebab, chicken, lamb chops",
          ar: "كباب، دجاج، ريش غنم",
          he: "קבב, עוף, קצבות",
          ru: "Кебаб, курица, бараньи рёбра",
        },
      },
      {
        sku: "chicken-skewer",
        price: "78.00",
        route: "MEAT_KITCHEN",
        sortOrder: 5,
        names: { en: "Chicken Skewer", ar: "شيش دجاج", he: "שיש עוף", ru: "Куриный шашлык" },
        descriptions: {
          en: "Marinated chicken on charcoal",
          ar: "دجاج متبل على الفحم",
          he: "עוף מתובל על גחלים",
          ru: "Маринованная курица",
        },
      },
    ],
  },
  {
    key: "mains",
    sortOrder: 3,
    names: { en: "Mains & Sides", ar: "أطباق جانبية", he: "מנות עיקריות", ru: "Основные" },
    items: [
      {
        sku: "hummus",
        price: "42.00",
        route: "MAIN_KITCHEN",
        sortOrder: 1,
        names: { en: "Hummus", ar: "حمص", he: "חומוס", ru: "Хумус" },
        descriptions: {
          en: "Classic with olive oil",
          ar: "كلاسيك مع زيت زيتون",
          he: "קלאסי עם שמן זית",
          ru: "Классический с маслом",
        },
      },
      {
        sku: "fries",
        price: "32.00",
        route: "MAIN_KITCHEN",
        sortOrder: 2,
        names: { en: "French Fries", ar: "بطاطا مقلية", he: "צ'יפס", ru: "Картофель фри" },
        descriptions: {
          en: "Crispy fries",
          ar: "بطاطا مقرمشة",
          he: "צ'יפס פריך",
          ru: "Хрустящий картофель",
        },
      },
      {
        sku: "fish-day",
        price: "118.00",
        route: "MAIN_KITCHEN",
        sortOrder: 3,
        allergens: ["fish"],
        names: { en: "Fish of the Day", ar: "سمك اليوم", he: "דג היום", ru: "Рыба дня" },
        descriptions: {
          en: "Ask your waiter for today's catch",
          ar: "اسأل النادل عن سمك اليوم",
          he: "שאלו על דג היום",
          ru: "Уточните у официанта",
        },
      },
    ],
  },
  {
    key: "drinks",
    sortOrder: 4,
    names: { en: "Drinks", ar: "مشروبات", he: "משקאות", ru: "Напитки" },
    items: [
      {
        sku: "mojito",
        price: "49.00",
        route: "BAR",
        sortOrder: 1,
        names: { en: "Mojito", ar: "موهيتو", he: "מוחיטו", ru: "Мохито" },
        descriptions: {
          en: "Mint, lime, rum",
          ar: "نعناع، ليمون، روم",
          he: "נענע, ליים, רום",
          ru: "Мята, лайм, ром",
        },
      },
      {
        sku: "arak-house",
        price: "38.00",
        route: "BAR",
        sortOrder: 2,
        names: { en: "House Arak", ar: "عرق البيت", he: "ערק הבית", ru: "Арак дома" },
        descriptions: {
          en: "Classic arak with ice & water",
          ar: "عرق كلاسيك مع ثلج وماء",
          he: "ערק קלאסי עם קרח ומים",
          ru: "Классический арак",
        },
      },
      {
        sku: "fresh-lemonade",
        price: "28.00",
        route: "BAR",
        sortOrder: 3,
        names: { en: "Fresh Lemonade", ar: "ليمونادة", he: "לימונדה", ru: "Лимонад" },
        descriptions: {
          en: "Fresh squeezed",
          ar: "طازج معصور",
          he: "סחוט טרי",
          ru: "Свежевыжатый",
        },
      },
      {
        sku: "turkish-coffee",
        price: "22.00",
        route: "BAR",
        sortOrder: 4,
        names: { en: "Turkish Coffee", ar: "قهوة تركية", he: "קפה טורקי", ru: "Турецкий кофе" },
        descriptions: {
          en: "Traditional pot coffee",
          ar: "قهوة تقليدية",
          he: "קפה מסורתי",
          ru: "Традиционный кофе",
        },
      },
      {
        sku: "soft-drink",
        price: "16.00",
        route: "BAR",
        sortOrder: 5,
        names: { en: "Soft Drink", ar: "مشروب غازي", he: "שתייה קלה", ru: "Газировка" },
        descriptions: {
          en: "Cola / Sprite / Fanta",
          ar: "كولا / سبرايت / فانتا",
          he: "קולה / ספרייט / פאנטה",
          ru: "Кола / Спрайт / Фанта",
        },
      },
    ],
  },
  {
    key: "hookah",
    sortOrder: 5,
    names: { en: "Hookah", ar: "أراجيل", he: "נרגילות", ru: "Кальян" },
    items: [
      {
        sku: "hookah-apple",
        price: "85.00",
        route: "HOOKAH",
        sortOrder: 1,
        names: { en: "Apple Hookah", ar: "أرجيلة تفاح", he: "נרגילה תפוח", ru: "Кальян яблоко" },
        descriptions: {
          en: "Double apple — Outside & Terrace only",
          ar: "تفاح مزدوج — خارج وتراس فقط",
          he: "תפוח כפול — חוץ וטרסה בלבד",
          ru: "Двойное яблоко — только улица и терраса",
        },
      },
      {
        sku: "hookah-mint",
        price: "85.00",
        route: "HOOKAH",
        sortOrder: 2,
        names: { en: "Mint Hookah", ar: "أرجيلة نعناع", he: "נרגילה נענע", ru: "Кальян мята" },
        descriptions: {
          en: "Fresh mint — Outside & Terrace only",
          ar: "نعناع طازج — خارج وتراس فقط",
          he: "נענע טרייה — חוץ וטרסה בלבד",
          ru: "Свежая мята — только улица и терраса",
        },
      },
      {
        sku: "hookah-coal",
        price: "25.00",
        route: "HOOKAH",
        sortOrder: 3,
        names: { en: "Extra Coal", ar: "فحم إضافي", he: "פחם נוסף", ru: "Доп. уголь" },
        descriptions: {
          en: "Coal refill",
          ar: "تجديد فحم",
          he: "מילוי פחם",
          ru: "Добавка угля",
        },
      },
    ],
  },
];

const tablePlan: { section: DiningSection; numbers: number[] }[] = [
  { section: "INSIDE", numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { section: "OUTSIDE", numbers: [21, 22, 23, 24, 25, 26, 27, 28] },
  { section: "TERRACE", numbers: [31, 32, 33, 34, 35, 36] },
];

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.waiterAlert.deleteMany();
  await prisma.session.deleteMany();
  await prisma.menuItemTranslation.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategoryTranslation.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.table.deleteMany();
  await prisma.user.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.venue.deleteMany();

  const venue = await prisma.venue.create({
    data: {
      name: "My Restaurant",
      slug: "my-restaurant",
      currency: "ILS",
      defaultLocale: "ar",
      enabledLocales: ["ar", "en", "he", "ru"],
    },
  });

  // Demo password for all staff: qiktik2026 (bcrypt-free plain marker for local demo)
  const demoHash = "demo:qiktik2026";

  await prisma.user.createMany({
    data: [
      { venueId: venue.id, email: "admin@qiktik.local", name: "Admin", role: "ADMIN", passwordHash: demoHash },
      { venueId: venue.id, email: "manager@qiktik.local", name: "Manager", role: "MANAGER", passwordHash: demoHash },
      { venueId: venue.id, email: "waiter-inside@qiktik.local", name: "Waiter Inside", role: "WAITER", section: "INSIDE", passwordHash: demoHash },
      { venueId: venue.id, email: "waiter-outside@qiktik.local", name: "Waiter Outside", role: "WAITER", section: "OUTSIDE", passwordHash: demoHash },
      { venueId: venue.id, email: "waiter-terrace@qiktik.local", name: "Waiter Terrace", role: "WAITER", section: "TERRACE", passwordHash: demoHash },
      { venueId: venue.id, email: "kitchen-main@qiktik.local", name: "Main Kitchen", role: "KITCHEN", passwordHash: demoHash },
      { venueId: venue.id, email: "kitchen-meat@qiktik.local", name: "Meat Kitchen", role: "KITCHEN", passwordHash: demoHash },
      { venueId: venue.id, email: "kitchen-bar@qiktik.local", name: "Bar", role: "KITCHEN", passwordHash: demoHash },
    ],
  });

  for (const plan of tablePlan) {
    for (const number of plan.numbers) {
      const token = number === 7 ? DEMO_TOKEN : generateTableToken();
      await prisma.table.create({
        data: {
          venueId: venue.id,
          number,
          section: plan.section,
          token,
          status: number === 7 ? "ACTIVE" : "FREE",
        },
      });
    }
  }

  for (const cat of categories) {
    const category = await prisma.menuCategory.create({
      data: {
        venueId: venue.id,
        sortOrder: cat.sortOrder,
        active: true,
        translations: {
          create: Object.entries(cat.names).map(([locale, name]) => ({ locale, name })),
        },
      },
    });

    for (const item of cat.items) {
      await prisma.menuItem.create({
        data: {
          categoryId: category.id,
          sku: item.sku,
          price: item.price,
          imageUrl: item.imageUrl ?? `/menu/${item.sku}.jpg`,
          route: item.route,
          allergens: item.allergens ?? [],
          available: true,
          sortOrder: item.sortOrder,
          translations: {
            create: Object.entries(item.names).map(([locale, name]) => ({
              locale,
              name,
              description: item.descriptions[locale],
            })),
          },
        },
      });
    }
  }

  const tableCount = await prisma.table.count();
  const itemCount = await prisma.menuItem.count();

  console.log("\n✓ Demo venue seeded");
  console.log(`  Venue:   ${venue.name}`);
  console.log(`  Tables:  ${tableCount} (Inside/Outside/Terrace)`);
  console.log(`  Menu:    ${itemCount} items`);
  console.log(`  Demo:    Table 7 → ${DEMO_TOKEN}`);
  console.log("\n  Guest:   http://localhost:3000/ar/t/" + DEMO_TOKEN);
  console.log("  Kitchen: http://localhost:3000/kitchen?station=MAIN_KITCHEN");
  console.log("  Waiter:  http://localhost:3000/waiter?section=INSIDE");
  console.log("  Admin:   http://localhost:3000/admin");
  console.log("  Staff password (demo): qiktik2026\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
