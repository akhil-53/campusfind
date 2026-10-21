import { Router } from 'express';
import { param, query } from 'express-validator';
import prisma from '../config/prisma.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

// GET /api/notifications (User's notifications)
router.get(
  '/',
  auth,
  validate([query('unread').optional()]),
  async (req, res, next) => {
    try {
      const { unread } = req.query;
      const where = {
        userId: req.user.id
      };

      if (unread === '1' || unread === 'true') {
        where.isRead = false;
      }

      const notifications = await prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      return res.json({ data: notifications });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/notifications/count (Unread count for notification bell)
router.get('/count', auth, async (req, res, next) => {
  try {
    const unread = await prisma.notification.count({
      where: {
        userId: req.user.id,
        isRead: false
      }
    });

    return res.json({ unread });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/:id/read (Mark single notification as read)
router.post(
  '/:id/read',
  auth,
  validate([param('id').isInt({ min: 1 })]),
  async (req, res, next) => {
    try {
      const notificationId = parseInt(req.params.id, 10);

      const notif = await prisma.notification.findUnique({
        where: { notificationId }
      });

      if (!notif || notif.userId !== req.user.id) {
        throw new HttpError(404, 'Notification not found', 'NOT_FOUND');
      }

      await prisma.notification.update({
        where: { notificationId },
        data: { isRead: true }
      });

      return res.json({ message: 'Marked as read' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/notifications/read-all (Mark all notifications as read)
router.post('/read-all', auth, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false
      },
      data: { isRead: true }
    });

    return res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

export default router;
