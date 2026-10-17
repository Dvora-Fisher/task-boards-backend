import type { Response } from 'express';

/** Sends the unified success envelope: { success: true, data } */
export function sendData<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}
