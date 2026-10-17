import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';

/** Liveness + database connectivity check (used by Render's health check). */
export async function health(_req: Request, res: Response) {
  let database: 'up' | 'down' = 'up';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'down';
  }
  const ok = database === 'up';
  res.status(ok ? 200 : 503).json({
    success: ok,
    ...(ok
      ? { data: { status: 'ok', database, uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() } }
      : { error: { code: 'DATABASE_UNAVAILABLE', message: 'Database connection failed' } }),
  });
}
