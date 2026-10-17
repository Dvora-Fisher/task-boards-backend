/** "2026-11-02" -> Date at 2026-11-02T00:00:00.000Z (how Prisma represents a DATE column). */
export function dateOnlyToDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Date from a DATE column -> "2026-11-02" */
export function dateToDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** UTC calendar day (00:00Z) that contains the given instant. */
export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export const MINUTE_MS = 60_000;
export const DAY_MS = 24 * 60 * MINUTE_MS;
