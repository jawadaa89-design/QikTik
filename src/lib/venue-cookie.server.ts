import { cookies } from "next/headers";
import { VENUE_SLUG_COOKIE } from "@/lib/venue-paths";

/** Server Components only — do not import from client modules. */
export async function venueSlugFromCookies(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(VENUE_SLUG_COOKIE)?.value?.trim() || null;
  } catch {
    return null;
  }
}
