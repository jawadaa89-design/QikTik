import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { resolveVenue as resolveVenueRecord } from "@/lib/venue";

/** Product features. Digital menu is always included in every package. */
export type FeatureKey = "digitalMenu" | "alerts" | "ordering" | "pickup";

/**
 * Packages (admin):
 * - Menu only → guest home = digital menu
 * - Menu + alerts → menu + call waiter on the menu
 * - Menu + alerts + pickup → menu + pickup register CTA on the menu + alerts
 * - Menu + ordering → menu + table number / table QR ordering
 *
 * Guest entry is always the menu URL. Pickup is not a separate guest link.
 */
export type PackageId =
  | "menu_only"
  | "menu_alerts"
  | "menu_alerts_pickup"
  | "menu_ordering";

export type FeatureFlags = {
  digitalMenu: true;
  alerts: boolean;
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
    features: {
      digitalMenu: true,
      alerts: false,
      ordering: false,
      pickup: false,
    },
  },
  menu_alerts: {
    labelKey: "packageMenuAlerts",
    features: {
      digitalMenu: true,
      alerts: true,
      ordering: false,
      pickup: false,
    },
  },
  menu_alerts_pickup: {
    labelKey: "packageMenuAlertsPickup",
    features: {
      digitalMenu: true,
      alerts: true,
      ordering: false,
      pickup: true,
    },
  },
  menu_ordering: {
    labelKey: "packageMenuOrdering",
    features: {
      digitalMenu: true,
      alerts: true,
      ordering: true,
      pickup: false,
    },
  },
};

/** Default demo package: table ordering + alerts. */
export const DEFAULT_FEATURES: FeatureFlags = {
  digitalMenu: true,
  alerts: true,
  ordering: true,
  pickup: false,
};

export function featuresFromFlags(
  alertsEnabled: boolean,
  orderingEnabled: boolean,
  pickupEnabled: boolean
): FeatureFlags {
  return {
    digitalMenu: true,
    // Ordering / pickup always imply waiter alerts.
    alerts: alertsEnabled || orderingEnabled || pickupEnabled,
    ordering: orderingEnabled,
    pickup: pickupEnabled,
  };
}

export function packageIdFromFeatures(features: FeatureFlags): PackageId {
  if (features.ordering) return "menu_ordering";
  if (features.pickup) return "menu_alerts_pickup";
  if (features.alerts) return "menu_alerts";
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
    venue.alertsEnabled,
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
  feature: "alerts" | "ordering" | "pickup",
  venueId?: string
): Promise<Response | null> {
  if (await hasFeature(feature, venueId)) return null;
  const message =
    feature === "ordering"
      ? "Ordering is not enabled for this venue"
      : feature === "pickup"
        ? "Pickup is not enabled for this venue"
        : "Waiter alerts are not enabled for this venue";
  return apiError("FEATURE_DISABLED", message, 403);
}

export async function setVenueFeatures(
  input:
    | { packageId: PackageId }
    | { alerts: boolean; ordering: boolean; pickup: boolean },
  venueId?: string
): Promise<ActivePackage> {
  const venue = await resolveVenueRecord({ id: venueId });
  if (!venue) {
    throw new Error("VENUE_NOT_FOUND");
  }

  const features =
    "packageId" in input
      ? featuresFromPackageId(input.packageId)
      : featuresFromFlags(input.alerts, input.ordering, input.pickup);

  const updated = await prisma.venue.update({
    where: { id: venue.id },
    data: {
      alertsEnabled: features.alerts,
      orderingEnabled: features.ordering,
      pickupEnabled: features.pickup,
    },
  });

  const next = featuresFromFlags(
    updated.alertsEnabled,
    updated.orderingEnabled,
    updated.pickupEnabled
  );
  return {
    id: packageIdFromFeatures(next),
    venueId: updated.id,
    features: next,
  };
}
