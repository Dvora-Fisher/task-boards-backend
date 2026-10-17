import { z } from 'zod';
import { dateOnly, description, isoDateTime, paginationQuery, queryBoolean, title, userIdList } from './common.js';

export const taskStatus = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);
export const taskPriority = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const audience = z.enum(['BOARD', 'SELECTED']);
export const scheduleType = z.enum(['NONE', 'DATE', 'TIMED']);

const scheduleFields = {
  dueDate: dateOnly.nullable().optional(),
  startAt: isoDateTime.nullable().optional(),
  endAt: isoDateTime.nullable().optional(),
};

/** Schedule rules shared by create and update (update checks them again after merging with the stored task). */
export function checkSchedule(
  v: { dueDate?: string | null; startAt?: Date | null; endAt?: Date | null },
  ctx: { addIssue: (issue: { code: 'custom'; message: string; path: string[] }) => void },
): void {
  const hasStart = v.startAt != null;
  const hasEnd = v.endAt != null;
  if (hasStart !== hasEnd) {
    ctx.addIssue({ code: 'custom', message: 'startAt and endAt must be sent together', path: [hasStart ? 'endAt' : 'startAt'] });
  }
  if (hasStart && hasEnd && v.endAt! <= v.startAt!) {
    ctx.addIssue({ code: 'custom', message: 'endAt must be after startAt', path: ['endAt'] });
  }
  if (v.dueDate != null && (hasStart || hasEnd)) {
    ctx.addIssue({
      code: 'custom',
      message: 'A task is either date-only (dueDate) or timed (startAt + endAt), not both',
      path: ['dueDate'],
    });
  }
}

export const createTaskSchema = z
  .object({
    title,
    description: description.optional(),
    status: taskStatus.default('TODO'),
    priority: taskPriority.default('MEDIUM'),
    audience: audience.default('BOARD'),
    assigneeIds: userIdList.default([]),
    ...scheduleFields,
  })
  .superRefine((v, ctx) => {
    checkSchedule(v, ctx);
    if (v.audience === 'SELECTED' && v.assigneeIds.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Select at least one user for a SELECTED task', path: ['assigneeIds'] });
    }
  });

export const updateTaskSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    status: taskStatus.optional(),
    priority: taskPriority.optional(),
    audience: audience.optional(),
    assigneeIds: userIdList.optional(),
    ...scheduleFields,
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Send at least one field to update' });

/** Comma-separated enum list in the query string, e.g. status=TODO,IN_PROGRESS */
const commaList = z.string().transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean));

export const listTasksQuery = z
  .object({
    status: commaList.pipe(z.array(taskStatus).min(1)).optional(),
    priority: commaList.pipe(z.array(taskPriority).min(1)).optional(),
    schedule: scheduleType.optional(),
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
    search: z.string().trim().max(100).optional(),
    assignedToMe: queryBoolean.optional(),
    sort: z.enum(['createdAt', 'updatedAt', 'title', 'startAt', 'dueDate']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    ...paginationQuery,
  })
  .refine((v) => !v.from || !v.to || v.to > v.from, { message: '"to" must be after "from"', path: ['to'] });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuery>;
