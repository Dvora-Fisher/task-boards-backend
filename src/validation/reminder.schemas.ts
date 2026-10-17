import { z } from 'zod';
import { description, isoDateTime, paginationQuery, title, userIdList } from './common.js';
import { audience } from './task.schemas.js';

export const createReminderSchema = z
  .object({
    title,
    description: description.optional(),
    remindAt: isoDateTime,
    audience: audience.default('BOARD'),
    recipientIds: userIdList.default([]),
  })
  .refine((v) => v.audience !== 'SELECTED' || v.recipientIds.length > 0, {
    message: 'Select at least one user for a SELECTED reminder',
    path: ['recipientIds'],
  });

export const updateReminderSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    remindAt: isoDateTime.optional(),
    audience: audience.optional(),
    recipientIds: userIdList.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Send at least one field to update' });

export const listRemindersQuery = z
  .object({
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
    search: z.string().trim().max(100).optional(),
    ...paginationQuery,
  })
  .refine((v) => !v.from || !v.to || v.to > v.from, { message: '"to" must be after "from"', path: ['to'] });

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type ListRemindersQuery = z.infer<typeof listRemindersQuery>;
