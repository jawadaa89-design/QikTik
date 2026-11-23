import { redirect } from "next/navigation";

/** Staff alerts board entry — forwards query (e.g. access_token) to /alerts/live. */
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AlertsIndexPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") q.set(key, value);
    else if (Array.isArray(value)) for (const v of value) q.append(key, v);
  }
  const qs = q.toString();
  redirect(qs ? `/alerts/live?${qs}` : "/alerts/live");
}
