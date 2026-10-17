import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { requireAuth } from '../middleware/authenticate.js';
import { sendData } from '../utils/response.js';
import { loginSchema, registerSchema } from '../validation/auth.schemas.js';

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  sendData(res, await authService.register(input), 201);
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  sendData(res, await authService.login(input));
}

export async function logout(req: Request, res: Response) {
  const { sessionId } = requireAuth(req);
  await authService.logout(sessionId);
  sendData(res, { loggedOut: true });
}

export async function me(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  sendData(res, { user: await authService.getMe(userId) });
}
