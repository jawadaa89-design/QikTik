import type { PackageId } from "@/lib/features";

/** Shared platform admin password check (create venue / list / reset staff pw). */
export function platformPasswordOk(password: string): boolean {
  const expected =
    process.env.PLATFORM_ADMIN_PASSWORD?.trim() ||
    process.env.STAFF_DEMO_PASSWORD?.trim() ||
    "qiktik2026";
  return password.trim() === expected;
}

export type VenuePublicUrls = {
  /** Restaurant home (main) for every package */
  menu: string;
  admin: string;
  staffPickup: string;
  alerts: string;
  kitchen: string;
  waiter: string;
};

export type VenueLinkKey = keyof VenuePublicUrls;

export function venuePublicUrls(slug: string): VenuePublicUrls {
  const base = `/r/${slug}`;
  return {
    /** Main guest link — restaurant home */
    menu: `${base}/ar/main`,
    admin: `${base}/admin`,
    staffPickup: `${base}/pickup`,
    alerts: `${base}/alerts`,
    kitchen: `${base}/kitchen`,
    waiter: `${base}/waiter`,
  };
}

/**
 * Links to show for a package.
 * Alerts + pickup share one staff board (`/pickup`) — never list both.
 */
export function venueLinkLabelsForPackage(
  packageId: PackageId | undefined
): { key: VenueLinkKey; label: string }[] {
  const links: { key: VenueLinkKey; label: string }[] = [
    { key: "menu", label: "Guest home (main)" },
    { key: "admin", label: "Admin" },
  ];

  if (packageId === "menu_alerts_pickup" || packageId === "menu_ordering") {
    links.push({ key: "staffPickup", label: "Alerts + pickup board" });
  } else if (packageId === "menu_alerts") {
    links.push({ key: "alerts", label: "Alerts board" });
  }

  if (packageId === "menu_ordering") {
    links.push({ key: "kitchen", label: "Kitchen" });
    links.push({ key: "waiter", label: "Waiter" });
  }

  return links;
}
