import os from "os";
import type { NextRequest } from "next/server";

/** First non-internal IPv4 (Wi‑Fi / Ethernet) for phone LAN access. */
export function getLanIPv4(): string | null {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const net of entries) {
      const family = String(net.family);
      if ((family === "IPv4" || family === "4") && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

function isLoopbackHost(host: string): boolean {
  const hostname = host.split(":")[0]?.replace(/^\[|\]$/g, "") ?? "";
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

/**
 * Base URL for guest QR / NFC links.
 *
 * Prefer the **request Host** (Cloudflare tunnel, reverse proxy, LAN IP the
 * browser actually used) over `NEXT_PUBLIC_MENU_BASE_URL` whenever the request
 * is not loopback. That way a guest on `https://….trycloudflare.com` gets
 * tunnel URLs even if `.env` still points at a LAN `http://10.0.0.x:3000`.
 *
 * Fall back to env when generating links from localhost (dev machine → phone),
 * then auto-detected LAN IP.
 */
export function getPublicBaseUrl(req?: NextRequest | Request): string {
  if (req) {
    const proto =
      req.headers.get("x-forwarded-proto") ??
      (process.env.NODE_ENV === "production" ? "https" : "http");
    const host =
      req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    if (host && !isLoopbackHost(host)) {
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  }

  const fromEnv = process.env.NEXT_PUBLIC_MENU_BASE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const lan = getLanIPv4();
  if (lan) return `http://${lan}:3000`;

  return "http://localhost:3000";
}
