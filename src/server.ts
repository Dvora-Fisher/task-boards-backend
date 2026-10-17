import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT}`);
  console.log(`Swagger UI:   http://localhost:${env.PORT}/api-docs`);
  console.log(`Health check: http://localhost:${env.PORT}/api/health`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
