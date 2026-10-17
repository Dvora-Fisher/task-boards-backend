export {};

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware. The identity always comes from the verified token. */
      auth?: {
        userId: string;
        sessionId: string;
      };
    }
  }
}
