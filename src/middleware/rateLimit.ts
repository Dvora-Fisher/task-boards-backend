import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

/** Limits brute-force attempts on login/register (per IP). */
export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60_000,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later' },
    });
  },
});
