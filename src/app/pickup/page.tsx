import { redirect } from "next/navigation";

/**
 * Canonical staff board URL: /pickup
 * Serves the same SSR live board on iPad, PC, and phone (see /pickup/live).
 */
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PickupStaffEntry({ searchParams }: Props) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") q.set(key, value);
    else if (Array.isArray(value)) for (const v of value) q.append(key, v);
  }
  const qs = q.toString();
  redirect(qs ? `/pickup/live?${qs}` : "/pickup/live");
}
