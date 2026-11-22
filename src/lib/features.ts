import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { resolveVenue as resolveVenueRecord } from "@/lib/venue";

/** Product features. Digital menu is always included in every package. */
export type FeatureKey = "digitalMenu" | "ordering" | "pickup";

export type PackageId =
  | "menu_only"
  | "menu_ordering"
  | "menu_pickup"
  | "full";

export type FeatureFlags = {
  digitalMenu: true;
  ordering: boolean;
  pickup: boolean;
};

export type ActivePackage = {
  id: PackageId;
  venueId: string | null;
  features: FeatureFlags;
};

export const PACKAGE_PRESETS: Record<
  PackageId,
  { features: FeatureFlags; labelKey: string }
> = {
  menu_only: {
    labelKey: "packageMenuOnly",
    features: { digitalMenu: true, ordering: false, pickup: false },
  },
  menu_ordering: {
    labelKey: "packageMenuOrdering",
    features: { digitalMenu: true, ordering: true, pickup: false },
  },
  menu_pickup: {
    labelKey: "packageMenuPickup",
    features: { digitalMenu: true, ordering: false, pickup: true },
  },
  full: {
    labelKey: "packageFull",
    features: { digitalMenu: true, ordering: true, pickup: true },
  },
};

/** Default = full product so existing demos keep working. */
export const DEFAULT_FEATURES: FeatureFlags = {
  digitalMenu: true,
  ordering: true,
  pickup: true,
};

export function featuresFromFlags(
  orderingEnabled: boolean,
  pickupEnabled: boolean
): FeatureFlags {
  return {
    digitalMenu: true,
    ordering: orderingEnabled,
    pickup: pickupEnabled,
  };
}

export function packageIdFromFeatures(features: FeatureFlags): PackageId {
  if (features.ordering && features.pickup) return "full";
  if (features.ordering) return "menu_ordering";
  if (features.pickup) return "menu_pickup";
  return "menu_only";
}

export function featuresFromPackageId(id: PackageId): FeatureFlags {
  return PACKAGE_PRESETS[id].features;
}

/** Active package for a venue (or the default / oldest venue). */
export async function getActivePackage(
  venueId?: string
): Promise<ActivePackage> {
  const venue = await resolveVenueRecord({ id: venueId });
  if (!venue) {
    return {
      id: packageIdFromFeatures(DEFAULT_FEATURES),
      venueId: null,
      features: DEFAULT_FEATURES,
    };
  }
  const features = featuresFromFlags(
    venue.orderingEnabled,
    venue.pickupEnabled
  );
  return {
    id: packageIdFromFeatures(features),
    venueId: venue.id,
    features,
  };
}

export async function getVenueFeatures(
  venueId?: string
): Promise<FeatureFlags> {
  const pkg = await getActivePackage(venueId);
  return pkg.features;
}

export async function hasFeature(
  feature: FeatureKey,
  venueId?: string
): Promise<boolean> {
  if (feature === "digitalMenu") return true;
  const features = await getVenueFeatures(venueId);
  return features[feature];
}

/**
 * For API routes: returns a 403 Response when the feature is off, else null.
 */
export async function requireFeature(
  feature: "ordering" | "pickup",
  venueId?: string
): Promise<Response | null> {
  if (await hasFeature(feature, venueId)) return null;
  return apiError(
    "FEATURE_DISABLED",
    feature === "ordering"
      ? "Ordering is not enabled for this venue"
      : "Pickup is not enabled for this venue",
    403
  );
}

export async function setVenueFeatures(
  input: { packageId: PackageId } | { ordering: boolean; pickup: boolean },
  venueId?: string
): Promise<ActivePackage> {
  const venue = await resolveVenueRecord({ id: venueId });
  if (!venue) {
    throw new Error("VENUE_NOT_FOUND");
  }

  const features =
    "packageId" in input
      ? featuresFromPackageId(input.packageId)
      : featuresFromFlags(input.ordering, input.pickup);

  const updated = await prisma.venue.update({
    where: { id: venue.id },
    data: {
      orderingEnabled: features.ordering,
      pickupEnabled: features.pickup,
    },
  });

  const next = featuresFromFlags(
    updated.orderingEnabled,
    updated.pickupEnabled
  );
  return {
    id: packageIdFromFeatures(next),
    venueId: updated.id,
    features: next,
  };
}
