import type { Locale } from "@/i18n/config";
import type { MenuCategory } from "@/lib/demo-data";
import { prisma } from "@/lib/db";

const CATEGORY_EMOJI: Record<string, string> = {
  salads: "🥗",
  meats: "🥩",
  drinks: "🍹",
  starters: "🥗",
  mains: "🍔",
  whisky: "🥃",
  whiskey: "🥃",
  wine: "🍷",
  beer: "🍺",
  coffee: "☕",
};

function pickName(
  translations: { locale: string; name: string }[],
  locale: Locale
) {
  return (
    translations.find((t) => t.locale === locale)?.name ??
    translations.find((t) => t.locale === "en")?.name ??
    translations[0]?.name ??
    "Menu"
  );
}

function mapItems(
  items: {
    id: string;
    price: { toString(): string };
    imageUrl: string | null;
    allergens: unknown;
    route: string;
    available: boolean;
    translations: {
      locale: string;
      name: string;
      description: string | null;
    }[];
    additionals: {
      id: string;
      price: { toString(): string };
      active: boolean;
      translations: { locale: string; name: string }[];
    }[];
  }[],
  locale: Locale
) {
  return items.map((item) => {
    const itemTranslation =
      item.translations.find((t) => t.locale === locale) ??
      item.translations.find((t) => t.locale === "en") ??
      item.translations[0];

    return {
      id: item.id,
      name: itemTranslation?.name ?? "Item",
      description: itemTranslation?.description ?? "",
      price: item.price.toString(),
      imageUrl: item.imageUrl ?? undefined,
      allergens: Array.isArray(item.allergens) ? (item.allergens as string[]) : [],
      route: item.route as MenuCategory["items"][number]["route"],
      available: item.available,
      additionals: item.additionals
        .filter((a) => a.active)
        .map((a) => ({
          id: a.id,
          price: a.price.toString(),
          name:
            a.translations.find((t) => t.locale === locale)?.name ??
            a.translations.find((t) => t.locale === "en")?.name ??
            a.translations[0]?.name ??
            "Extra",
        })),
    };
  });
}

export async function getTableByToken(token: string) {
  return prisma.table.findUnique({
    where: { token },
    include: { venue: true },
  });
}

export async function getOrCreateSession(tableId: string, venueId: string, locale: Locale) {
  const existing = await prisma.session.findFirst({
    where: { tableId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });

  if (existing) return existing;

  return prisma.session.create({
    data: { tableId, venueId, locale, status: "OPEN" },
  });
}

export async function getMenuForVenue(venueId: string, locale: Locale): Promise<MenuCategory[]> {
  const categories = await prisma.menuCategory.findMany({
    where: { venueId, active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      translations: true,
      items: {
        where: { hidden: false },
        orderBy: { sortOrder: "asc" },
        include: {
          translations: true,
          additionals: {
            where: { active: true },
            orderBy: { sortOrder: "asc" },
            include: { translations: true },
          },
        },
      },
    },
  });

  const mapped = categories.map((cat) => {
    const name = pickName(cat.translations, locale);
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    return {
      id: cat.id,
      parentId: cat.parentId,
      name,
      emoji: CATEGORY_EMOJI[slug.split("-")[0]] ?? "🍽",
      items: mapItems(cat.items, locale),
    };
  });

  const childrenByParent = new Map<string, typeof mapped>();
  for (const cat of mapped) {
    if (!cat.parentId) continue;
    const list = childrenByParent.get(cat.parentId) ?? [];
    list.push(cat);
    childrenByParent.set(cat.parentId, list);
  }

  return mapped
    .filter((cat) => !cat.parentId)
    .map((cat) => {
      const children = (childrenByParent.get(cat.id) ?? [])
        .map(({ parentId: _p, ...child }) => child)
        .filter((c) => c.items.length > 0);
      return {
        id: cat.id,
        name: cat.name,
        emoji: cat.emoji,
        items: cat.items,
        children: children.length > 0 ? children : undefined,
      };
    })
    .filter((cat) => cat.items.length > 0 || (cat.children && cat.children.length > 0));
}
