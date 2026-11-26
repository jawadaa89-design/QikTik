import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Max size for venue logos and menu item photos. */
export const MAX_VENUE_IMAGE_BYTES = 4 * 1024 * 1024;

export function assertVenueImageFile(file: File): string | null {
  if (!ALLOWED.has(file.type)) {
    return "Use JPEG, PNG, WebP, or GIF";
  }
  if (file.size > MAX_VENUE_IMAGE_BYTES) {
    return "Image must be under 4MB";
  }
  return null;
}

/** @deprecated Prefer assertVenueImageFile */
export function assertLogoFile(file: File): string | null {
  return assertVenueImageFile(file);
}

function extForType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

async function storePublicImage(
  blobPath: string,
  localRelDir: string,
  filename: string,
  file: File
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    const blob = await put(blobPath, buffer, {
      access: "public",
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN.trim(),
    });
    return blob.url;
  }

  const dir = path.join(process.cwd(), "public", localRelDir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return `/${localRelDir.replace(/\\/g, "/")}/${filename}`;
}

/**
 * Store venue logo: Vercel Blob when BLOB_READ_WRITE_TOKEN is set,
 * otherwise local public/uploads/venues/{venueId}/ (dev only).
 */
export async function storeVenueLogo(
  venueId: string,
  file: File
): Promise<string> {
  const ext = extForType(file.type);
  const filename = `logo-${Date.now()}.${ext}`;
  return storePublicImage(
    `venues/${venueId}/${filename}`,
    path.join("uploads", "venues", venueId),
    filename,
    file
  );
}

/**
 * Store guest-home atmosphere / cafe photo for the Photo Stage landing.
 */
export async function storeVenueHeroImage(
  venueId: string,
  file: File
): Promise<string> {
  const ext = extForType(file.type);
  const filename = `hero-${Date.now()}.${ext}`;
  return storePublicImage(
    `venues/${venueId}/${filename}`,
    path.join("uploads", "venues", venueId),
    filename,
    file
  );
}

/**
 * Store menu item photo per venue (survives redeploy when Blob token is set).
 */
export async function storeMenuItemImage(
  venueId: string,
  itemId: string,
  file: File
): Promise<string> {
  const ext = extForType(file.type);
  const filename = `${itemId}-${Date.now()}.${ext}`;
  return storePublicImage(
    `venues/${venueId}/menu/${filename}`,
    path.join("uploads", "menu", venueId),
    filename,
    file
  );
}
