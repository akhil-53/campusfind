import prisma from '../config/prisma.js';

export const asUser = (userId, fn) =>
  prisma.$transaction(async (tx) => {
    if (userId) {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${String(userId)}, true)`;
    }
    return fn(tx);
  });
