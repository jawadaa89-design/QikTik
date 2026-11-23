"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";
import { normalizeVenueSlug } from "@/lib/venue-paths";

type VenueContextValue = {
  venueSlug: string;
};

const VenueContext = createContext<VenueContextValue | null>(null);

function slugFromPathname(pathname: string | null): string | null {
  if (!pathname) return null;
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "r" && parts[1]) return parts[1].toLowerCase();
  return null;
}

export function VenueProvider({
  children,
  venueSlug: venueSlugProp,
}: {
  children: ReactNode;
  venueSlug?: string;
}) {
  const pathname = usePathname();
  const venueSlug = useMemo(
    () =>
      normalizeVenueSlug(
        venueSlugProp || slugFromPathname(pathname) || DEFAULT_VENUE_SLUG
      ),
    [venueSlugProp, pathname]
  );

  const value = useMemo(() => ({ venueSlug }), [venueSlug]);

  return (
    <VenueContext.Provider value={value}>{children}</VenueContext.Provider>
  );
}

export function useVenueSlug(): string {
  const ctx = useContext(VenueContext);
  const pathname = usePathname();
  if (ctx?.venueSlug) return ctx.venueSlug;
  return normalizeVenueSlug(slugFromPathname(pathname) || DEFAULT_VENUE_SLUG);
}
