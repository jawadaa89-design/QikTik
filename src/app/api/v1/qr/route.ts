import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { apiError } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/qr?url=https://… — PNG QR for share/print (admin / platform links).
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim() || "";
  if (!url || url.length > 2048) {
    return apiError("VALIDATION_ERROR", "url required", 400);
  }
  if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {
    return apiError("VALIDATION_ERROR", "url must be http(s) or absolute path", 400);
  }

  let target = url;
  if (url.startsWith("/")) {
    const host =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      req.headers.get("host") ||
      "app.qiktik.tech";
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    target = `${proto}://${host}${url}`;
  }

  try {
    const png = await QRCode.toBuffer(target, {
      type: "png",
      width: 640,
      margin: 3,
      errorCorrectionLevel: "M",
      color: { dark: "#0c100e", light: "#ffffff" },
    });
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return apiError("QR_FAILED", "Could not generate QR", 500);
  }
}
