"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  brandCssVars,
  brandFromVenue,
  DEFAULT_VENUE_BRAND,
  venueLogoSrc,
  type VenueBrand,
} from "@/lib/venue-brand";

type VenueThemeContextValue = {
  brand: VenueBrand;
  logoSrc: string;
};

const VenueThemeContext = createContext<VenueThemeContextValue>({
  brand: DEFAULT_VENUE_BRAND,
  logoSrc: "/logo.png",
});

export function VenueThemeProvider({
  children,
  brand: brandProp,
}: {
  children: ReactNode;
  brand?: VenueBrand | null;
}) {
  const brand = brandProp ?? DEFAULT_VENUE_BRAND;
  const logoSrc = venueLogoSrc(brand);
  const value = useMemo(() => ({ brand, logoSrc }), [brand, logoSrc]);

  useEffect(() => {
    const root = document.documentElement;
    const vars = brandCssVars(brand);
    for (const [key, val] of Object.entries(vars)) {
      root.style.setProperty(key, val);
    }
    return () => {
      for (const key of Object.keys(vars)) {
        root.style.removeProperty(key);
      }
    };
  }, [brand]);

  const style = brandCssVars(brand) as CSSProperties;

  return (
    <VenueThemeContext.Provider value={value}>
      <div className="venue-theme min-h-dvh" style={style}>
        {children}
      </div>
    </VenueThemeContext.Provider>
  );
}

export function useVenueBrand(): VenueBrand {
  return useContext(VenueThemeContext).brand;
}

export function useVenueLogoSrc(): string {
  return useContext(VenueThemeContext).logoSrc;
}

/** Server-safe serialize for passing brand into client provider. */
export function serializeBrand(
  venue: Parameters<typeof brandFromVenue>[0]
): VenueBrand {
  return brandFromVenue(venue);
}
