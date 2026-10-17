import type { Request, Response } from 'express';
import { getCalendar } from '../services/calendar.service.js';
import { suggestSlots } from '../services/scheduling.service.js';
import { requireAuth } from '../middleware/authenticate.js';
import { sendData } from '../utils/response.js';
import { boardIdParams } from '../validation/common.js';
import { calendarQuery, schedulingSuggestionsSchema } from '../validation/calendar.schemas.js';

export async function calendar(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { boardId } = boardIdParams.parse(req.params);
  sendData(res, await getCalendar(boardId, userId, calendarQuery.parse(req.query)));
}

export async function suggestions(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { boardId } = boardIdParams.parse(req.params);
  sendData(res, await suggestSlots(boardId, userId, schedulingSuggestionsSchema.parse(req.body)));
}
