import { Router } from 'express';
import prisma from '../config/prisma.js';

const router = Router();

// GET /api/health
router.get('/health', async (req, res) => {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (err) {
    dbOk = false;
  }
  return res.json({ ok: true, db: dbOk });
});

// GET /api/meta
router.get('/meta', async (req, res, next) => {
  try {
    const [categories, locations, settings] = await Promise.all([
      prisma.category.findMany({ where: { isActive: true }, orderBy: { categoryName: 'asc' } }),
      prisma.location.findMany({ where: { isActive: true }, orderBy: [{ block: 'asc' }, { roomName: 'asc' }] }),
      prisma.systemSetting.findMany({
        where: {
          settingKey: {
            in: [
              'room_visit_hours',
              'lost_found_room',
              'default_verification_venue',
              'visit_window_days'
            ]
          }
        }
      })
    ]);

    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.settingKey] = s.settingValue;
    });

    return res.json({
      categories,
      locations,
      settings: settingsMap
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/verify/:code
router.get('/public/verify/:code', async (req, res, next) => {
  try {
    const code = req.params.code.trim().toUpperCase();

    const letter = await prisma.handoverLetter.findUnique({
      where: { verifyCode: code },
      include: {
        verification: {
          include: {
            match: {
              include: {
                foundItem: {
                  include: {
                    category: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!letter) {
      return res.status(404).json({
        valid: false,
        message: 'Invalid or unknown verification code.'
      });
    }

    return res.json({
      valid: true,
      letterNo: letter.letterNo,
      generatedAt: letter.generatedAt,
      handedOverAt: letter.handedOverAt,
      category: letter.verification?.match?.foundItem?.category?.categoryName || 'Item'
    });
  } catch (err) {
    next(err);
  }
});

export default router;
