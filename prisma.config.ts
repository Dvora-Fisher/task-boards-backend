import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 reads the connection string from here (not from schema.prisma).
// `prisma generate` does not need a database, so an empty value is allowed at build time.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
