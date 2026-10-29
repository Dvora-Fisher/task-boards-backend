import { assertBoardUsers, loadBoardAccess } from '../authorization/boardAccess.js';
import { MINUTE_MS } from '../utils/dates.js';
import type { SchedulingSuggestionsInput } from '../validation/calendar.schemas.js';
import { findBusyIntervals, findFreeSlots } from './availability.js';

/**
 * Suggests free time slots for a user who belongs to the board.
 * Busy time = the user's timed, not-DONE tasks on THIS board only. Nothing is saved.
 */
export async function suggestSlots(boardId: string, userId: string, input: SchedulingSuggestionsInput) {
  const { board } = await loadBoardAccess(boardId, userId);
  const targetUserId = input.assignedUserId ?? userId;
  await assertBoardUsers(board, [targetUserId]);

  const range = { start: input.from, end: input.to };
  const busy = await findBusyIntervals(boardId, targetUserId, range);
  const slots = findFreeSlots(busy, range, input.durationMinutes * MINUTE_MS, input.maxSuggestions);

  return {
    suggestions: slots.map((s) => ({ startAt: s.start.toISOString(), endAt: s.end.toISOString() })),
  };
}
