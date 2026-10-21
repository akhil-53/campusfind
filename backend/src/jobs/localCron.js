import cron from 'node-cron';
import { env } from '../config/env.js';
import prisma from '../config/prisma.js';

export function startLocalCron() {
  if (!env.ENABLE_APP_CRON) {
    return;
  }

  console.log('[Cron] Starting local node-cron job (every 5 minutes)...');

  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('[Cron] Executing CALL sp_run_jobs()...');
      await prisma.$executeRaw`CALL sp_run_jobs()`;
      console.log('[Cron] sp_run_jobs() completed successfully.');
    } catch (err) {
      console.error('[Cron] sp_run_jobs() error:', err.message);
    }
  });
}
