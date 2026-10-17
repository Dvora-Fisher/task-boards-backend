import type { Request, Response } from 'express';
import * as reminderService from '../services/reminder.service.js';
import { requireAuth } from '../middleware/authenticate.js';
import { sendData, sendNoContent } from '../utils/response.js';
import { boardIdParams, reminderIdParams } from '../validation/common.js';
import { createReminderSchema, listRemindersQuery, updateReminderSchema } from '../validation/reminder.schemas.js';

export async function list(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { boardId } = boardIdParams.parse(req.params);
  sendData(res, await reminderService.listReminders(boardId, userId, listRemindersQuery.parse(req.query)));
}

export async function create(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { boardId } = boardIdParams.parse(req.params);
  sendData(res, await reminderService.createReminder(boardId, userId, createReminderSchema.parse(req.body)), 201);
}

export async function get(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { reminderId } = reminderIdParams.parse(req.params);
  sendData(res, await reminderService.getReminder(reminderId, userId));
}

export async function update(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { reminderId } = reminderIdParams.parse(req.params);
  sendData(res, await reminderService.updateReminder(reminderId, userId, updateReminderSchema.parse(req.body)));
}

export async function remove(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { reminderId } = reminderIdParams.parse(req.params);
  await reminderService.deleteReminder(reminderId, userId);
  sendNoContent(res);
}
