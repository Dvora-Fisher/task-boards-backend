import { prisma } from '../db/prisma.js';
import { loadBoardAccess, visibleReminderWhere, visibleTaskWhere } from '../authorization/boardAccess.js';
import { dateToDateOnly, startOfUtcDay } from '../utils/dates.js';
import type { CalendarQuery } from '../validation/calendar.schemas.js';

export interface CalendarEvent {
  type: 'TASK' | 'REMINDER';
  id: string;
  boardId: string;
  title: string;
  description: string | null;
  /** true for date-only tasks — show as an all-day item on `date` */
  allDay: boolean;
  /** "YYYY-MM-DD" for all-day items, otherwise null */
  date: string | null;
  /** timed task start / reminder moment; null for all-day items */
  startAt: string | null;
  /** timed task end; null for reminders and all-day items */
  endAt: string | null;
  /** true only for timed tasks that are not DONE (these count as busy time) */
  blocksTime: boolean;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  audience: 'BOARD' | 'SELECTED';
}

/** Sort key: all-day items first on their day, then by start time. */
function sortKey(e: CalendarEvent): string {
  return e.allDay ? `${e.date}T00:00:00.000Z#0` : `${e.startAt}#1`;
}

export async function getCalendar(boardId: string, userId: string, q: CalendarQuery) {
  await loadBoardAccess(boardId, userId);

  const [timed, dated, reminders] = await Promise.all([
    prisma.task.findMany({
      where: { boardId, ...visibleTaskWhere(userId), startAt: { lt: q.to }, endAt: { gt: q.from } },
    }),
    prisma.task.findMany({
      where: { boardId, ...visibleTaskWhere(userId), dueDate: { gte: startOfUtcDay(q.from), lt: q.to } },
    }),
    prisma.reminder.findMany({
      where: { boardId, ...visibleReminderWhere(userId), remindAt: { gte: q.from, lt: q.to } },
    }),
  ]);

  const events: CalendarEvent[] = [
    ...timed.map((t) => ({
      type: 'TASK' as const,
      id: t.id,
      boardId: t.boardId,
      title: t.title,
      description: t.description,
      allDay: false,
      date: null,
      startAt: t.startAt!.toISOString(),
      endAt: t.endAt!.toISOString(),
      blocksTime: t.status !== 'DONE',
      status: t.status,
      priority: t.priority,
      audience: t.audience,
    })),
    ...dated.map((t) => ({
      type: 'TASK' as const,
      id: t.id,
      boardId: t.boardId,
      title: t.title,
      description: t.description,
      allDay: true,
      date: dateToDateOnly(t.dueDate!),
      startAt: null,
      endAt: null,
      blocksTime: false,
      status: t.status,
      priority: t.priority,
      audience: t.audience,
    })),
    ...reminders.map((r) => ({
      type: 'REMINDER' as const,
      id: r.id,
      boardId: r.boardId,
      title: r.title,
      description: r.description,
      allDay: false,
      date: null,
      startAt: r.remindAt.toISOString(),
      endAt: null,
      blocksTime: false,
      status: null,
      priority: null,
      audience: r.audience,
    })),
  ];

  events.sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.id.localeCompare(b.id));
  return { from: q.from.toISOString(), to: q.to.toISOString(), events };
}
