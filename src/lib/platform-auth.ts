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
