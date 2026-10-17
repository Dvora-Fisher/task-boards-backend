import type { Prisma } from '../generated/prisma/client.js';
import type { TxClient } from '../db/prisma.js';
import { prisma } from '../db/prisma.js';

export interface Interval {
  start: Date;
  end: Date;
}

/**
 * Which tasks occupy a user's time:
 *  - timed (startAt + endAt), not DONE
 *  - assigned to the user, OR created by the user with nobody assigned
 * Date-only tasks, unscheduled tasks, DONE tasks and reminders never block time.
 * Tasks from ALL boards are considered.
 */
export function blockingTaskWhere(userIds: string[], range: Interval, excludeTaskId?: string): Prisma.TaskWhereInput {
  return {
    status: { not: 'DONE' },
    startAt: { lt: range.end },
    endAt: { gt: range.start },
    ...(excludeTaskId && { id: { not: excludeTaskId } }),
    OR: [
      { assignments: { some: { userId: { in: userIds } } } },
      { createdById: { in: userIds }, assignments: { none: {} } },
    ],
  };
}

/** The users whose time a timed task occupies: its assignees, or the creator when nobody is assigned. */
export function blockedUsersFor(assigneeIds: string[], creatorId: string | null): string[] {
  if (assigneeIds.length > 0) return assigneeIds;
  return creatorId ? [creatorId] : [];
}

export async function findBusyIntervals(userId: string, range: Interval, db: TxClient | typeof prisma = prisma): Promise<Interval[]> {
  const tasks = await db.task.findMany({
    where: blockingTaskWhere([userId], range),
    select: { startAt: true, endAt: true },
    orderBy: { startAt: 'asc' },
  });
  return tasks.map((t) => ({ start: t.startAt!, end: t.endAt! }));
}

/** Sorts and merges overlapping/touching intervals. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [];
  for (const cur of sorted) {
    const last = merged.at(-1);
    if (last && cur.start.getTime() <= last.end.getTime()) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      merged.push({ start: cur.start, end: cur.end });
    }
  }
  return merged;
}

/**
 * Deterministic free-slot search.
 * Walks the free gaps between busy intervals inside [range.start, range.end) and cuts
 * back-to-back slots of `durationMs` from each gap, earliest first, until `max` slots are found.
 */
export function findFreeSlots(busy: Interval[], range: Interval, durationMs: number, max: number): Interval[] {
  const slots: Interval[] = [];
  let cursor = range.start.getTime();
  const rangeEnd = range.end.getTime();

  const gaps: Array<[number, number]> = [];
  for (const b of mergeIntervals(busy)) {
    const bStart = Math.max(b.start.getTime(), range.start.getTime());
    const bEnd = Math.min(b.end.getTime(), rangeEnd);
    if (bEnd <= cursor) continue;
    if (bStart > cursor) gaps.push([cursor, bStart]);
    cursor = Math.max(cursor, bEnd);
  }
  if (cursor < rangeEnd) gaps.push([cursor, rangeEnd]);

  for (const [gapStart, gapEnd] of gaps) {
    for (let s = gapStart; s + durationMs <= gapEnd; s += durationMs) {
      slots.push({ start: new Date(s), end: new Date(s + durationMs) });
      if (slots.length >= max) return slots;
    }
  }
  return slots;
}

/**
 * Serialises concurrent writes that affect the same users' calendars.
 * Transaction-scoped advisory locks are taken in a fixed (sorted) order to avoid deadlocks,
 * and are released automatically on commit/rollback.
 */
export async function lockUsersCalendars(tx: TxClient, userIds: string[]): Promise<void> {
  for (const id of [...new Set(userIds)].sort()) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 7))::text AS locked`;
  }
}

export async function findConflicts(tx: TxClient, userIds: string[], range: Interval, excludeTaskId?: string): Promise<Interval[]> {
  if (userIds.length === 0) return [];
  const tasks = await tx.task.findMany({
    where: blockingTaskWhere(userIds, range, excludeTaskId),
    select: { startAt: true, endAt: true },
    orderBy: { startAt: 'asc' },
    take: 20,
  });
  return tasks.map((t) => ({ start: t.startAt!, end: t.endAt! }));
}
