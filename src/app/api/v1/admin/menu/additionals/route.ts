import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { requireStaffSession } from "@/lib/staff-auth";
import {
  expandCategoryTranslations,
  fillMissingCategoryTranslations,
} from "@/lib/translate";

const createSchema = z.object({
  itemId: z.string().min(1),
  price: z.string().min(1),
  translations: z
    .record(z.object({ name: z.string().min(1) }))
    .refine((t) => Object.keys(t).length > 0, "At least one translation required"),
});

const updateSchema = z.object({
  id: z.string().min(1),
  price: z.string().optional(),
  active: z.boolean().optional(),
  translations: z.record(z.object({ name: z.string().min(1) })).optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const { itemId, price, translations } = parsed.data;
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return apiError("VALIDATION_ERROR", "Invalid price", 400);
  }

  const item = await prisma.menuItem.findUnique({
    where: { id: itemId },
    include: { category: { select: { venueId: true } } },
  });
  if (!item) return apiError("NOT_FOUND", "Item not found", 404);
  const denied = await requireStaffSession(req, item.category.venueId);
  if (denied) return denied;

  const maxSort = await prisma.menuItemAdditional.aggregate({
    where: { itemId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
  const allTranslations = await expandCategoryTranslations(translations);

  const additional = await prisma.menuItemAdditional.create({
    data: {
      itemId,
      price,
      sortOrder,
      active: true,
      translations: {
        create: Object.entries(allTranslations).map(([locale, t]) => ({
          locale,
          name: t.name.trim(),
        })),
      },
    },
    include: { translations: true },
  });

  return Response.json({
    ok: true,
    additional: {
      id: additional.id,
      itemId: additional.itemId,
      price: additional.price.toString(),
      active: additional.active,
      translations: Object.fromEntries(
        additional.translations.map((t) => [t.locale, t.name])
      ),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const { id, price, active, translations } = parsed.data;
  const existing = await prisma.menuItemAdditional.findUnique({
    where: { id },
    include: {
      translations: true,
      item: { include: { category: { select: { venueId: true } } } },
    },
  });
  if (!existing) return apiError("NOT_FOUND", "Additional not found", 404);
  const denied = await requireStaffSession(req, existing.item.category.venueId);
  if (denied) return denied;

  if (price !== undefined) {
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return apiError("VALIDATION_ERROR", "Invalid price", 400);
    }
  }

  await prisma.menuItemAdditional.update({
    where: { id },
    data: {
      ...(price !== undefined ? { price } : {}),
      ...(active !== undefined ? { active } : {}),
    },
  });

  if (translations) {
    const current = Object.fromEntries(
      existing.translations.map((t) => [t.locale, { name: t.name }])
    );
    const { upserts, creates } = await fillMissingCategoryTranslations(
      current,
      translations
    );
    for (const [locale, t] of Object.entries(upserts)) {
      await prisma.menuItemAdditionalTranslation.upsert({
        where: { additionalId_locale: { additionalId: id, locale } },
        create: { additionalId: id, locale, name: t.name },
        update: { name: t.name },
      });
    }
    for (const [locale, t] of Object.entries(creates)) {
      await prisma.menuItemAdditionalTranslation.upsert({
        where: { additionalId_locale: { additionalId: id, locale } },
        create: { additionalId: id, locale, name: t.name },
        update: {},
      });
    }
  }

  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  const id =
    parsed.success ? parsed.data.id : req.nextUrl.searchParams.get("id");
  if (!id) return apiError("VALIDATION_ERROR", "id is required", 400);

  const existing = await prisma.menuItemAdditional.findUnique({
    where: { id },
    include: { item: { include: { category: { select: { venueId: true } } } } },
  });
  if (!existing) return apiError("NOT_FOUND", "Additional not found", 404);
  const denied = await requireStaffSession(req, existing.item.category.venueId);
  if (denied) return denied;

  await prisma.menuItemAdditional.delete({ where: { id } });
  return Response.json({ ok: true });
}
