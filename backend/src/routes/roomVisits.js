import { Router } from 'express';
import { body, query } from 'express-validator';
import prisma from '../config/prisma.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asUser } from '../services/dbActor.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

// POST /api/room-visits (Record student physical visit to lost-and-found room)
router.post(
  '/',
  auth,
  authorize('STAFF', 'ADMIN'),
  validate([
    body('reportId').isInt({ min: 1 }).withMessage('Valid report ID is required'),
    body('manualSearchResult')
      .isIn(['FOUND_ITEM', 'NOT_FOUND'])
      .withMessage('manualSearchResult must be FOUND_ITEM or NOT_FOUND'),
    body('foundId').optional({ nullable: true }).isInt({ min: 1 }),
    body('cctvChecked').isBoolean().withMessage('cctvChecked must be a boolean'),
    body('cctvOutcome')
      .optional({ nullable: true })
      .isIn(['LOCATED', 'NOT_VISIBLE', 'THEFT_SUSPECTED'])
      .withMessage('Invalid CCTV outcome'),
    body('notes').optional({ nullable: true }).isString().trim()
  ]),
  async (req, res, next) => {
    try {
      const { reportId, manualSearchResult, foundId, cctvChecked, cctvOutcome, notes } = req.body;

      const report = await prisma.lostReport.findUnique({
        where: { reportId: parseInt(reportId, 10) }
      });

      if (!report) {
        throw new HttpError(404, 'Lost report not found', 'REPORT_NOT_FOUND');
      }

      if (report.status !== 'NOT_FOUND') {
        throw new HttpError(
          409,
          `Room visits can only be recorded for NOT_FOUND reports. Report status is ${report.status}`,
          'INVALID_REPORT_STATUS'
        );
      }

      if (manualSearchResult === 'FOUND_ITEM' && !foundId) {
        throw new HttpError(422, 'foundId is required when an item was found during manual search', 'FOUND_ID_REQUIRED');
      }

      if (cctvChecked && !cctvOutcome) {
        throw new HttpError(422, 'cctvOutcome is required when CCTV was checked', 'CCTV_OUTCOME_REQUIRED');
      }

      // Check theft handler setting if THEFT_SUSPECTED
      if (cctvOutcome === 'THEFT_SUSPECTED') {
        const theftSetting = await prisma.systemSetting.findUnique({
          where: { settingKey: 'theft_handler_user_id' }
        });
        if (!theftSetting || !theftSetting.settingValue) {
          throw new HttpError(409, 'No theft handler configured. Admin must set theft_handler_user_id.', 'THEFT_HANDLER_NOT_CONFIGURED');
        }
      }

      const visit = await asUser(req.user.id, async (tx) => {
        return tx.roomVisit.create({
          data: {
            reportId: parseInt(reportId, 10),
            handledBy: req.user.id,
            manualSearchResult,
            foundId: foundId ? parseInt(foundId, 10) : null,
            cctvChecked: Boolean(cctvChecked),
            cctvOutcome: cctvChecked ? cctvOutcome : null,
            notes: notes || null
          }
        });
      });

      return res.status(201).json({
        message: 'Room visit recorded successfully.',
        visit
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/room-visits?reportId= (Visit history)
router.get(
  '/',
  auth,
  authorize('STAFF', 'FACULTY', 'ADMIN'),
  validate([query('reportId').optional().isInt({ min: 1 })]),
  async (req, res, next) => {
    try {
      const { reportId } = req.query;
      const where = reportId ? { reportId: parseInt(reportId, 10) } : {};

      const visits = await prisma.roomVisit.findMany({
        where,
        orderBy: { visitedAt: 'desc' },
        include: {
          handler: { select: { fullName: true } },
          foundItem: { select: { shelfCode: true, description: true } }
        }
      });

      return res.json({ data: visits });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
