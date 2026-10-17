import type { Request, Response } from 'express';
import * as taskService from '../services/task.service.js';
import { requireAuth } from '../middleware/authenticate.js';
import { sendData, sendNoContent } from '../utils/response.js';
import { boardIdParams, taskIdParams } from '../validation/common.js';
import { createTaskSchema, listTasksQuery, updateTaskSchema } from '../validation/task.schemas.js';

export async function list(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { boardId } = boardIdParams.parse(req.params);
  sendData(res, await taskService.listTasks(boardId, userId, listTasksQuery.parse(req.query)));
}

export async function create(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { boardId } = boardIdParams.parse(req.params);
  sendData(res, await taskService.createTask(boardId, userId, createTaskSchema.parse(req.body)), 201);
}

export async function get(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { taskId } = taskIdParams.parse(req.params);
  sendData(res, await taskService.getTask(taskId, userId));
}

export async function update(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { taskId } = taskIdParams.parse(req.params);
  sendData(res, await taskService.updateTask(taskId, userId, updateTaskSchema.parse(req.body)));
}

export async function remove(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { taskId } = taskIdParams.parse(req.params);
  await taskService.deleteTask(taskId, userId);
  sendNoContent(res);
}
