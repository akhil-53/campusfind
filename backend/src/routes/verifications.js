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

// POST /api/verifications (Schedule a physical verification visit)
router.post(
  '/',
  auth,
  authorize('FACULTY', 'ADMIN'),
  validate([
    body('matchId').isInt({ min: 1 }).withMessage('Valid match ID is required'),
    body('scheduledAt').isISO8601().withMessage('Valid scheduledAt ISO date required'),
    body('venue').isString().trim().notEmpty().withMessage('Verification venue is required')
  ]),
  async (req, res, next) => {
    try {
      const { matchId, scheduledAt, venue } = req.body;
      const scheduledDate = new Date(scheduledAt);

      if (scheduledDate < new Date(Date.now() - 5 * 60 * 1000)) {
        throw new HttpError(422, 'Verification time cannot be in the past', 'PAST_TIME_NOT_ALLOWED');
      }

      const match = await prisma.match.findUnique({
        where: { matchId: parseInt(matchId, 10) },
        include: { report: true }
      });

      if (!match) {
        throw new HttpError(404, 'Match not found', 'MATCH_NOT_FOUND');
      }

      await assertFacultyOnCase(req.user, match.reportId, true);

      // Check if there is already a scheduled verification
      const existingScheduled = await prisma.verification.findFirst({
        where: {
          matchId: match.matchId,
          outcome: 'SCHEDULED'
        }
      });

      if (existingScheduled) {
        throw new HttpError(409, 'A verification visit is already scheduled for this match', 'ALREADY_SCHEDULED');
      }

      const verification = await asUser(req.user.id, async (tx) => {
        // marksClaimed will be populated by trigger fn_verification_before from report.identifying_marks
        return tx.verification.create({
          data: {
            matchId: match.matchId,
            scheduledBy: req.user.id,
            scheduledAt: scheduledDate,
            venue: venue.trim(),
            marksClaimed: match.report.identifyingMarks || '',
            outcome: 'SCHEDULED'
          }
        });
      });

      return res.status(201).json({ verification });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/verifications/:id/complete (Record verification outcome)
router.post(
  '/:id/complete',
  auth,
  authorize('FACULTY', 'ADMIN'),
  validate([
    param('id').isInt({ min: 1 }),
    body('outcome').isIn(['VERIFIED', 'FAILED', 'NO_SHOW']).withMessage('Outcome must be VERIFIED, FAILED, or NO_SHOW'),
    body('marksObserved').isString().trim().notEmpty().withMessage('Observed marks are required'),
    body('remarks').optional({ nullable: true }).isString().trim()
  ]),
  async (req, res, next) => {
    try {
      const verificationId = parseInt(req.params.id, 10);
      const { outcome, marksObserved, remarks } = req.body;

      const verification = await prisma.verification.findUnique({
        where: { verificationId },
        include: { match: true }
      });

      if (!verification) {
        throw new HttpError(404, 'Verification record not found', 'VERIFICATION_NOT_FOUND');
      }

      if (verification.outcome !== 'SCHEDULED') {
        throw new HttpError(409, `Verification is already in outcome: ${verification.outcome}`, 'VERIFICATION_NOT_PENDING');
      }

      await assertFacultyOnCase(req.user, verification.match.reportId, true);

      let letter = null;

      if (outcome === 'VERIFIED') {
        await asUser(req.user.id, async (tx) => {
          await tx.$executeRaw`CALL sp_complete_handover(${verificationId}::int, ${marksObserved}::text)`;
        });

        letter = await prisma.handoverLetter.findUnique({
          where: { verificationId }
        });
      } else {
        await asUser(req.user.id, async (tx) => {
          await tx.$executeRaw`CALL sp_record_verification_result(${verificationId}::int, ${outcome}::text, ${marksObserved}::text, ${remarks || null}::text)`;
        });
      }

      return res.json({
        message: `Verification outcome recorded as ${outcome}.`,
        outcome,
        letter
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
