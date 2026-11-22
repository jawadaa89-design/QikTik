import type { NextRequest } from "next/server";
import type { Venue } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";

export { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";

export type VenueResolveInput = {
  /** Explicit slug (query, body, or header). */
  slug?: string | null;
  /** Explicit id when already known. */
  id?: string | null;
  /** Optional request — used to read query/header when slug/id omitted. */
  req?: NextRequest | Request | null;
};

function slugFromRequest(req: NextRequest | Request): string | null {
  try {
    const url = "nextUrl" in req ? req.nextUrl : new URL(req.url);
    const fromQuery =
      url.searchParams.get("venue")?.trim() ||
      url.searchParams.get("venueSlug")?.trim();
    if (fromQuery) return fromQuery;

    const header =
      req.headers.get("x-venue-slug")?.trim() ||
      req.headers.get("x-venue")?.trim();
    if (header) return header;
  } catch {
    /* ignore malformed URL */
  }
  return null;
}

/**
 * Resolve a venue for API/server code.
 * Priority: id → slug → request query/header → DEFAULT_VENUE_SLUG → oldest venue.
 */
export async function resolveVenue(
  input: VenueResolveInput = {}
): Promise<Venue | null> {
  const { id, req } = input;
  if (id?.trim()) {
    return prisma.venue.findUnique({ where: { id: id.trim() } });
  }

  const slug =
    input.slug?.trim() ||
    (req ? slugFromRequest(req) : null) ||
    DEFAULT_VENUE_SLUG;

  if (slug) {
    const bySlug = await prisma.venue.findUnique({ where: { slug } });
    if (bySlug) return bySlug;
  }

  // Last resort for legacy single-venue demos
  return prisma.venue.findFirst({ orderBy: { createdAt: "asc" } });
}

/** Same as resolveVenue but for Next.js route handlers. */
export async function resolveVenueFromRequest(
  req: NextRequest | Request,
  overrides: { slug?: string | null; id?: string | null } = {}
): Promise<Venue | null> {
  return resolveVenue({ req, ...overrides });
}

export async function requireVenue(
  req: NextRequest | Request,
  overrides: { slug?: string | null; id?: string | null } = {}
): Promise<{ venue: Venue } | { error: Response }> {
  const venue = await resolveVenueFromRequest(req, overrides);
  if (!venue) {
    return {
      error: Response.json(
        { error: { code: "VENUE_NOT_FOUND", message: "Venue not found" } },
        { status: 404 }
      ),
    };
  }
  return { venue };
}
