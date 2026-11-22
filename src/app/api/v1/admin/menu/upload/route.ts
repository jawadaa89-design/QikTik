import { NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { requireStaffSession } from "@/lib/staff-auth";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Upload a menu item image → public/uploads/menu/… */
export async function POST(req: NextRequest) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const form = await req.formData().catch(() => null);
  if (!form) return apiError("VALIDATION_ERROR", "Expected multipart form", 400);

  const itemId = String(form.get("itemId") ?? "");
  const file = form.get("file");

  if (!itemId) return apiError("VALIDATION_ERROR", "itemId required", 400);
  if (!(file instanceof File)) {
    return apiError("VALIDATION_ERROR", "file required", 400);
  }
  if (!ALLOWED.has(file.type)) {
    return apiError("VALIDATION_ERROR", "Use JPEG, PNG, WebP, or GIF", 400);
  }
  if (file.size > MAX_BYTES) {
    return apiError("VALIDATION_ERROR", "Image must be under 4MB", 400);
  }

  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  if (!item) return apiError("NOT_FOUND", "Menu item not found", 404);

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";

  const dir = path.join(process.cwd(), "public", "uploads", "menu");
  await mkdir(dir, { recursive: true });

  const filename = `${itemId}-${Date.now()}.${ext}`;
  const diskPath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, buffer);

  const imageUrl = `/uploads/menu/${filename}`;
  await prisma.menuItem.update({
    where: { id: itemId },
    data: { imageUrl },
  });

  return Response.json({ ok: true, imageUrl });
}
