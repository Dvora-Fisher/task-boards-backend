import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { openApiDocument } from './docs/openapi.js';

export function createApp() {
  const app = express();

  // Render (and most clouds) sit behind a proxy — needed for correct client IPs in rate limiting.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    cors({
      origin(origin, callback) {
        // requests without Origin (curl, Swagger on the same host, server-to-server) are allowed
        if (!origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) return callback(null, true);
        callback(null, false);
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  // Swagger UI (its own CSP, because the UI uses inline styles)
  app.get('/api-docs/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    '/api-docs',
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'Task Boards API',
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    }),
  );

  app.use('/api', helmet(), apiRouter);

  app.get('/', (_req, res) => {
    res.json({ success: true, data: { name: 'Task Boards API', docs: '/api-docs', health: '/api/health' } });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
