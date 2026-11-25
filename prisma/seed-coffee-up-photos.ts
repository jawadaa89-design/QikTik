/**
 * Attach generic stock photos to Coffee Up menu items (Unsplash → Vercel Blob).
 *
 *   npx tsx prisma/seed-coffee-up-photos.ts
 */
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";

const prisma = new PrismaClient();
const VENUE_SLUG = "coffee-up";

/** Curated Unsplash stills — one generic photo per menu SKU. */
const PHOTO_BY_SKU: Record<string, string> = {
  "cu-espresso":
    "https://images.unsplash.com/photo-1510590337019-5ef8d3d32116?auto=format&fit=crop&w=800&q=80",
  "cu-espresso-double":
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
  "cu-cappuccino":
    "https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=800&q=80",
  "cu-americano":
    "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=800&q=80",
  "cu-ilan":
    "https://images.unsplash.com/photo-1561882468-9110e03e0f78?auto=format&fit=crop&w=800&q=80",
  "cu-matcha":
    "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=800&q=80",
  "cu-nescafe":
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80",
  "cu-hot-chocolate":
    "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=800&q=80",
  "cu-tea":
    "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80",
  "cu-iced-coffee":
    "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=80",
  "cu-iced-americano":
    "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=80",
  "cu-mocktails":
    "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80",
  "cu-affogato":
    "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80",
  "cu-tiramisu":
    "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=800&q=80",
};

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": "QikTik-menu-seed/1.0" },
  });
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required to store durable photos");
  }

  const venue = await prisma.venue.findUnique({ where: { slug: VENUE_SLUG } });
  if (!venue) throw new Error(`Venue "${VENUE_SLUG}" not found`);

  const items = await prisma.menuItem.findMany({
    where: { category: { venueId: venue.id } },
    select: { id: true, sku: true },
  });

  let updated = 0;
  let failed = 0;
  for (const item of items) {
    const sku = item.sku || "";
    const source = PHOTO_BY_SKU[sku];
    if (!source) {
      console.warn(`  skip ${sku || item.id}: no stock photo mapped`);
      failed += 1;
      continue;
    }

    // Skip items that already have a Blob photo (re-runs are safe).
    const existing = await prisma.menuItem.findUnique({
      where: { id: item.id },
      select: { imageUrl: true },
    });
    if (
      existing?.imageUrl?.includes("blob.vercel-storage.com") ||
      existing?.imageUrl?.includes("public.blob.vercel-storage.com")
    ) {
      console.log(`  ${sku}… already set`);
      updated += 1;
      continue;
    }

    process.stdout.write(`  ${sku}… `);
    try {
      const buffer = await download(source);
      const blob = await put(
        `venues/${venue.id}/menu/${sku}-${Date.now()}.jpg`,
        buffer,
        {
          access: "public",
          contentType: "image/jpeg",
          token,
        }
      );

      await prisma.menuItem.update({
        where: { id: item.id },
        data: { imageUrl: blob.url },
      });
      console.log("ok");
      updated += 1;
    } catch (err) {
      failed += 1;
      console.log("FAIL");
      console.error(err);
    }
  }

  console.log(`\n✓ Coffee Up photos: ${updated} ok, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
