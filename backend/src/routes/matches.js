import { Router } from 'express';
import { body, param } from 'express-validator';
import prisma from '../config/prisma.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asUser } from '../services/dbActor.js';
import { assertFacultyOnCase } from '../services/access.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

// PATCH /api/matches/:id (Shortlist or dismiss match)
router.patch(
  '/:id',
  auth,
  authorize('FACULTY', 'ADMIN'),
  validate([
    param('id').isInt({ min: 1 }),
    body('status').isIn(['SHORTLISTED', 'DISMISSED']).withMessage('Status must be SHORTLISTED or DISMISSED')
  ]),
  async (req, res, next) => {
    try {
      const matchId = parseInt(req.params.id, 10);
      const { status } = req.body;

      const match = await prisma.match.findUnique({
        where: { matchId }
      });

      if (!match) {
        throw new HttpError(404, 'Match not found', 'MATCH_NOT_FOUND');
      }

      if (['CONFIRMED', 'FAILED'].includes(match.status)) {
        throw new HttpError(409, `Cannot alter match in status ${match.status}`, 'CANNOT_ALTER_TERMINAL_MATCH');
      }

      await assertFacultyOnCase(req.user, match.reportId, true);

      const updated = await asUser(req.user.id, async (tx) => {
        return tx.match.update({
          where: { matchId },
          data: { status }
        });
      });

      return res.json({ match: updated });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/matches (Manual match creation by faculty)
router.post(
  '/',
  auth,
  authorize('FACULTY', 'ADMIN'),
  validate([
    body('reportId').isInt({ min: 1 }),
    body('foundId').isInt({ min: 1 })
  ]),
  async (req, res, next) => {
    try {
      const { reportId, foundId } = req.body;
      await assertFacultyOnCase(req.user, reportId, true);

      const [report, item] = await Promise.all([
        prisma.lostReport.findUnique({ where: { reportId: parseInt(reportId, 10) } }),
        prisma.foundItem.findUnique({ where: { foundId: parseInt(foundId, 10) } })
      ]);

      if (!report) throw new HttpError(404, 'Report not found', 'REPORT_NOT_FOUND');
      if (!item) throw new HttpError(404, 'Found item not found', 'ITEM_NOT_FOUND');
      if (item.status !== 'AVAILABLE') throw new HttpError(409, 'Found item is not available', 'ITEM_NOT_AVAILABLE');

      // Compute score or assign manual 80
      let score = 80;
      try {
        const scoreResult = await prisma.$queryRaw`
          SELECT fn_match_score(
            ${report.locationId}::int, ${report.lostFrom}::timestamptz, ${report.lostTo}::timestamptz,
            ${report.description}::text, ${report.color}::text,
            ${item.locationId}::int, ${item.foundAt}::timestamptz,
            ${item.description}::text, ${item.color}::text
          ) as score;
        `;
        if (scoreResult && scoreResult[0]) {
          score = Math.max(scoreResult[0].score, 50);
        }
      } catch (scoreErr) {
        // Fallback default
        score = 80;
      }

      const match = await asUser(req.user.id, async (tx) => {
        return tx.match.upsert({
          where: {
            reportId_foundId: {
              reportId: report.reportId,
              foundId: item.foundId
            }
          },
          update: {
            status: 'SHORTLISTED',
            source: 'MANUAL',
            score
          },
          create: {
            reportId: report.reportId,
            foundId: item.foundId,
            score,
            source: 'MANUAL',
            status: 'SHORTLISTED'
          }
        });
      });

      return res.status(201).json({ match });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
