export async function GET() {
  const mode = process.env.DEPLOYMENT_MODE ?? "cloud";
  const online = process.env.EDGE_ONLINE === "true" || mode === "cloud";

  return Response.json({
    mode,
    online,
    lastSyncAt: new Date().toISOString(),
    printer: "ok",
    db: "ok",
  });
}
