/** UTC calendar day at 00:00:00.000Z for unique menu-visitor bucketing. */
export function utcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
