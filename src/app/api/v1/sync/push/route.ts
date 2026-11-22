import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  return Response.json({
    synced: (body.entries ?? []).map((e: { id: string }) => e.id),
    syncedAt: new Date().toISOString(),
  });
}
