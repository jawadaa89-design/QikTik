/**
 * Seed Coffee Up menu from https://www.coffeeup.online/menu (ar / en / he).
 * Replaces only that venue's categories/items — owner can edit afterward in Admin.
 *
 *   npx tsx prisma/seed-coffee-up-menu.ts
 */
import { PrismaClient, StationRoute } from "@prisma/client";

const prisma = new PrismaClient();
const VENUE_SLUG = "coffee-up";

type ItemSeed = {
  sku: string;
  price: string;
  route: StationRoute;
  sortOrder: number;
  names: Record<string, string>;
  descriptions: Record<string, string>;
};

type CatSeed = {
  sortOrder: number;
  names: Record<string, string>;
  items: ItemSeed[];
};

/** Source: coffeeup.online/menu — EN / ع / ע */
const categories: CatSeed[] = [
  {
    sortOrder: 1,
    names: {
      en: "Hot Drinks",
      ar: "مشروبات ساخنة",
      he: "משקאות חמים",
      ru: "Горячие напитки",
    },
    items: [
      {
        sku: "cu-espresso",
        price: "8.00",
        route: "BAR",
        sortOrder: 1,
        names: {
          en: "Espresso",
          ar: "إسبريسو",
          he: "אספרסו",
          ru: "Эспрессо",
        },
        descriptions: {
          en: "A short, concentrated shot of freshly brewed coffee.",
          ar: "جرعة مركزة من القهوة الطازجة.",
          he: "שוט קצר ומרוכז של קפה טרי.",
          ru: "Короткий концентрированный шот свежесваренного кофе.",
        },
      },
      {
        sku: "cu-espresso-double",
        price: "10.00",
        route: "BAR",
        sortOrder: 2,
        names: {
          en: "Double Espresso",
          ar: "إسبريسو مزدوج",
          he: "אספרסו כפול",
          ru: "Двойной эспрессо",
        },
        descriptions: {
          en: "Two rich, concentrated shots of espresso.",
          ar: "جرعتان من الإسبريسو بطعم غني ومركز.",
          he: "שתי מנות אספרסו בטעם עשיר ומרוכז.",
          ru: "Два насыщенных концентрированных шота эспрессо.",
        },
      },
      {
        sku: "cu-cappuccino",
        price: "14.00",
        route: "BAR",
        sortOrder: 3,
        names: {
          en: "Cappuccino",
          ar: "كابتشينو",
          he: "הפוך (Cappuccino)",
          ru: "Капучино",
        },
        descriptions: {
          en: "Espresso with steamed milk and a soft layer of foam.",
          ar: "إسبريسو مع الحليب المبخر وطبقة خفيفة من الرغوة.",
          he: "אספרסו עם חלב מאודה ושכבת קצף עדינה.",
          ru: "Эспрессо с вспененным молоком и мягкой пенкой.",
        },
      },
      {
        sku: "cu-americano",
        price: "10.00",
        route: "BAR",
        sortOrder: 4,
        names: {
          en: "Americano",
          ar: "أمريكانو",
          he: "אמריקנו",
          ru: "Американо",
        },
        descriptions: {
          en: "Espresso topped with hot water.",
          ar: "إسبريسو يضاف إليه الماء الساخن.",
          he: "אספרסו בתוספת מים חמים.",
          ru: "Эспрессо с добавлением горячей воды.",
        },
      },
      {
        sku: "cu-ilan",
        price: "12.00",
        route: "BAR",
        sortOrder: 5,
        names: {
          en: "Ilan",
          ar: "إيلان",
          he: "אילן",
          ru: "Илан",
        },
        descriptions: {
          en: "A shot of espresso with steamed milk and a thick layer of foam.",
          ar: "جرعة إسبريسو مع حليب مبخر وطبقة كثيفة من الرغوة.",
          he: "שוט אספרסו עם חלב מאודה ושכבה עבה של קצף.",
          ru: "Шот эспрессо с вспененным молоком и плотной пенкой.",
        },
      },
      {
        sku: "cu-matcha",
        price: "22.00",
        route: "BAR",
        sortOrder: 6,
        names: {
          en: "Matcha",
          ar: "ماتشا",
          he: "Matcha",
          ru: "Матча",
        },
        descriptions: {
          en: "Whisked green tea with a smooth, earthy flavor.",
          ar: "شاي أخضر مخفوق بقوام ناعم ونكهة عشبية.",
          he: "תה ירוק מוקצף עם טעם עדין ואדמתי.",
          ru: "Взбитый зелёный чай с мягким землистым вкусом.",
        },
      },
      {
        sku: "cu-nescafe",
        price: "12.00",
        route: "BAR",
        sortOrder: 7,
        names: {
          en: "Nescafe",
          ar: "نسكافيه",
          he: "נסקפה",
          ru: "Nescafe",
        },
        descriptions: {
          en: "Classic instant coffee prepared with hot water.",
          ar: "قهوة سريعة التحضير محضّرة بالماء الساخن.",
          he: "קפה נמס קלאסי שמוכן עם מים חמים.",
          ru: "Классический растворимый кофе на горячей воде.",
        },
      },
      {
        sku: "cu-hot-chocolate",
        price: "12.00",
        route: "BAR",
        sortOrder: 8,
        names: {
          en: "Hot Chocolate",
          ar: "شوكولاتة ساخنة",
          he: "שוקו",
          ru: "Горячий шоколад",
        },
        descriptions: {
          en: "A warm, rich drink with a smooth chocolate flavor.",
          ar: "مشروب دافئ غني بنكهة الشوكولاتة.",
          he: "משקה שוקולד חם ועשיר.",
          ru: "Тёплый насыщенный напиток с шоколадным вкусом.",
        },
      },
      {
        sku: "cu-tea",
        price: "9.00",
        route: "BAR",
        sortOrder: 9,
        names: {
          en: "Tea",
          ar: "شاي",
          he: "תה",
          ru: "Чай",
        },
        descriptions: {
          en: "Freshly brewed tea, served hot.",
          ar: "شاي محضّر طازجاً ويقدم ساخناً.",
          he: "תה טרי המוגש חם.",
          ru: "Свежезаваренный чай, подаётся горячим.",
        },
      },
    ],
  },
  {
    sortOrder: 2,
    names: {
      en: "Cold Drinks",
      ar: "مشروبات باردة",
      he: "משקאות קרים",
      ru: "Холодные напитки",
    },
    items: [
      {
        sku: "cu-iced-coffee",
        price: "18.00",
        route: "BAR",
        sortOrder: 1,
        names: {
          en: "Iced Coffee",
          ar: "قهوة باردة",
          he: "קפה קר",
          ru: "Холодный кофе",
        },
        descriptions: {
          en: "Chilled coffee served over ice.",
          ar: "قهوة مبردة تقدم مع الثلج.",
          he: "קפה מצונן המוגש עם קרח.",
          ru: "Охлаждённый кофе со льдом.",
        },
      },
      {
        sku: "cu-iced-americano",
        price: "14.00",
        route: "BAR",
        sortOrder: 2,
        names: {
          en: "Iced Americano",
          ar: "أمريكانو بارد",
          he: "אמריקנו קר",
          ru: "Холодный американо",
        },
        descriptions: {
          en: "Espresso mixed with cold water and ice.",
          ar: "إسبريسو مع الماء البارد والثلج.",
          he: "אספרסו עם מים קרים וקרח.",
          ru: "Эспрессо с холодной водой и льдом.",
        },
      },
      {
        sku: "cu-mocktails",
        price: "15.00",
        route: "BAR",
        sortOrder: 3,
        names: {
          en: "Mocktails",
          ar: "موكتيلات",
          he: "מוקטיילים",
          ru: "Моктейли",
        },
        descriptions: {
          en: "Refreshing mixed drinks made without alcohol.",
          ar: "مشروبات منعشة ممزوجة من دون كحول.",
          he: "משקאות מעורבבים ומרעננים ללא אלכוהול.",
          ru: "Освежающие безалкогольные миксы.",
        },
      },
    ],
  },
  {
    sortOrder: 3,
    names: {
      en: "Desserts",
      ar: "حلويات",
      he: "קינוחים",
      ru: "Десерты",
    },
    items: [
      {
        sku: "cu-affogato",
        price: "27.00",
        route: "MAIN_KITCHEN",
        sortOrder: 1,
        names: {
          en: "Affogato",
          ar: "أفوجاتو",
          he: "אפוגאטו",
          ru: "Аффогато",
        },
        descriptions: {
          en: "Hot espresso poured over a scoop of ice cream.",
          ar: "إسبريسو ساخن يسكب فوق مغرفة من الآيس كريم.",
          he: "אספרסו חם שנמזג על כדור גלידה.",
          ru: "Горячий эспрессо, политый поверх шарика мороженого.",
        },
      },
      {
        sku: "cu-tiramisu",
        price: "28.00",
        route: "MAIN_KITCHEN",
        sortOrder: 2,
        names: {
          en: "Tiramisu",
          ar: "تيراميسو",
          he: "טירמיסו",
          ru: "Тирамису",
        },
        descriptions: {
          en: "Layers of coffee-soaked biscuits and mascarpone cream.",
          ar: "طبقات من البسكويت والقهوة وكريمة الماسكاربوني.",
          he: "שכבות של בישקוטים, קפה וקרם מסקרפונה.",
          ru: "Слои печенья, кофе и крема маскарпоне.",
        },
      },
    ],
  },
];

async function main() {
  const venue = await prisma.venue.findUnique({ where: { slug: VENUE_SLUG } });
  if (!venue) {
    throw new Error(`Venue "${VENUE_SLUG}" not found`);
  }

  await prisma.menuCategory.deleteMany({ where: { venueId: venue.id } });

  let itemCount = 0;
  for (const cat of categories) {
    const category = await prisma.menuCategory.create({
      data: {
        venueId: venue.id,
        sortOrder: cat.sortOrder,
        active: true,
        translations: {
          create: Object.entries(cat.names).map(([locale, name]) => ({
            locale,
            name,
          })),
        },
      },
    });

    for (const item of cat.items) {
      await prisma.menuItem.create({
        data: {
          categoryId: category.id,
          sku: item.sku,
          price: item.price,
          route: item.route,
          allergens: [],
          available: true,
          hidden: false,
          sortOrder: item.sortOrder,
          translations: {
            create: Object.entries(item.names).map(([locale, name]) => ({
              locale,
              name,
              description: item.descriptions[locale] ?? null,
            })),
          },
        },
      });
      itemCount += 1;
    }
  }

  // Keep guest locales aligned with the source menu languages (+ ru for app).
  const locales = Array.from(
    new Set([...(venue.enabledLocales || []), "ar", "en", "he", "ru"])
  );
  await prisma.venue.update({
    where: { id: venue.id },
    data: {
      defaultLocale: venue.defaultLocale || "ar",
      enabledLocales: locales,
    },
  });

  console.log(`✓ Coffee Up menu seeded`);
  console.log(`  Venue: ${venue.name} (${venue.slug})`);
  console.log(`  Categories: ${categories.length}`);
  console.log(`  Items: ${itemCount}`);
  console.log(`  Guest: https://app.qiktik.tech/r/coffee-up/ar/menu`);
  console.log(`  Admin: https://app.qiktik.tech/r/coffee-up/admin`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
