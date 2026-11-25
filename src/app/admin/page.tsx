"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/utils";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import {
  StaffLanguageSwitcher,
  useStaffLocale,
} from "@/components/StaffLanguageSwitcher";
import { QikTikLogo } from "@/components/QikTikLogo";
import { LinkQrActions } from "@/components/LinkQrActions";
import { useFeatures } from "@/components/FeaturesProvider";
import { useVenueName, useVenueSlug } from "@/components/VenueProvider";
import { useVenueLogoSrc } from "@/components/VenueThemeProvider";
import type { Locale } from "@/i18n/staff";
import type { PackageId } from "@/lib/features";
import { venueStaffPath } from "@/lib/venue-paths";
import {
  DEFAULT_VENUE_BRAND,
  type VenueBrand,
} from "@/lib/venue-brand";

type Tab = "dashboard" | "menu" | "tables" | "package" | "branding";

const PACKAGE_OPTIONS: PackageId[] = [
  "menu_only",
  "menu_alerts",
  "menu_alerts_pickup",
  "menu_ordering",
];

type Dashboard = {
  venue: { name: string; currency: string } | null;
  stats: {
    revenueToday: string;
    ordersToday: number;
    openTables: number;
    avgCheck: string;
    menuItems: number;
    pickupWaiting: number;
    pickupReady: number;
  };
  recent: {
    id: string;
    orderNumber: number;
    tableNumber: number;
    section: string;
    subtotal: string;
    status: string;
  }[];
  recentPickup: {
    id: string;
    customerName: string;
    orderRef: string | null;
    status: string;
    createdAt: string;
  }[];
  menuGuestUrl: string;
  alertsBoardUrl: string;
};

type MenuCategory = {
  id: string;
  parentId: string | null;
  name: string;
  translations: Record<string, string>;
  items: {
    id: string;
    name: string;
    description: string;
    price: string;
    route: string;
    available: boolean;
    hidden: boolean;
    imageUrl: string | null;
    translations: Record<string, { name: string; description?: string | null }>;
    additionals: {
      id: string;
      name: string;
      price: string;
      active: boolean;
      translations: Record<string, string>;
    }[];
  }[];
};

type AdminTable = {
  id: string;
  number: number;
  section: string;
  token: string;
  status: string;
  guestUrl: string;
};

export default function AdminPage() {
  const { locale, setStaffLocale, at: t, ready, locales, localeNames } = useStaffLocale();
  const {
    ready: featuresReady,
    packageId,
    features,
    hasFeature,
    refresh: refreshFeatures,
  } = useFeatures();
  const venueName = useVenueName();
  const themeLogoSrc = useVenueLogoSrc();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [packageBusy, setPackageBusy] = useState(false);
  const [packageMsg, setPackageMsg] = useState<string | null>(null);
  const [brand, setBrand] = useState<VenueBrand>({ ...DEFAULT_VENUE_BRAND });
  const [brandLogoFile, setBrandLogoFile] = useState<File | null>(null);
  const [brandLogoPreview, setBrandLogoPreview] = useState<string | null>(null);
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandMsg, setBrandMsg] = useState<string | null>(null);
  const [staffPw, setStaffPw] = useState("");
  const [staffPwBusy, setStaffPwBusy] = useState(false);
  const [staffPwMsg, setStaffPwMsg] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [tables, setTables] = useState<AdminTable[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAvailable, setEditAvailable] = useState(true);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [createCategoryId, setCreateCategoryId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | null>(null);
  const [newItemCategoryId, setNewItemCategoryId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newRoute, setNewRoute] = useState<
    "MAIN_KITCHEN" | "MEAT_KITCHEN" | "BAR" | "HOOKAH"
  >("MAIN_KITCHEN");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [newExtraName, setNewExtraName] = useState("");
  const [newExtraPrice, setNewExtraPrice] = useState("");
  const [extraBusy, setExtraBusy] = useState(false);
  /** Locale of menu item text being edited (independent of admin UI language). */
  const [menuLocale, setMenuLocale] = useState<Locale>("ar");
  const [copiedLink, setCopiedLink] = useState(false);

  const venueSlug = useVenueSlug();
  const alertsOn = hasFeature("alerts");
  const orderingOn = hasFeature("ordering");
  const pickupOn = hasFeature("pickup");
  /** Table QR is only for ordering — guest home is always the public /main link. */
  const tablesNeeded = orderingOn;
  /** Menu is in every package; Guest links tab always available when not using Tables. */
  const guestLinksNeeded = true;

  const loadDash = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/dashboard");
      if (res.ok) setDash(await res.json());
    } catch {
      /* transient */
    }
  }, []);

  const loadMenu = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/admin/menu?locale=${menuLocale}`);
      if (res.ok) setMenu((await res.json()).categories);
    } catch {
      /* transient */
    }
  }, [menuLocale]);

  const loadTables = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/tables");
      if (res.ok) setTables((await res.json()).tables);
    } catch {
      /* transient */
    }
  }, []);

  useEffect(() => {
    if (tab === "dashboard") loadDash();
    if (tab === "menu") loadMenu();
    if (tab === "tables") {
      if (tablesNeeded) loadTables();
      if (guestLinksNeeded) loadDash();
    }
    if (tab === "package") void refreshFeatures();
    if (tab === "branding") void loadBranding();
  }, [
    tab,
    loadDash,
    loadMenu,
    loadTables,
    refreshFeatures,
    tablesNeeded,
    guestLinksNeeded,
  ]);

  async function loadBranding() {
    try {
      const res = await fetch("/api/v1/admin/venue/branding");
      if (!res.ok) return;
      const data = await res.json();
      const next = (data.branding ?? data.venue?.branding) as
        | VenueBrand
        | undefined;
      if (next) {
        setBrand(next);
        setBrandLogoPreview(next.logoUrl || null);
        setBrandLogoFile(null);
      }
    } catch {
      /* transient */
    }
  }

  async function saveBranding() {
    setBrandBusy(true);
    setBrandMsg(null);
    try {
      if (brandLogoFile) {
        const form = new FormData();
        form.set("file", brandLogoFile);
        const logoRes = await fetch("/api/v1/admin/venue/logo", {
          method: "POST",
          body: form,
        });
        if (!logoRes.ok) {
          setBrandMsg(t.brandingUploadError);
          return;
        }
        const logoData = await logoRes.json();
        if (logoData.logoUrl) {
          setBrand((prev) => ({ ...prev, logoUrl: logoData.logoUrl }));
          setBrandLogoPreview(logoData.logoUrl);
          setBrandLogoFile(null);
        }
      }

      const res = await fetch("/api/v1/admin/venue/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accentColor: brand.accentColor,
          backgroundColor: brand.backgroundColor,
          surfaceColor: brand.surfaceColor,
          textColor: brand.textColor,
          phone: brand.phone?.trim() || null,
          wazeUrl: brand.wazeUrl?.trim() || null,
          instagramUrl: brand.instagramUrl?.trim() || null,
          facebookUrl: brand.facebookUrl?.trim() || null,
          tiktokUrl: brand.tiktokUrl?.trim() || null,
        }),
      });
      if (!res.ok) {
        setBrandMsg(t.brandingSaveError);
        return;
      }
      const data = await res.json();
      if (data.branding) setBrand(data.branding as VenueBrand);
      setBrandMsg(t.brandingSaved);
      window.setTimeout(() => setBrandMsg(null), 2000);
    } catch {
      setBrandMsg(t.brandingSaveError);
    } finally {
      setBrandBusy(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1600);
    } catch {
      /* ignore */
    }
  }

  function requestPackageUpgrade(next: PackageId) {
    if (next === packageId) {
      setPackageMsg(t.packageAlreadyActive);
      return;
    }
    setPackageBusy(true);
    setPackageMsg(null);
    try {
      const subject = encodeURIComponent(
        `Package request: ${venueName} (${venueSlug})`
      );
      const body = encodeURIComponent(
        [
          "Hi QikTik,",
          "",
          "Please activate the following package for our restaurant.",
          "",
          `Venue: ${venueName}`,
          `Slug: ${venueSlug}`,
          `Admin: /r/${venueSlug}/admin`,
          `Current package: ${packageLabel(packageId)}`,
          `Requested package: ${packageLabel(next)}`,
          "",
          "Thank you.",
        ].join("\n")
      );
      window.location.href = `mailto:jawadaa@qiktik.tech?subject=${subject}&body=${body}`;
      setPackageMsg(t.packageContactOpened);
    } catch {
      setPackageMsg(t.packageContactError);
    } finally {
      setPackageBusy(false);
    }
  }

  function packageLabel(id: PackageId) {
    switch (id) {
      case "menu_only":
        return t.packageMenuOnly;
      case "menu_alerts":
        return t.packageMenuAlerts;
      case "menu_alerts_pickup":
        return t.packageMenuAlertsPickup;
      case "menu_ordering":
        return t.packageMenuOrdering;
    }
  }

  function packageDesc(id: PackageId) {
    switch (id) {
      case "menu_only":
        return t.packageMenuOnlyDesc;
      case "menu_alerts":
        return t.packageMenuAlertsDesc;
      case "menu_alerts_pickup":
        return t.packageMenuAlertsPickupDesc;
      case "menu_ordering":
        return t.packageMenuOrderingDesc;
    }
  }

  useEffect(() => {
    setMenuLocale(locale);
    setEditId(null);
    setCreateCategoryId(null);
    setCreatingCategory(false);
    setEditCategoryId(null);
  }, [locale]);

  useLiveEvents(() => {
    if (tab === "dashboard") loadDash();
  });

  function startEdit(item: MenuCategory["items"][number]) {
    setCreatingCategory(false);
    setCreateCategoryId(null);
    setEditId(item.id);
    setEditPrice(item.price);
    setEditName(item.translations[menuLocale]?.name ?? item.name);
    setEditDescription(
      item.translations[menuLocale]?.description ?? item.description ?? ""
    );
    setEditAvailable(item.available);
    setEditImageUrl(item.imageUrl);
    setNewExtraName("");
    setNewExtraPrice("");
  }

  async function addExtra(itemId: string) {
    const name = newExtraName.trim();
    const price = newExtraPrice.trim();
    if (!name || !price) return;
    setExtraBusy(true);
    try {
      const res = await fetch("/api/v1/admin/menu/additionals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          price,
          translations: { [menuLocale]: { name } },
        }),
      });
      if (res.ok) {
        setNewExtraName("");
        setNewExtraPrice("");
        await loadMenu();
      }
    } finally {
      setExtraBusy(false);
    }
  }

  async function removeExtra(id: string) {
    setExtraBusy(true);
    try {
      const res = await fetch("/api/v1/admin/menu/additionals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) await loadMenu();
    } finally {
      setExtraBusy(false);
    }
  }

  function clearNewImage() {
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImageFile(null);
    setNewImagePreview(null);
  }

  function startCreate(categoryId: string) {
    setCreatingCategory(false);
    setEditId(null);
    setCreateCategoryId(categoryId);
    setNewItemCategoryId(categoryId);
    setNewName("");
    setNewDescription("");
    setNewPrice("");
    setNewRoute("MAIN_KITCHEN");
    clearNewImage();
  }

  function startCreateCategory(parentId: string | null = null) {
    setEditId(null);
    setCreateCategoryId(null);
    setCreatingCategory(true);
    setNewCategoryName("");
    setNewCategoryParentId(parentId);
  }

  async function createCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreateBusy(true);
    try {
      const res = await fetch("/api/v1/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "category",
          parentId: newCategoryParentId,
          active: true,
          translations: {
            [menuLocale]: { name },
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newId = data.category?.id as string | undefined;
        const translated = data.category?.translations as Record<string, string> | undefined;
        if (newId && translated && Object.keys(translated).length < 4) {
          await fetch("/api/v1/admin/menu", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "category",
              categoryId: newId,
              translations: { [menuLocale]: { name } },
            }),
          });
        }
        setCreatingCategory(false);
        setNewCategoryName("");
        setNewCategoryParentId(null);
        await loadMenu();
        if (newId) {
          startCreate(newId);
        }
      }
    } finally {
      setCreateBusy(false);
    }
  }

  async function deleteCategory(categoryId: string) {
    if (!window.confirm(t.deleteCategoryConfirm)) return;
    const res = await fetch("/api/v1/admin/menu", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });
    if (res.ok) {
      await loadMenu();
      return;
    }
    if (res.status === 409) {
      window.alert(t.deleteCategoryBlocked);
    }
  }

  const orderedMenu = (() => {
    const roots = menu.filter((c) => !c.parentId);
    const out: MenuCategory[] = [];
    for (const root of roots) {
      out.push(root);
      out.push(...menu.filter((c) => c.parentId === root.id));
    }
    // Orphans (parent missing) still show
    const listed = new Set(out.map((c) => c.id));
    for (const c of menu) {
      if (!listed.has(c.id)) out.push(c);
    }
    return out;
  })();

  const categoryOptions = orderedMenu.map((c) => ({
    id: c.id,
    label: c.parentId
      ? `↳ ${menu.find((p) => p.id === c.parentId)?.name ?? ""} / ${c.name}`
      : c.name,
  }));

  async function saveCategoryName(categoryId: string) {
    const name = editCategoryName.trim();
    if (!name) return;
    setCreateBusy(true);
    try {
      const res = await fetch("/api/v1/admin/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "category",
          categoryId,
          translations: {
            [menuLocale]: { name },
          },
        }),
      });
      if (res.ok) {
        setEditCategoryId(null);
        await loadMenu();
      }
    } finally {
      setCreateBusy(false);
    }
  }

  /** Fill ar/he/en/ru for a category that was created before auto-translate worked. */
  async function translateCategoryMissing(cat: MenuCategory) {
    const sourceName =
      cat.translations?.[menuLocale] ||
      Object.values(cat.translations ?? {})[0] ||
      cat.name;
    if (!sourceName?.trim()) return;
    setCreateBusy(true);
    try {
      // Prefer a locale that already has a real name as source
      const sourceLocale =
        (["he", "ar", "en", "ru"] as const).find((l) => cat.translations?.[l]?.trim()) ||
        menuLocale;
      await fetch("/api/v1/admin/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "category",
          categoryId: cat.id,
          translations: {
            [sourceLocale]: { name: cat.translations?.[sourceLocale] || sourceName },
          },
        }),
      });
      await loadMenu();
    } finally {
      setCreateBusy(false);
    }
  }

  async function createItem() {
    const name = newName.trim();
    const categoryId = newItemCategoryId || createCategoryId;
    if (!name || !newPrice.trim() || !categoryId) return;
    setCreateBusy(true);
    try {
      const res = await fetch("/api/v1/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          price: newPrice.trim(),
          route: newRoute,
          available: true,
          translations: {
            [menuLocale]: {
              name,
              description: newDescription.trim(),
            },
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const itemId = data.item?.id as string | undefined;
        if (itemId && newImageFile) {
          await uploadItemImage(itemId, newImageFile);
        }
        setCreateCategoryId(null);
        setNewItemCategoryId("");
        clearNewImage();
        await loadMenu();
      }
    } finally {
      setCreateBusy(false);
    }
  }

  async function deleteItem(itemId: string) {
    if (!window.confirm(t.removeItemConfirm)) return;
    const res = await fetch("/api/v1/admin/menu", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    if (res.ok) {
      if (editId === itemId) setEditId(null);
      await loadMenu();
      return;
    }
    if (res.status === 409) {
      window.alert(t.removeItemBlocked);
    }
  }

  async function uploadItemImage(itemId: string, file: File) {
    setImageBusy(true);
    try {
      if (file.size > 4 * 1024 * 1024) {
        window.alert(t.imageHint);
        return;
      }
      const body = new FormData();
      body.set("itemId", itemId);
      body.set("file", file);
      const res = await fetch("/api/v1/admin/menu/upload", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.imageUrl) {
        setEditImageUrl(data.imageUrl as string);
        setMenu((prev) =>
          prev.map((cat) => ({
            ...cat,
            items: cat.items.map((i) =>
              i.id === itemId ? { ...i, imageUrl: data.imageUrl as string } : i
            ),
          }))
        );
      } else {
        window.alert(
          (data?.error?.message as string) || t.imageHint
        );
      }
    } finally {
      setImageBusy(false);
    }
  }

  async function removeItemImage(itemId: string) {
    setImageBusy(true);
    try {
      const res = await fetch("/api/v1/admin/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, imageUrl: null }),
      });
      if (res.ok) {
        setEditImageUrl(null);
        setMenu((prev) =>
          prev.map((cat) => ({
            ...cat,
            items: cat.items.map((i) =>
              i.id === itemId ? { ...i, imageUrl: null } : i
            ),
          }))
        );
      }
    } finally {
      setImageBusy(false);
    }
  }

  async function saveItem(itemId: string) {
    const item = menu.flatMap((c) => c.items).find((i) => i.id === itemId);
    if (!item) return;
    const name = editName.trim() || item.translations[menuLocale]?.name || item.name;
    await fetch("/api/v1/admin/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        price: editPrice || item.price,
        available: editAvailable,
        // Only send the language being edited — server won't overwrite other locales
        translations: {
          [menuLocale]: {
            name,
            description: editDescription.trim(),
          },
        },
      }),
    });
    setEditId(null);
    loadMenu();
  }

  async function toggleAvailable(itemId: string, available: boolean) {
    await fetch("/api/v1/admin/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, available }),
    });
    loadMenu();
  }

  async function toggleHidden(itemId: string, hidden: boolean) {
    await fetch("/api/v1/admin/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, hidden }),
    });
    loadMenu();
  }

  async function setCategoryHidden(categoryId: string, hidden: boolean) {
    await fetch("/api/v1/admin/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, hidden }),
    });
    loadMenu();
  }

  function sectionLabel(section: string) {
    if (section === "INSIDE" || section === "OUTSIDE" || section === "TERRACE") {
      return t.sections[section];
    }
    return section;
  }

  function statusLabel(status: string) {
    if (
      status === "FREE" ||
      status === "ACTIVE" ||
      status === "BILL_REQUESTED" ||
      status === "DISABLED"
    ) {
      return t.statuses[status];
    }
    return status;
  }

  const tablesNavLabel =
    tablesNeeded || guestLinksNeeded ? (tablesNeeded ? t.navTables : t.navLinks) : t.navTables;

  const nav = [
    ["dashboard", t.navDashboard],
    ["menu", t.navMenu],
    ["tables", tablesNavLabel],
    ["branding", t.navBranding],
    ["package", t.navPackage],
  ] as const;

  if (!ready || !featuresReady) {
    return <div className="min-h-dvh" />;
  }

  const headerLogoSrc =
    brandLogoPreview || brand.logoUrl || themeLogoSrc || "/logo.png";

  return (
    <div className="relative min-h-dvh">
      <QikTikLogo className="absolute end-4 top-4 z-20 hidden md:block" />
      <div className="flex min-h-dvh">
        <aside className="hidden w-56 shrink-0 border-e border-white/8 bg-[#0a0f0d] p-5 md:block">
          <div className="flex flex-col items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={headerLogoSrc}
              alt={venueName}
              width={56}
              height={56}
              className="h-14 w-14 rounded-full object-cover ring-2 ring-brass/40 bg-[#f6f3ee]"
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brass">
                {venueName}
              </p>
              <h1 className="mt-1 font-display text-xl font-semibold text-ink">
                {t.title}
              </h1>
            </div>
          </div>
          <nav className="mt-8 space-y-1">
            {nav.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`block w-full rounded-xl px-3 py-2.5 text-start text-sm font-semibold ${
                  tab === id
                    ? "bg-brass text-[#0c100e]"
                    : "text-ink-soft/70 hover:bg-white/[0.04]"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-8">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft/40">
              {t.language}
            </p>
            <StaffLanguageSwitcher
              locale={locale}
              onChange={setStaffLocale}
              label={t.language}
            />
          </div>
          <div className="mt-10 space-y-2 border-t border-white/8 pt-4 text-xs text-ink-soft/40">
            {pickupOn ? (
              <a
                href={venueStaffPath(venueSlug, "pickup")}
                className="block hover:text-brass"
              >
                {t.linkAlertsPickup}
              </a>
            ) : alertsOn ? (
              <a
                href={venueStaffPath(venueSlug, "alerts")}
                className="block hover:text-brass"
              >
                {t.linkAlerts}
              </a>
            ) : null}
            {hasFeature("ordering") ? (
              <>
                <a
                  href={venueStaffPath(venueSlug, "kitchen")}
                  className="block hover:text-brass"
                >
                  {t.linkKitchen}
                </a>
                <a
                  href={venueStaffPath(venueSlug, "waiter")}
                  className="block hover:text-brass"
                >
                  {t.linkWaiter}
                </a>
              </>
            ) : null}
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <div className="mb-4 flex items-center gap-3 md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={headerLogoSrc}
              alt={venueName}
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-brass/40 bg-[#f6f3ee]"
            />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-brass">
                {venueName}
              </p>
              <p className="truncate font-display text-lg font-semibold text-ink">
                {t.title}
              </p>
            </div>
            <QikTikLogo className="ms-auto shrink-0" />
          </div>
          <div className="relative mb-5 flex flex-wrap items-center gap-2 md:hidden">
            <StaffLanguageSwitcher
              locale={locale}
              onChange={setStaffLocale}
              label={t.language}
            />
            {nav.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${
                  tab === id ? "bg-brass text-[#0c100e]" : "guest-panel text-ink-soft"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "dashboard" && dash && (
            <>
              <h2 className="font-display text-3xl font-semibold text-ink">
                {dash.venue?.name ?? t.venueFallback}
              </h2>

              {!orderingOn && !pickupOn && !alertsOn ? (
                <div className="guest-panel mt-5 rounded-2xl p-4">
                  <p className="text-sm text-ink-soft/70">{t.menuOnlyDashHint}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setTab("menu")}
                      className="btn-primary px-4 py-2 text-sm"
                    >
                      {t.manageMenuCta}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("package")}
                      className="btn-ghost px-4 py-2 text-sm"
                    >
                      {t.openPackageCta}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    [t.menuItemsLive, String(dash.stats.menuItems ?? 0), true],
                    [
                      t.revenueToday,
                      formatPrice(dash.stats.revenueToday),
                      orderingOn,
                    ],
                    [
                      t.ordersToday,
                      String(dash.stats.ordersToday),
                      orderingOn,
                    ],
                    [
                      t.openTables,
                      String(dash.stats.openTables),
                      orderingOn,
                    ],
                    [
                      t.avgCheck,
                      formatPrice(dash.stats.avgCheck),
                      orderingOn,
                    ],
                    [
                      t.pickupWaiting,
                      String(dash.stats.pickupWaiting ?? 0),
                      pickupOn,
                    ],
                    [
                      t.pickupReady,
                      String(dash.stats.pickupReady ?? 0),
                      pickupOn,
                    ],
                  ] as const
                )
                  .filter(([, , show]) => show)
                  .map(([label, value]) => (
                    <div key={label} className="guest-panel rounded-2xl p-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft/50">
                        {label}
                      </p>
                      <p className="mt-2 font-display text-2xl font-semibold text-brass">
                        {value}
                      </p>
                    </div>
                  ))}
              </div>

              {dash.menuGuestUrl ? (
                <div className="guest-panel mt-5 rounded-2xl p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft/50">
                    {t.menuGuestTitle}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft/55">
                    {orderingOn
                      ? t.menuGuestHintOrdering
                      : pickupOn
                        ? t.menuGuestHintPickup
                        : t.menuGuestHint}
                  </p>
                  <a
                    href={dash.menuGuestUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block break-all text-sm font-semibold text-brass hover:underline"
                  >
                    {dash.menuGuestUrl}
                  </a>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText(dash.menuGuestUrl)}
                      className="rounded-lg border border-brass/35 bg-brass/10 px-3 py-1.5 text-xs font-bold text-brass"
                    >
                      {copiedLink ? t.linkCopied : t.copyLink}
                    </button>
                    <LinkQrActions href={dash.menuGuestUrl} label={t.menuGuestTitle} />
                  </div>
                </div>
              ) : null}

              {(alertsOn || pickupOn) && dash.alertsBoardUrl ? (
                <div className="guest-panel mt-5 rounded-2xl p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft/50">
                    {pickupOn ? t.alertsPickupBoardTitle : t.alertsBoardTitle}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft/55">
                    {pickupOn ? t.alertsPickupBoardHint : t.alertsBoardHint}
                  </p>
                  <a
                    href={dash.alertsBoardUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block break-all text-sm font-semibold text-brass hover:underline"
                  >
                    {dash.alertsBoardUrl}
                  </a>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText(dash.alertsBoardUrl)}
                      className="rounded-lg border border-brass/35 bg-brass/10 px-3 py-1.5 text-xs font-bold text-brass"
                    >
                      {copiedLink ? t.linkCopied : t.copyLink}
                    </button>
                    <LinkQrActions
                      href={dash.alertsBoardUrl}
                      label={
                        pickupOn ? t.alertsPickupBoardTitle : t.alertsBoardTitle
                      }
                    />
                  </div>
                </div>
              ) : null}

              {orderingOn ? (
                <>
                  <h3 className="mt-8 mb-3 font-display text-xl font-semibold text-ink">
                    {t.liveFeed}
                  </h3>
                  <div className="space-y-2">
                    {dash.recent.map((o) => (
                      <div
                        key={o.id}
                        className="guest-panel flex justify-between rounded-2xl px-4 py-3 text-sm text-ink"
                      >
                        <span className="text-ink-soft">
                          T{o.tableNumber} · #{o.orderNumber} ·{" "}
                          {sectionLabel(o.section)}
                        </span>
                        <span className="font-semibold text-brass">
                          {formatPrice(o.subtotal)}
                        </span>
                      </div>
                    ))}
                    {dash.recent.length === 0 && (
                      <p className="text-ink-soft/40">{t.noOrders}</p>
                    )}
                  </div>
                </>
              ) : null}

              {pickupOn ? (
                <>
                  <h3 className="mt-8 mb-3 font-display text-xl font-semibold text-ink">
                    {t.pickupFeed}
                  </h3>
                  <div className="space-y-2">
                    {(dash.recentPickup ?? []).map((p) => (
                      <div
                        key={p.id}
                        className="guest-panel flex justify-between rounded-2xl px-4 py-3 text-sm text-ink"
                      >
                        <span className="text-ink-soft">
                          {p.orderRef ? `#${p.orderRef}` : p.id.slice(0, 8)} ·{" "}
                          {p.customerName}
                        </span>
                        <span className="font-semibold text-brass">{p.status}</span>
                      </div>
                    ))}
                    {(dash.recentPickup ?? []).length === 0 && (
                      <p className="text-ink-soft/40">{t.noPickupTickets}</p>
                    )}
                  </div>
                </>
              ) : null}
            </>
          )}

          {tab === "menu" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-3xl font-semibold text-ink">{t.menuTitle}</h2>
                <button
                  type="button"
                  onClick={() => startCreateCategory(null)}
                  className="rounded-lg border border-brass/35 bg-brass/10 px-2.5 py-1 text-xs font-bold text-brass"
                >
                  {t.addCategory}
                </button>
                <div className="ms-auto flex flex-wrap items-center gap-1">
                  <span className="me-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft/40">
                    {t.editLocale}
                  </span>
                  {locales.map((l) => (
                    <button
                      key={l}
                      onClick={() => {
                        setEditId(null);
                        setCreateCategoryId(null);
                        setCreatingCategory(false);
                        setMenuLocale(l);
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                        menuLocale === l
                          ? "bg-brass text-[#0c100e]"
                          : "guest-panel text-ink-soft"
                      }`}
                      title={localeNames[l]}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              {creatingCategory && (
                <div className="guest-panel mt-4 space-y-2 rounded-2xl border border-brass/30 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brass/80">
                    {newCategoryParentId ? t.addSubcategoryTitle : t.addCategoryTitle}
                  </p>
                  {newCategoryParentId && (
                    <p className="text-xs text-ink-soft/60">
                      {menu.find((c) => c.id === newCategoryParentId)?.name}
                    </p>
                  )}
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">
                      {t.nameLabel} ({menuLocale})
                    </span>
                    <input
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-ink"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      autoFocus
                      placeholder={t.categoryNamePlaceholder}
                    />
                  </label>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={createBusy || !newCategoryName.trim()}
                      onClick={() => createCategory()}
                      className="btn-primary px-4 py-2 disabled:opacity-40"
                    >
                      {t.createCategory}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingCategory(false);
                        setNewCategoryParentId(null);
                      }}
                      className="btn-ghost px-4 py-2"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              )}
              <div className="mt-5 space-y-6">
                {orderedMenu.map((cat) => (
                  <section
                    key={cat.id}
                    className={cat.parentId ? "ms-4 border-s border-white/10 ps-4" : undefined}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {editCategoryId === cat.id ? (
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <input
                            className="min-w-[10rem] flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-ink"
                            value={editCategoryName}
                            onChange={(e) => setEditCategoryName(e.target.value)}
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={createBusy || !editCategoryName.trim()}
                            onClick={() => saveCategoryName(cat.id)}
                            className="rounded-lg bg-brass px-2.5 py-1 text-xs font-bold text-[#0c100e] disabled:opacity-40"
                          >
                            {t.save}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditCategoryId(null)}
                            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-bold text-ink-soft"
                          >
                            {t.cancel}
                          </button>
                        </div>
                      ) : (
                        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-ink-soft/45">
                          {cat.name}
                          {cat.parentId && (
                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-ink-soft/55">
                              {t.subcategoryBadge}
                            </span>
                          )}
                        </h3>
                      )}
                      {editCategoryId !== cat.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditCategoryId(cat.id);
                            setEditCategoryName(
                              cat.translations?.[menuLocale] || cat.name
                            );
                          }}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-ink-soft hover:text-brass"
                        >
                          {t.editCategory}
                        </button>
                      )}
                      {Object.keys(cat.translations ?? {}).length < 4 && (
                        <button
                          type="button"
                          disabled={createBusy}
                          onClick={() => translateCategoryMissing(cat)}
                          className="rounded-lg border border-brass/35 bg-brass/10 px-2.5 py-1 text-xs font-bold text-brass disabled:opacity-40"
                        >
                          {t.translateCategory}
                        </button>
                      )}
                      {!cat.parentId && (
                        <button
                          type="button"
                          onClick={() => startCreateCategory(cat.id)}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-ink-soft hover:text-brass"
                        >
                          {t.addSubcategory}
                        </button>
                      )}
                      {(cat.items.length > 0 ||
                        menu.some((c) => c.parentId === cat.id && c.items.length > 0)) && (
                        <>
                          <button
                            type="button"
                            onClick={() => setCategoryHidden(cat.id, true)}
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-ink-soft hover:border-alert/40 hover:text-alert"
                          >
                            {t.hideAll}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryHidden(cat.id, false)}
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-ink-soft hover:border-ready/40 hover:text-ready"
                          >
                            {t.showAll}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteCategory(cat.id)}
                        className="rounded-lg border border-alert/30 bg-alert/10 px-2.5 py-1 text-xs font-bold text-alert"
                      >
                        {t.deleteCategory}
                      </button>
                      <button
                        type="button"
                        onClick={() => startCreate(cat.id)}
                        className="ms-auto rounded-lg border border-brass/35 bg-brass/10 px-2.5 py-1 text-xs font-bold text-brass"
                      >
                        {t.addItem}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {createCategoryId === cat.id && (
                        <div className="guest-panel space-y-2 rounded-2xl border border-brass/30 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-brass/80">
                            {t.addItemTitle}
                          </p>
                          <label className="block">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">
                              {t.categoryLabel}
                            </span>
                            <select
                              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-ink"
                              value={newItemCategoryId || cat.id}
                              onChange={(e) => {
                                const next = e.target.value;
                                setNewItemCategoryId(next);
                                setCreateCategoryId(next);
                              }}
                            >
                              {categoryOptions.map((c) => (
                                <option key={c.id} value={c.id} className="bg-[#161c19]">
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">
                              {t.nameLabel} ({menuLocale})
                            </span>
                            <input
                              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-ink"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              autoFocus
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">
                              {t.descriptionLabel} ({menuLocale})
                            </span>
                            <textarea
                              rows={2}
                              className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-ink"
                              value={newDescription}
                              onChange={(e) => setNewDescription(e.target.value)}
                              placeholder={t.descriptionPlaceholder}
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">
                              {t.priceLabel}
                            </span>
                            <input
                              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-ink"
                              value={newPrice}
                              onChange={(e) => setNewPrice(e.target.value)}
                              inputMode="decimal"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">
                              {t.routeLabel}
                            </span>
                            <select
                              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-ink"
                              value={newRoute}
                              onChange={(e) =>
                                setNewRoute(
                                  e.target.value as
                                    | "MAIN_KITCHEN"
                                    | "MEAT_KITCHEN"
                                    | "BAR"
                                    | "HOOKAH"
                                )
                              }
                            >
                              {(
                                [
                                  "MAIN_KITCHEN",
                                  "MEAT_KITCHEN",
                                  "BAR",
                                  "HOOKAH",
                                ] as const
                              ).map((r) => (
                                <option key={r} value={r} className="bg-[#161c19]">
                                  {t.routes[r]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">
                              {t.imageLabel}
                            </span>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3">
                              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#1a2420]">
                                {newImagePreview ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={newImagePreview}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs text-ink-soft/40">
                                    —
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-2">
                                <p className="text-[11px] text-ink-soft/50">{t.imageHint}</p>
                                <div className="flex flex-wrap gap-2">
                                  <label className="btn-ghost cursor-pointer px-3 py-1.5 text-xs">
                                    {t.imageChoose}
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp,image/gif"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0] ?? null;
                                        e.target.value = "";
                                        if (newImagePreview) URL.revokeObjectURL(newImagePreview);
                                        if (!file) {
                                          setNewImageFile(null);
                                          setNewImagePreview(null);
                                          return;
                                        }
                                        setNewImageFile(file);
                                        setNewImagePreview(URL.createObjectURL(file));
                                      }}
                                    />
                                  </label>
                                  {newImagePreview && (
                                    <button
                                      type="button"
                                      onClick={clearNewImage}
                                      className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-1.5 text-xs font-semibold text-alert"
                                    >
                                      {t.imageRemove}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </label>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              disabled={
                                createBusy ||
                                !newName.trim() ||
                                !newPrice.trim() ||
                                !(newItemCategoryId || cat.id)
                              }
                              onClick={() => createItem()}
                              className="btn-primary px-4 py-2 disabled:opacity-40"
                            >
                              {t.createItem}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCreateCategoryId(null);
                                setNewItemCategoryId("");
                                clearNewImage();
                              }}
                              className="btn-ghost px-4 py-2"
                            >
                              {t.cancel}
                            </button>
                          </div>
                        </div>
                      )}
                      {cat.items.map((item) => (
                        <div
                          key={item.id}
                          className={`guest-panel rounded-2xl p-3 ${
                            item.hidden ? "opacity-55" : ""
                          }`}
                        >
                          {editId === item.id ? (
                            <div className="space-y-2">
                              <label className="block">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">
                                  {t.nameLabel} ({menuLocale})
                                </span>
                                <input
                                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-ink"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                />
                              </label>
                              <label className="block">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">
                                  {t.descriptionLabel} ({menuLocale})
                                </span>
                                <textarea
                                  rows={3}
                                  className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-ink"
                                  value={editDescription}
                                  onChange={(e) => setEditDescription(e.target.value)}
                                  placeholder={t.descriptionPlaceholder}
                                />
                              </label>
                              <label className="block">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">
                                  {t.priceLabel}
                                </span>
                                <input
                                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-ink"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  inputMode="decimal"
                                />
                              </label>
                              <label className="block">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">
                                  {t.imageLabel}
                                </span>
                                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#1a2420]">
                                    {editImageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={editImageUrl}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-xs text-ink-soft/40">
                                        —
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1 space-y-2">
                                    <p className="text-[11px] text-ink-soft/50">{t.imageHint}</p>
                                    <div className="flex flex-wrap gap-2">
                                      <label className="btn-ghost cursor-pointer px-3 py-1.5 text-xs">
                                        {imageBusy ? t.imageUploading : t.imageChoose}
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/png,image/webp,image/gif"
                                          className="hidden"
                                          disabled={imageBusy}
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            e.target.value = "";
                                            if (file) void uploadItemImage(item.id, file);
                                          }}
                                        />
                                      </label>
                                      {editImageUrl && (
                                        <button
                                          type="button"
                                          disabled={imageBusy}
                                          onClick={() => removeItemImage(item.id)}
                                          className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-1.5 text-xs font-semibold text-alert disabled:opacity-40"
                                        >
                                          {t.imageRemove}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </label>
                              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                                <input
                                  type="checkbox"
                                  checked={editAvailable}
                                  onChange={(e) => setEditAvailable(e.target.checked)}
                                  className="h-4 w-4 accent-[#f97316]"
                                />
                                <span className="text-sm font-semibold text-ink">
                                  {t.availableOnMenu}
                                </span>
                              </label>
                              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">
                                  {t.extrasTitle}
                                </p>
                                <p className="mt-1 text-xs text-ink-soft/45">{t.extrasHint}</p>
                                <div className="mt-2 space-y-2">
                                  {(item.additionals ?? []).map((extra) => (
                                    <div
                                      key={extra.id}
                                      className="flex items-center gap-2 rounded-lg border border-white/8 bg-[#0c110f]/60 px-2.5 py-2"
                                    >
                                      <span className="min-w-0 flex-1 text-sm text-ink">
                                        {extra.translations?.[menuLocale] || extra.name}
                                      </span>
                                      <span className="shrink-0 text-sm font-semibold text-brass">
                                        {formatPrice(extra.price)}
                                      </span>
                                      <button
                                        type="button"
                                        disabled={extraBusy}
                                        onClick={() => removeExtra(extra.id)}
                                        className="shrink-0 text-xs font-semibold text-alert/80 disabled:opacity-40"
                                      >
                                        {t.removeExtra}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <input
                                    className="min-w-[8rem] flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-ink"
                                    value={newExtraName}
                                    onChange={(e) => setNewExtraName(e.target.value)}
                                    placeholder={t.extraNamePlaceholder}
                                  />
                                  <input
                                    className="w-24 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-ink"
                                    value={newExtraPrice}
                                    onChange={(e) => setNewExtraPrice(e.target.value)}
                                    placeholder={t.extraPricePlaceholder}
                                    inputMode="decimal"
                                  />
                                  <button
                                    type="button"
                                    disabled={
                                      extraBusy ||
                                      !newExtraName.trim() ||
                                      !newExtraPrice.trim()
                                    }
                                    onClick={() => addExtra(item.id)}
                                    className="rounded-xl border border-brass/35 bg-brass/10 px-3 py-2 text-xs font-bold text-brass disabled:opacity-40"
                                  >
                                    {t.addExtra}
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                  onClick={() => saveItem(item.id)}
                                  className="btn-primary px-4 py-2"
                                >
                                  {t.save}
                                </button>
                                <button
                                  onClick={() => setEditId(null)}
                                  className="btn-ghost px-4 py-2"
                                >
                                  {t.cancel}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteItem(item.id)}
                                  className="ms-auto rounded-xl border border-alert/30 bg-alert/10 px-4 py-2 text-sm font-semibold text-alert"
                                >
                                  {t.removeItem}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#1a2420]">
                                {item.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={item.imageUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center font-display text-lg text-brass/50">
                                    {item.name.trim().charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-ink">
                                  {item.name}
                                  {item.hidden ? (
                                    <span className="ms-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft/70">
                                      {t.hiddenBadge}
                                    </span>
                                  ) : null}
                                </p>
                                {item.description ? (
                                  <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft/60">
                                    {item.description}
                                  </p>
                                ) : null}
                                <p className="mt-1 text-xs text-ink-soft/40">
                                  {item.route} · {formatPrice(item.price)}
                                  {(item.additionals?.length ?? 0) > 0
                                    ? ` · ${item.additionals.length} ${t.extrasTitle.toLowerCase()}`
                                    : ""}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleHidden(item.id, !item.hidden)}
                                className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${
                                  item.hidden
                                    ? "bg-white/10 text-ink-soft"
                                    : "bg-white/[0.06] text-ink-soft/80 hover:bg-alert/15 hover:text-alert"
                                }`}
                                title={item.hidden ? t.showItem : t.hideItem}
                              >
                                {item.hidden ? t.showItem : t.hideItem}
                              </button>
                              <button
                                onClick={() => toggleAvailable(item.id, !item.available)}
                                className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${
                                  item.available
                                    ? "bg-ready/15 text-ready"
                                    : "bg-alert/15 text-alert"
                                }`}
                                title={t.availableOnMenu}
                              >
                                {item.available ? t.on : t.off}
                              </button>
                              <button
                                onClick={() => startEdit(item)}
                                className="shrink-0 text-sm font-semibold text-brass"
                              >
                                {t.edit}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteItem(item.id)}
                                className="shrink-0 text-sm font-semibold text-alert/80"
                              >
                                {t.removeItem}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}

          {tab === "tables" && (
            <>
              {tablesNeeded ? (
                <>
                  <h2 className="font-display text-3xl font-semibold text-ink">
                    {t.tablesTitle}
                  </h2>
                  <p className="mt-1 text-sm text-ink-soft/50">{t.tablesHint}</p>
                  {dash?.menuGuestUrl ? (
                    <div className="guest-panel mt-4 rounded-2xl p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft/50">
                        {t.menuGuestTitle}
                      </p>
                      <p className="mt-1 text-sm text-ink-soft/55">
                        {orderingOn
                          ? t.menuGuestHintOrdering
                          : pickupOn
                            ? t.menuGuestHintPickup
                            : t.menuGuestHint}
                      </p>
                      <a
                        href={dash.menuGuestUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block break-all text-sm font-semibold text-brass hover:underline"
                      >
                        {dash.menuGuestUrl}
                      </a>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void copyText(dash.menuGuestUrl)}
                          className="rounded-lg border border-brass/35 bg-brass/10 px-3 py-1.5 text-xs font-bold text-brass"
                        >
                          {copiedLink ? t.linkCopied : t.copyLink}
                        </button>
                        <LinkQrActions href={dash.menuGuestUrl} label={t.menuGuestTitle} />
                      </div>
                    </div>
                  ) : null}
                  <div className="guest-panel mt-5 overflow-x-auto rounded-2xl">
                    <table className="w-full text-start text-sm">
                      <thead className="border-b border-white/8 text-[11px] uppercase tracking-[0.12em] text-ink-soft/45">
                        <tr>
                          <th className="px-4 py-3 font-semibold">{t.colNumber}</th>
                          <th className="px-4 py-3 font-semibold">{t.colSection}</th>
                          <th className="px-4 py-3 font-semibold">{t.colStatus}</th>
                          <th className="px-4 py-3 font-semibold">{t.colGuestUrl}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tables.map((row) => (
                          <tr key={row.id} className="border-b border-white/5">
                            <td className="px-4 py-3 font-display text-lg font-semibold text-ink">
                              {row.number}
                            </td>
                            <td className="px-4 py-3 text-ink-soft">
                              {sectionLabel(row.section)}
                            </td>
                            <td className="px-4 py-3 text-ink-soft">
                              {statusLabel(row.status)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <a
                                  href={row.guestUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="break-all text-brass hover:underline"
                                >
                                  {row.guestUrl}
                                </a>
                                <LinkQrActions
                                  href={row.guestUrl}
                                  label={`Table ${row.number}`}
                                  compact
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : guestLinksNeeded ? (
                <>
                  <h2 className="font-display text-3xl font-semibold text-ink">
                    {t.navLinks}
                  </h2>
                  <p className="mt-1 text-sm text-ink-soft/50">
                    {orderingOn
                      ? t.menuGuestHintOrdering
                      : pickupOn
                        ? t.menuGuestHintPickup
                        : t.menuGuestHint}
                  </p>
                  {dash?.menuGuestUrl ? (
                    <div className="guest-panel mt-5 rounded-2xl p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft/50">
                        {t.menuGuestTitle}
                      </p>
                      <a
                        href={dash.menuGuestUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block break-all text-sm font-semibold text-brass hover:underline"
                      >
                        {dash.menuGuestUrl}
                      </a>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void copyText(dash.menuGuestUrl)}
                          className="rounded-lg border border-brass/35 bg-brass/10 px-3 py-1.5 text-xs font-bold text-brass"
                        >
                          {copiedLink ? t.linkCopied : t.copyLink}
                        </button>
                        <LinkQrActions href={dash.menuGuestUrl} label={t.menuGuestTitle} />
                      </div>
                    </div>
                  ) : null}
                  {(alertsOn || pickupOn) && dash?.alertsBoardUrl ? (
                    <div className="guest-panel mt-4 rounded-2xl p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft/50">
                        {pickupOn
                          ? t.alertsPickupBoardTitle
                          : t.alertsBoardTitle}
                      </p>
                      <p className="mt-1 text-sm text-ink-soft/55">
                        {pickupOn
                          ? t.alertsPickupBoardHint
                          : t.alertsBoardHint}
                      </p>
                      <a
                        href={dash.alertsBoardUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block break-all text-sm font-semibold text-brass hover:underline"
                      >
                        {dash.alertsBoardUrl}
                      </a>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void copyText(dash.alertsBoardUrl)}
                          className="rounded-lg border border-brass/35 bg-brass/10 px-3 py-1.5 text-xs font-bold text-brass"
                        >
                          {copiedLink ? t.linkCopied : t.copyLink}
                        </button>
                        <LinkQrActions
                          href={dash.alertsBoardUrl}
                          label={
                            pickupOn
                              ? t.alertsPickupBoardTitle
                              : t.alertsBoardTitle
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <h2 className="font-display text-3xl font-semibold text-ink">
                    {t.orderingRequiredTitle}
                  </h2>
                  <div className="guest-panel mt-5 rounded-2xl p-4">
                    <p className="text-sm text-ink-soft/70">{t.orderingRequiredBody}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setTab("menu")}
                        className="btn-primary px-4 py-2 text-sm"
                      >
                        {t.manageMenuCta}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab("package")}
                        className="btn-ghost px-4 py-2 text-sm"
                      >
                        {t.openPackageCta}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {tab === "branding" && (
            <>
              <h2 className="font-display text-3xl font-semibold text-ink">
                {t.brandingTitle}
              </h2>
              <p className="mt-1 text-sm text-ink-soft/50">{t.brandingHint}</p>

              <div className="guest-panel mt-5 space-y-4 rounded-2xl p-5">
                <label className="block">
                  <span className="text-xs font-semibold text-ink-soft">
                    {t.brandingLogo}
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        brandLogoFile
                          ? URL.createObjectURL(brandLogoFile)
                          : brandLogoPreview || brand.logoUrl || "/logo.png"
                      }
                      alt=""
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-full object-cover"
                      style={{ border: `2px solid ${brand.accentColor}` }}
                    />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="text-sm text-ink-soft file:me-3 file:rounded-lg file:border-0 file:bg-brass/20 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brass"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setBrandLogoFile(file);
                      }}
                    />
                  </div>
                </label>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      ["accentColor", t.brandingAccent],
                      ["backgroundColor", t.brandingBackground],
                      ["surfaceColor", t.brandingSurface],
                      ["textColor", t.brandingText],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block">
                      <span className="text-xs text-ink-soft/70">{label}</span>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          type="color"
                          value={brand[key]}
                          onChange={(e) =>
                            setBrand((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className="h-10 w-10 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
                        />
                        <input
                          value={brand[key]}
                          onChange={(e) =>
                            setBrand((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2 font-mono text-xs text-ink outline-none focus:border-brass/40"
                        />
                      </div>
                    </label>
                  ))}
                </div>

                <div className="space-y-3 border-t border-white/8 pt-4">
                  <div>
                    <p className="text-xs font-semibold text-ink-soft">
                      {t.brandingGuestLinks}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft/50">
                      {t.brandingGuestLinksHint}
                    </p>
                  </div>

                  <label className="block">
                    <span className="text-xs text-ink-soft/70">
                      {t.brandingPhone}
                    </span>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder={t.brandingPhonePlaceholder}
                      value={brand.phone ?? ""}
                      onChange={(e) =>
                        setBrand((prev) => ({
                          ...prev,
                          phone: e.target.value || null,
                        }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                    />
                  </label>

                  {(
                    [
                      [
                        "wazeUrl",
                        t.brandingWaze,
                        t.brandingWazePlaceholder,
                      ],
                      [
                        "instagramUrl",
                        t.brandingInstagram,
                        t.brandingInstagramPlaceholder,
                      ],
                      [
                        "facebookUrl",
                        t.brandingFacebook,
                        t.brandingFacebookPlaceholder,
                      ],
                      [
                        "tiktokUrl",
                        t.brandingTiktok,
                        t.brandingTiktokPlaceholder,
                      ],
                    ] as const
                  ).map(([key, label, placeholder]) => (
                    <label key={key} className="block">
                      <span className="text-xs text-ink-soft/70">{label}</span>
                      <input
                        type="url"
                        inputMode="url"
                        autoComplete="url"
                        placeholder={placeholder}
                        value={brand[key] ?? ""}
                        onChange={(e) =>
                          setBrand((prev) => ({
                            ...prev,
                            [key]: e.target.value || null,
                          }))
                        }
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                      />
                    </label>
                  ))}
                </div>

                <div
                  className="overflow-hidden rounded-xl border border-white/10"
                  style={{
                    background: brand.backgroundColor,
                    color: brand.textColor,
                  }}
                >
                  <div
                    className="flex items-center gap-3 border-b border-white/10 px-3 py-3"
                    style={{ background: brand.surfaceColor }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        brandLogoFile
                          ? URL.createObjectURL(brandLogoFile)
                          : brandLogoPreview || brand.logoUrl || "/logo.png"
                      }
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                      style={{ border: `2px solid ${brand.accentColor}` }}
                    />
                    <div>
                      <p
                        className="text-[10px] font-bold uppercase tracking-[0.18em]"
                        style={{ color: brand.accentColor }}
                      >
                        {t.brandingPreview}
                      </p>
                      <p className="text-sm font-semibold">
                        {dash?.venue?.name ?? t.venueFallback}
                      </p>
                      {brand.phone?.trim() ? (
                        <p className="mt-0.5 text-xs opacity-70">{brand.phone}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={brandBusy}
                  onClick={() => void saveBranding()}
                  className="btn-primary px-4 py-2.5 text-sm font-bold disabled:opacity-55"
                >
                  {brandBusy ? "…" : t.brandingSave}
                </button>
                {brandMsg ? (
                  <p className="text-sm font-semibold text-brass">{brandMsg}</p>
                ) : null}

                <div className="border-t border-white/8 pt-4">
                  <p className="text-xs font-semibold text-ink-soft">
                    Staff password
                  </p>
                  <p className="mt-1 text-xs text-ink-soft/50">
                    Unlock password for this restaurant only (admin + boards).
                    Demo “My Restaurant” can still use the global demo password.
                  </p>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="min-w-[12rem] flex-1">
                      <span className="text-xs text-ink-soft/70">New password</span>
                      <input
                        type="password"
                        minLength={4}
                        value={staffPw}
                        onChange={(e) => setStaffPw(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
                        autoComplete="new-password"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={staffPwBusy || staffPw.trim().length < 4}
                      onClick={() => {
                        void (async () => {
                          setStaffPwBusy(true);
                          setStaffPwMsg(null);
                          try {
                            const res = await fetch(
                              "/api/v1/admin/staff-password",
                              {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ password: staffPw }),
                              }
                            );
                            if (!res.ok) {
                              const data = await res.json().catch(() => null);
                              setStaffPwMsg(
                                data?.error?.message || "Could not save"
                              );
                              return;
                            }
                            setStaffPw("");
                            setStaffPwMsg("Staff password updated");
                            window.setTimeout(() => setStaffPwMsg(null), 2000);
                          } catch {
                            setStaffPwMsg("Could not save");
                          } finally {
                            setStaffPwBusy(false);
                          }
                        })();
                      }}
                      className="btn-primary px-4 py-2.5 text-sm font-bold disabled:opacity-55"
                    >
                      {staffPwBusy ? "…" : "Update password"}
                    </button>
                  </div>
                  {staffPwMsg ? (
                    <p className="mt-2 text-sm font-semibold text-brass">
                      {staffPwMsg}
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          )}

          {tab === "package" && (
            <>
              <h2 className="font-display text-3xl font-semibold text-ink">
                {t.packageTitle}
              </h2>
              <p className="mt-1 text-sm text-ink-soft/50">{t.packageHint}</p>
              <p className="mt-2 text-sm text-ink-soft/55">
                {t.packageContactLine}{" "}
                <a
                  href="mailto:jawadaa@qiktik.tech"
                  className="font-semibold text-brass hover:underline"
                >
                  jawadaa@qiktik.tech
                </a>
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {PACKAGE_OPTIONS.map((id) => {
                  const active = packageId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={packageBusy || active}
                      onClick={() => requestPackageUpgrade(id)}
                      className={`rounded-2xl border px-4 py-4 text-start transition ${
                        active
                          ? "border-brass/60 bg-brass/15"
                          : "border-white/10 bg-white/[0.03] hover:border-brass/30 disabled:opacity-55"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-ink">{packageLabel(id)}</p>
                        {active ? (
                          <span className="shrink-0 rounded-lg bg-ready/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ready">
                            {t.packageActiveBadge}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-lg bg-brass/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brass">
                            {t.packageRequestBadge}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ink-soft/50">
                        {packageDesc(id)}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="guest-panel mt-6 space-y-3 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{t.featureDigitalMenu}</p>
                    <p className="text-xs text-ink-soft/45">{t.featureAlwaysOn}</p>
                  </div>
                  <span className="rounded-lg bg-ready/15 px-2.5 py-1 text-xs font-bold text-ready">
                    {t.on}
                  </span>
                </div>
                {(
                  [
                    [t.featureAlerts, features.alerts] as const,
                    [t.featureOrdering, features.ordering] as const,
                    [t.featurePickup, features.pickup] as const,
                  ] as const
                ).map(([label, on]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 border-t border-white/8 pt-3"
                  >
                    <p className="font-semibold text-ink">{label}</p>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                        on ? "bg-ready/15 text-ready" : "bg-alert/15 text-alert"
                      }`}
                    >
                      {on ? t.on : t.off}
                    </span>
                  </div>
                ))}
              </div>

              {packageMsg ? (
                <p className="mt-3 text-sm font-semibold text-brass">{packageMsg}</p>
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
