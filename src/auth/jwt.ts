import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  /** user id */
  sub: string;
  /** session id — checked against the sessions table on every request */
  sid: string;
}

const ISSUER = 'task-boards-api';

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign({ sid: payload.sid }, env.JWT_SECRET, {
    subject: payload.sub,
    issuer: ISSUER,
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN_MINUTES * 60,
  });
}

/** Returns the payload, or null when the token is malformed, tampered with or expired. */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: ISSUER, algorithms: ['HS256'] });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || typeof decoded.sid !== 'string') {
      return null;
    }
    return { sub: decoded.sub, sid: decoded.sid };
  } catch {
    return null;
  }
}
