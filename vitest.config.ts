import 'dotenv/config';
import { defineConfig } from 'vitest/config';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is not set. Add it to .env (see .env.example). Tests delete all data in that database!');
}
if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must be different from DATABASE_URL — tests delete all data.');
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/globalSetup.ts'],
    // every test file uses the same database, so files run one after another
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-that-is-long-enough-for-hs256-signing',
      AUTH_RATE_LIMIT_MAX: '100000',
      CORS_ORIGINS: 'http://localhost:5173',
    },
  },
});
