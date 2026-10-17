import { z } from 'zod';

export const uuid = z.uuid({ message: 'Must be a valid UUID' });

/** ISO 8601 date-time WITH a timezone (Z or ±hh:mm), returned as a Date. */
export const isoDateTime = z
  .iso.datetime({ offset: true, message: 'Must be an ISO 8601 date-time with timezone, e.g. 2026-11-02T09:00:00Z' })
  .transform((v) => new Date(v));

/** "YYYY-MM-DD" calendar date (no time). */
export const dateOnly = z.iso.date({ message: 'Must be a date in the format YYYY-MM-DD' });

const trimmedOptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v));

export const title = z.string().trim().min(1, 'Title is required').max(200);
export const description = trimmedOptionalText(5000).nullable();

export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

/** Query-string boolean: accepts true/false/1/0. */
export const queryBoolean = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

export const boardIdParams = z.object({ boardId: uuid });
export const taskIdParams = z.object({ taskId: uuid });
export const reminderIdParams = z.object({ reminderId: uuid });
export const memberParams = z.object({ boardId: uuid, userId: uuid });

/** Deduplicated list of user ids. */
export const userIdList = z
  .array(uuid)
  .max(50)
  .transform((ids) => [...new Set(ids)]);
