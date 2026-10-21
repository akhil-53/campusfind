import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

let prisma;

try {
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL
      }
    },
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });
} catch (err) {
  console.warn('[Prisma] Client initialization warning:', err.message);
  prisma = new PrismaClient();
}

export default prisma;
