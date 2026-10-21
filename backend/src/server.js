import app from './app.js';
import { env } from './config/env.js';
import prisma from './config/prisma.js';
import { startLocalCron } from './jobs/localCron.js';

const server = app.listen(env.PORT, async () => {
  console.log(`===============================================`);
  console.log(` CampusFind Backend listening on port ${env.PORT}`);
  console.log(` Environment: ${env.NODE_ENV}`);
  console.log(` API Base URL: http://localhost:${env.PORT}/api`);
  console.log(`===============================================`);

  // Start cron if enabled
  startLocalCron();

  // Test database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[Database] Connected to PostgreSQL database successfully.');
  } catch (err) {
    console.warn('[Database] Warning: Database connection check failed.');
    console.warn('[Database]', err.message);
    console.warn('[Database] Ensure DATABASE_URL is configured in backend/.env');
  }
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\n[Server] Shutting down gracefully...');
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } catch (e) {}
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
