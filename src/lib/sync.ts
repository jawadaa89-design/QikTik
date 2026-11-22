import type { SyncEntityType, SyncOperation } from "@prisma/client";

export type SyncEntry = {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  createdAt: Date;
};

const SYNC_INTERVAL_MS = 30_000;

let syncTimer: ReturnType<typeof setInterval> | null = null;

export async function pushToCloud(entries: SyncEntry[]): Promise<string[]> {
  const cloudUrl = process.env.CLOUD_SYNC_URL;
  if (!cloudUrl) return [];

  try {
    const res = await fetch(`${cloudUrl}/api/v1/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { synced: string[] };
    return data.synced;
  } catch {
    return [];
  }
}

export async function pullFromCloud(since: Date): Promise<Record<string, unknown>[]> {
  const cloudUrl = process.env.CLOUD_SYNC_URL;
  if (!cloudUrl) return [];

  try {
    const res = await fetch(
      `${cloudUrl}/api/v1/sync/pull?since=${since.toISOString()}`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { changes: Record<string, unknown>[] };
    return data.changes;
  } catch {
    return [];
  }
}

export function isOnline(): boolean {
  const cloudUrl = process.env.CLOUD_SYNC_URL;
  if (!cloudUrl) return false;
  // Edge server sets this after health check
  return process.env.EDGE_ONLINE === "true";
}

export function startSyncLoop(onPush: () => Promise<SyncEntry[]>): void {
  if (syncTimer) return;

  syncTimer = setInterval(async () => {
    if (!isOnline()) return;
    const pending = await onPush();
    if (pending.length === 0) return;
    const synced = await pushToCloud(pending);
    console.log(`[sync] pushed ${synced.length}/${pending.length} entries`);
  }, SYNC_INTERVAL_MS);
}

export function stopSyncLoop(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
