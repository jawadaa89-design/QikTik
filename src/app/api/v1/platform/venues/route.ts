import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  featuresFromFlags,
  featuresFromPackageId,
  packageIdFromFeatures,
  type PackageId,
} from "@/lib/features";
import { apiError } from "@/lib/validation";
import { generateTableToken } from "@/lib/utils";
import {
  brandFromVenue,
  DEFAULT_VENUE_BRAND,
  normalizeHexColor,
} from "@/lib/venue-brand";
import { hashStaffPassword } from "@/lib/staff-auth";
import {
  venuePublicUrls,
  verifyPlatformPassword,
} from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

const hex = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{6}$/)
  .optional();

const createVenueSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, hyphens")
    .min(2)
    .max(48),
  packageId: z
    .enum(["menu_only", "menu_alerts", "menu_alerts_pickup", "menu_ordering"])
    .default("menu_only"),
  password: z.string().min(1),
  /** Staff / admin unlock password for this restaurant only */
  staffPassword: z.string().trim().min(4).max(72),
  accentColor: hex,
  backgroundColor: hex,
  surfaceColor: hex,
  textColor: hex,
});

/**
 * POST /api/v1/platform/venues — create a new restaurant (platform admin).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = createVenueSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  if (!(await verifyPlatformPassword(parsed.data.password))) {
    return apiError("UNAUTHORIZED", "Wrong platform password", 401);
  }

  const { name, slug, packageId } = parsed.data;
  const existing = await prisma.venue.findUnique({ where: { slug } });
  if (existing) {
    return apiError("SLUG_TAKEN", "That restaurant slug is already in use", 409);
  }

  const features = featuresFromPackageId(packageId as PackageId);
  const withHash = (v: string | undefined, fallback: string) =>
    normalizeHexColor(
      v ? (v.startsWith("#") ? v : `#${v}`) : fallback,
      fallback
    );

  const venue = await prisma.venue.create({
    data: {
      name,
      slug,
      currency: "ILS",
      defaultLocale: "ar",
      enabledLocales: ["ar", "en", "he", "ru"],
      alertsEnabled: features.alerts,
      orderingEnabled: features.ordering,
      pickupEnabled: features.pickup,
      accentColor: withHash(
        parsed.data.accentColor,
        DEFAULT_VENUE_BRAND.accentColor
      ),
      backgroundColor: withHash(
        parsed.data.backgroundColor,
        DEFAULT_VENUE_BRAND.backgroundColor
      ),
      surfaceColor: withHash(
        parsed.data.surfaceColor,
        DEFAULT_VENUE_BRAND.surfaceColor
      ),
      textColor: withHash(parsed.data.textColor, DEFAULT_VENUE_BRAND.textColor),
    },
  });

  // Stub a few tables so ordering package can resolve table numbers immediately.
  await prisma.table.createMany({
    data: [1, 2, 3, 4, 5, 6, 7].map((number) => ({
      venueId: venue.id,
      number,
      section: "INSIDE" as const,
      token: generateTableToken(),
      status: "FREE" as const,
    })),
  });

  await prisma.user.create({
    data: {
      venueId: venue.id,
      email: `admin@${slug}.local`,
      name: "Admin",
      role: "ADMIN",
      passwordHash: hashStaffPassword(parsed.data.staffPassword),
    },
  });

  return Response.json(
    {
      venue: {
        id: venue.id,
        name: venue.name,
        slug: venue.slug,
        packageId,
        branding: brandFromVenue(venue),
        urls: venuePublicUrls(slug),
      },
    },
    { status: 201 }
  );
}

/** GET — list venues (platform password via ?password= or header). */
export async function GET(req: NextRequest) {
  const password =
    req.nextUrl.searchParams.get("password") ||
    req.headers.get("x-platform-password") ||
    "";
  if (!(await verifyPlatformPassword(password))) {
    return apiError("UNAUTHORIZED", "Wrong platform password", 401);
  }

  const venues = await prisma.venue.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      alertsEnabled: true,
      orderingEnabled: true,
      pickupEnabled: true,
      logoUrl: true,
      accentColor: true,
      backgroundColor: true,
      surfaceColor: true,
      textColor: true,
      createdAt: true,
    },
  });

  return Response.json({
    venues: venues.map((v) => {
      const packageId = packageIdFromFeatures(
        featuresFromFlags(v.alertsEnabled, v.orderingEnabled, v.pickupEnabled)
      );
      return {
        id: v.id,
        name: v.name,
        slug: v.slug,
        packageId,
        alertsEnabled: v.alertsEnabled,
        orderingEnabled: v.orderingEnabled,
        pickupEnabled: v.pickupEnabled,
        branding: brandFromVenue(v),
        createdAt: v.createdAt.toISOString(),
        urls: venuePublicUrls(v.slug),
      };
    }),
  });
}
