import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { apiError } from "@/lib/validation";
import { requireStaffSession } from "@/lib/staff-auth";
import {
  expandCategoryTranslations,
  expandItemTranslations,
  fillMissingCategoryTranslations,
  fillMissingItemTranslations,
} from "@/lib/translate";

function mapCategory(
  c: {
    id: string;
    parentId: string | null;
    active: boolean;
    sortOrder: number;
    translations: { locale: string; name: string }[];
    items: {
      id: string;
      sku: string | null;
      price: { toString(): string };
      route: string;
      available: boolean;
      hidden: boolean;
      allergens: unknown;
      imageUrl: string | null;
      translations: {
        locale: string;
        name: string;
        description: string | null;
      }[];
      additionals: {
        id: string;
        price: { toString(): string };
        active: boolean;
        sortOrder: number;
        translations: { locale: string; name: string }[];
      }[];
    }[];
  },
  locale: string
) {
  return {
    id: c.id,
    parentId: c.parentId,
    active: c.active,
    sortOrder: c.sortOrder,
    name:
      c.translations.find((t) => t.locale === locale)?.name ??
      c.translations[0]?.name ??
      "Category",
    translations: Object.fromEntries(c.translations.map((t) => [t.locale, t.name])),
    items: c.items.map((item) => ({
      id: item.id,
      sku: item.sku,
      price: item.price.toString(),
      route: item.route,
      available: item.available,
      hidden: item.hidden,
      allergens: Array.isArray(item.allergens) ? item.allergens : [],
      imageUrl: item.imageUrl,
      name:
        item.translations.find((t) => t.locale === locale)?.name ??
        item.translations[0]?.name ??
        "Item",
      description:
        item.translations.find((t) => t.locale === locale)?.description ?? "",
      translations: Object.fromEntries(
        item.translations.map((t) => [
          t.locale,
          { name: t.name, description: t.description },
        ])
      ),
      additionals: item.additionals.map((a) => ({
        id: a.id,
        price: a.price.toString(),
        active: a.active,
        name:
          a.translations.find((t) => t.locale === locale)?.name ??
          a.translations[0]?.name ??
          "Extra",
        translations: Object.fromEntries(
          a.translations.map((t) => [t.locale, t.name])
        ),
      })),
    })),
  };
}

export async function GET(req: NextRequest) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const locale = req.nextUrl.searchParams.get("locale") ?? "ar";
  const { requireVenue } = await import("@/lib/venue");
  const resolved = await requireVenue(req);
  if ("error" in resolved) return Response.json({ categories: [] });
  const { venue } = resolved;

  const categories = await prisma.menuCategory.findMany({
    where: { venueId: venue.id },
    orderBy: { sortOrder: "asc" },
    include: {
      translations: true,
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          translations: true,
          additionals: {
            orderBy: { sortOrder: "asc" },
            include: { translations: true },
          },
        },
      },
    },
  });

  return Response.json({
    categories: categories.map((c) => mapCategory(c, locale)),
  });
}

const routeEnum = z.enum(["MAIN_KITCHEN", "MEAT_KITCHEN", "BAR", "HOOKAH"]);

const createCategorySchema = z.object({
  type: z.literal("category"),
  parentId: z.string().min(1).nullable().optional(),
  active: z.boolean().optional(),
  translations: z
    .record(z.object({ name: z.string().min(1) }))
    .refine((t) => Object.keys(t).length > 0, "At least one translation required"),
});

const createItemSchema = z.object({
  type: z.literal("item").optional(),
  categoryId: z.string().min(1),
  price: z.string().min(1),
  available: z.boolean().optional(),
  hidden: z.boolean().optional(),
  route: routeEnum.optional(),
  translations: z
    .record(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .refine((t) => Object.keys(t).length > 0, "At least one translation required"),
});

const updateItemSchema = z
  .object({
    itemId: z.string().optional(),
    categoryId: z.string().optional(),
    price: z.string().optional(),
    available: z.boolean().optional(),
    hidden: z.boolean().optional(),
    route: routeEnum.optional(),
    imageUrl: z.string().nullable().optional(),
    translations: z
      .record(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
        })
      )
      .optional(),
  })
  .refine(
    (d) => Boolean(d.itemId) || (Boolean(d.categoryId) && d.hidden !== undefined),
    "itemId required, or categoryId + hidden for bulk hide"
  );

export async function POST(req: NextRequest) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const body = await req.json();

  if (body?.type === "category") {
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.message, 400);
    }

    const { requireVenue } = await import("@/lib/venue");
    const resolved = await requireVenue(req);
    if ("error" in resolved) {
      return apiError("NOT_FOUND", "Venue not found", 404);
    }
    const { venue } = resolved;

    const parentId = parsed.data.parentId ?? null;
    if (parentId) {
      const parent = await prisma.menuCategory.findFirst({
        where: { id: parentId, venueId: venue.id },
      });
      if (!parent) {
        return apiError("NOT_FOUND", "Parent category not found", 404);
      }
      if (parent.parentId) {
        return apiError(
          "VALIDATION_ERROR",
          "Sub-categories cannot have their own sub-categories",
          400
        );
      }
    }

    const maxSort = await prisma.menuCategory.aggregate({
      where: { venueId: venue.id, parentId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const translations = await expandCategoryTranslations(parsed.data.translations);

    const category = await prisma.menuCategory.create({
      data: {
        venueId: venue.id,
        parentId,
        active: parsed.data.active ?? true,
        sortOrder,
        translations: {
          create: Object.entries(translations).map(([locale, t]) => ({
            locale,
            name: t.name.trim(),
          })),
        },
      },
      include: { translations: true },
    });

    return Response.json({
      ok: true,
      category: {
        id: category.id,
        parentId: category.parentId,
        active: category.active,
        sortOrder: category.sortOrder,
        translations: Object.fromEntries(
          category.translations.map((t) => [t.locale, t.name])
        ),
      },
    });
  }

  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const { categoryId, price, available, hidden, route, translations } = parsed.data;

  const category = await prisma.menuCategory.findUnique({
    where: { id: categoryId },
  });
  if (!category) {
    return apiError("NOT_FOUND", "Category not found", 404);
  }

  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return apiError("VALIDATION_ERROR", "Invalid price", 400);
  }

  const maxSort = await prisma.menuItem.aggregate({
    where: { categoryId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const allTranslations = await expandItemTranslations(translations);

  const item = await prisma.menuItem.create({
    data: {
      categoryId,
      price,
      available: available ?? true,
      hidden: hidden ?? false,
      route: route ?? "MAIN_KITCHEN",
      sortOrder,
      translations: {
        create: Object.entries(allTranslations).map(([locale, t]) => ({
          locale,
          name: t.name.trim(),
          description: t.description?.trim() || null,
        })),
      },
    },
    include: { translations: true },
  });

  return Response.json({
    ok: true,
    item: {
      id: item.id,
      categoryId: item.categoryId,
      price: item.price.toString(),
      route: item.route,
      available: item.available,
      hidden: item.hidden,
      imageUrl: item.imageUrl,
      sortOrder: item.sortOrder,
    },
  });
}

const updateCategorySchema = z.object({
  type: z.literal("category"),
  categoryId: z.string().min(1),
  translations: z
    .record(z.object({ name: z.string().min(1) }))
    .refine((t) => Object.keys(t).length > 0, "At least one translation required"),
});

export async function PATCH(req: NextRequest) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const body = await req.json();

  if (body?.type === "category") {
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.message, 400);
    }

    const { categoryId, translations } = parsed.data;
    const category = await prisma.menuCategory.findUnique({
      where: { id: categoryId },
      include: { translations: true },
    });
    if (!category) {
      return apiError("NOT_FOUND", "Category not found", 404);
    }

    const existing = Object.fromEntries(
      category.translations.map((t) => [t.locale, { name: t.name }])
    );
    const { upserts, creates } = await fillMissingCategoryTranslations(
      existing,
      translations
    );

    for (const [locale, t] of Object.entries(upserts)) {
      await prisma.menuCategoryTranslation.upsert({
        where: { categoryId_locale: { categoryId, locale } },
        create: { categoryId, locale, name: t.name },
        update: { name: t.name },
      });
    }
    for (const [locale, t] of Object.entries(creates)) {
      await prisma.menuCategoryTranslation.upsert({
        where: { categoryId_locale: { categoryId, locale } },
        create: { categoryId, locale, name: t.name },
        update: {},
      });
    }

    return Response.json({ ok: true });
  }

  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const { itemId, categoryId, price, available, hidden, route, imageUrl, translations } =
    parsed.data;

  // Bulk hide / show every item in a category (+ direct children)
  if (categoryId && hidden !== undefined && !itemId) {
    const childIds = (
      await prisma.menuCategory.findMany({
        where: { parentId: categoryId },
        select: { id: true },
      })
    ).map((c) => c.id);
    const ids = [categoryId, ...childIds];
    const result = await prisma.menuItem.updateMany({
      where: { categoryId: { in: ids } },
      data: { hidden },
    });
    return Response.json({ ok: true, updated: result.count });
  }

  if (!itemId) {
    return apiError("VALIDATION_ERROR", "itemId is required", 400);
  }

  await prisma.menuItem.update({
    where: { id: itemId },
    data: {
      ...(price !== undefined ? { price } : {}),
      ...(available !== undefined ? { available } : {}),
      ...(hidden !== undefined ? { hidden } : {}),
      ...(route !== undefined ? { route } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
    },
  });

  if (translations) {
    const existingRows = await prisma.menuItemTranslation.findMany({
      where: { itemId },
    });
    const existing = Object.fromEntries(
      existingRows.map((t) => [
        t.locale,
        { name: t.name, description: t.description ?? "" },
      ])
    );
    const { upserts, creates } = await fillMissingItemTranslations(
      existing,
      translations
    );

    for (const [locale, t] of Object.entries(upserts)) {
      await prisma.menuItemTranslation.upsert({
        where: { itemId_locale: { itemId, locale } },
        create: {
          itemId,
          locale,
          name: t.name,
          description: t.description || null,
        },
        update: {
          name: t.name,
          description: t.description || null,
        },
      });
    }

    for (const [locale, t] of Object.entries(creates)) {
      await prisma.menuItemTranslation.upsert({
        where: { itemId_locale: { itemId, locale } },
        create: {
          itemId,
          locale,
          name: t.name,
          description: t.description || null,
        },
        update: {},
      });
    }
  }

  return Response.json({ ok: true });
}

const deleteSchema = z
  .object({
    itemId: z.string().min(1).optional(),
    categoryId: z.string().min(1).optional(),
  })
  .refine((d) => Boolean(d.itemId) || Boolean(d.categoryId), "itemId or categoryId required");

export async function DELETE(req: NextRequest) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const fromBody = deleteSchema.safeParse(body);
  const itemId =
    fromBody.success && fromBody.data.itemId
      ? fromBody.data.itemId
      : req.nextUrl.searchParams.get("itemId");
  const categoryId =
    fromBody.success && fromBody.data.categoryId
      ? fromBody.data.categoryId
      : req.nextUrl.searchParams.get("categoryId");

  if (categoryId) {
    const category = await prisma.menuCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      return apiError("NOT_FOUND", "Category not found", 404);
    }

    const childIds = (
      await prisma.menuCategory.findMany({
        where: { parentId: categoryId },
        select: { id: true },
      })
    ).map((c) => c.id);
    const ids = [categoryId, ...childIds];

    const orderedCount = await prisma.orderItem.count({
      where: { menuItem: { categoryId: { in: ids } } },
    });
    if (orderedCount > 0) {
      return apiError(
        "IN_USE",
        "This category has items that were ordered before and cannot be deleted. Hide items instead.",
        409
      );
    }

    await prisma.menuCategory.delete({ where: { id: categoryId } });
    return Response.json({ ok: true });
  }

  if (!itemId) {
    return apiError("VALIDATION_ERROR", "itemId or categoryId is required", 400);
  }

  const item = await prisma.menuItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      imageUrl: true,
      _count: { select: { orderItems: true } },
    },
  });

  if (!item) {
    return apiError("NOT_FOUND", "Item not found", 404);
  }

  if (item._count.orderItems > 0) {
    return apiError(
      "IN_USE",
      "This item was ordered before and cannot be deleted. Turn it Off instead.",
      409
    );
  }

  await prisma.menuItem.delete({ where: { id: itemId } });

  return Response.json({ ok: true });
}
