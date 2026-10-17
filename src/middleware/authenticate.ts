import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../auth/jwt.js';
import { prisma } from '../db/prisma.js';
import { errors } from '../utils/AppError.js';

/**
 * Requires "Authorization: Bearer <token>".
 * The token must be valid AND its session must still be active (not logged out, not expired).
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header) throw errors.unauthorized();

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw errors.invalidToken('Authorization header must be "Bearer <token>"');
  }

  const payload = verifyAccessToken(token);
  if (!payload) throw errors.invalidToken();

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    select: { userId: true, revokedAt: true, expiresAt: true },
  });
  if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) {
    throw errors.invalidToken('Session has ended. Please log in again');
  }

  req.auth = { userId: payload.sub, sessionId: payload.sid };
  next();
};

/** Helper for controllers that run after `authenticate`. */
export function requireAuth(req: Express.Request): { userId: string; sessionId: string } {
  if (!req.auth) throw errors.unauthorized();
  return req.auth;
}
