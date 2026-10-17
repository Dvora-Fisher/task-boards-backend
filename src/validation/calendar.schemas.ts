import { z } from 'zod';
import { isoDateTime, uuid } from './common.js';
import { DAY_MS } from '../utils/dates.js';

/**
 * Range checks. Zod may still run object refinements when a field failed, so only compare real Dates.
 */
function rangeRule(maxDays: number, label: string) {
  return (v: { from: unknown; to: unknown }, ctx: z.RefinementCtx) => {
    if (!(v.from instanceof Date) || !(v.to instanceof Date)) return;
    if (v.to <= v.from) {
      ctx.addIssue({ code: 'custom', message: '"to" must be after "from"', path: ['to'] });
    } else if (v.to.getTime() - v.from.getTime() > maxDays * DAY_MS) {
      ctx.addIssue({ code: 'custom', message: `${label} can be at most ${maxDays} days`, path: ['to'] });
    }
  };
}

export const MAX_CALENDAR_RANGE_DAYS = 366;
export const MAX_SCHEDULING_RANGE_DAYS = 92;

export const calendarQuery = z
  .object({ from: isoDateTime, to: isoDateTime })
  .superRefine(rangeRule(MAX_CALENDAR_RANGE_DAYS, 'Range'));

export const schedulingSuggestionsSchema = z
  .object({
    durationMinutes: z.number().int('Must be a whole number of minutes').min(1).max(7 * 24 * 60),
    from: isoDateTime,
    to: isoDateTime,
    maxSuggestions: z.number().int().min(1).max(20).default(3),
    assignedUserId: uuid.optional(),
  })
  .superRefine(rangeRule(MAX_SCHEDULING_RANGE_DAYS, 'Search range'));

export type CalendarQuery = z.infer<typeof calendarQuery>;
export type SchedulingSuggestionsInput = z.infer<typeof schedulingSuggestionsSchema>;
