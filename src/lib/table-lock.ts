/** Idle lock before guest must re-enter table password (ms). Default 5 minutes. */
export const TABLE_LOCK_MS = Number(
  process.env.NEXT_PUBLIC_TABLE_LOCK_MS ?? 5 * 60 * 1000
);
