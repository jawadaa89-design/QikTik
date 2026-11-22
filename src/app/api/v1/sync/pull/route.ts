import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get("since") ?? new Date(0).toISOString();

  return Response.json({
    since,
    changes: [],
  });
}
