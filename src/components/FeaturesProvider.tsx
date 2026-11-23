"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_FEATURES,
  packageIdFromFeatures,
  type FeatureFlags,
  type FeatureKey,
  type PackageId,
} from "@/lib/features";

type FeaturesContextValue = {
  ready: boolean;
  packageId: PackageId;
  features: FeatureFlags;
  hasFeature: (feature: FeatureKey) => boolean;
  refresh: () => Promise<void>;
};

const FeaturesContext = createContext<FeaturesContextValue | null>(null);

type Props = {
  children: React.ReactNode;
  /** Server-resolved flags — avoids a client flash on guest pages. */
  initial?: FeatureFlags;
  initialPackageId?: PackageId;
  /** When true, also fetch /api/v1/features on mount (staff pages). */
  fetchOnMount?: boolean;
};

export function FeaturesProvider({
  children,
  initial,
  initialPackageId,
  fetchOnMount = false,
}: Props) {
  const [features, setFeatures] = useState<FeatureFlags>(
    initial ?? DEFAULT_FEATURES
  );
  const [packageId, setPackageId] = useState<PackageId>(
    initialPackageId ??
      (initial ? packageIdFromFeatures(initial) : "menu_ordering")
  );
  // Always start ready with defaults so staff boards aren't blocked on iPad.
  const [ready, setReady] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const ctrl = new AbortController();
      const kill = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch("/api/v1/features", { signal: ctrl.signal });
      clearTimeout(kill);
      if (res.ok) {
        const data = (await res.json()) as {
          packageId: PackageId;
          features: FeatureFlags;
        };
        setPackageId(data.packageId);
        setFeatures(data.features);
      }
    } catch {
      /* keep last known defaults */
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (fetchOnMount || !initial) {
      void refresh();
    }
  }, [fetchOnMount, initial, refresh]);

  const value = useMemo<FeaturesContextValue>(
    () => ({
      ready,
      packageId,
      features,
      hasFeature: (feature) =>
        feature === "digitalMenu" ? true : Boolean(features[feature]),
      refresh,
    }),
    [ready, packageId, features, refresh]
  );

  return (
    <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>
  );
}

export function useFeatures(): FeaturesContextValue {
  const ctx = useContext(FeaturesContext);
  if (!ctx) {
    return {
      ready: true,
      packageId: "menu_ordering",
      features: DEFAULT_FEATURES,
      hasFeature: (feature) =>
        feature === "digitalMenu" ? true : Boolean(DEFAULT_FEATURES[feature]),
      refresh: async () => {},
    };
  }
  return ctx;
}
