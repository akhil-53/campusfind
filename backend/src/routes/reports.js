import { Router } from 'express';
import { body, param, query } from 'express-validator';
import prisma from '../config/prisma.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { validate } from '../middleware/validate.js';
import { asUser } from '../services/dbActor.js';
import { assertOwnReport, assertFacultyOnCase, reportForStudentSelect, reportForFacultySelect } from '../services/access.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

// POST /api/reports (Student file lost report)
router.post(
  '/',
  auth,
  authorize('STUDENT'),
  requireProfile,
  validate([
    body('categoryId').isInt({ min: 1 }).withMessage('Valid category ID required'),
    body('locationId').isInt({ min: 1 }).withMessage('Valid location ID required'),
    body('description').isString().trim().isLength({ min: 10, max: 300 }).withMessage('Description must be 10-300 characters'),
    body('color').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
    body('brand').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
    body('identifyingMarks').isString().trim().isLength({ min: 5, max: 1000 }).withMessage('Identifying marks must be 5-1000 characters'),
    body('lostFrom').isISO8601().withMessage('Valid lostFrom ISO date required'),
    body('lostTo').isISO8601().withMessage('Valid lostTo ISO date required')
  ]),
  async (req, res, next) => {
    try {
      const { categoryId, locationId, description, color, brand, identifyingMarks, lostFrom, lostTo } = req.body;
      const fromDate = new Date(lostFrom);
      const toDate = new Date(lostTo);
      const now = new Date();

      if (toDate < fromDate) {
        throw new HttpError(422, 'Lost To date cannot be earlier than Lost From date', 'INVALID_TIME_WINDOW');
      }

      const diffHours = (toDate - fromDate) / (1000 * 60 * 60);
      if (diffHours > 24) {
        throw new HttpError(422, 'Lost time window cannot exceed 24 hours', 'WINDOW_TOO_LARGE');
      }

      if (toDate > new Date(now.getTime() + 5 * 60 * 1000)) {
        throw new HttpError(422, 'Lost To date cannot be in the future', 'FUTURE_DATE_NOT_ALLOWED');
      }

      const report = await asUser(req.user.id, async (tx) => {
        return tx.lostReport.create({
          data: {
            studentId: req.user.id,
            categoryId: parseInt(categoryId, 10),
            locationId: parseInt(locationId, 10),
            description,
            color: color || null,
            brand: brand || null,
            identifyingMarks,
            lostFrom: fromDate,
            lostTo: toDate,
            status: 'OPEN'
          },
          select: reportForStudentSelect
        });
      });

      return res.status(201).json({ report });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/reports/mine (Student lost reports)
router.get(
  '/mine',
  auth,
  authorize('STUDENT'),
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('status').optional().isString()
  ]),
  async (req, res, next) => {
    try {
      const { page, pageSize, skip, take } = getPaginationParams(req);
      const { status } = req.query;

      const where = {
        studentId: req.user.id,
        ...(status ? { status } : {})
      };

      const [total, reports] = await Promise.all([
        prisma.lostReport.count({ where }),
        prisma.lostReport.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: reportForStudentSelect
        })
      ]);

      return res.json(formatPaginatedResponse(reports, total, page, pageSize));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/reports/:id (Student report detail with timeline, verification & letter)
router.get(
  '/:id',
  auth,
  validate([param('id').isInt({ min: 1 }).withMessage('Valid report ID required')]),
  async (req, res, next) => {
    try {
      const reportId = parseInt(req.params.id, 10);

      // Student assertion (or faculty/admin)
      if (req.user.role === 'STUDENT') {
        await assertOwnReport(req.user, reportId);
      } else if (req.user.role === 'FACULTY') {
        await assertFacultyOnCase(req.user, reportId);
      }

      const report = await prisma.lostReport.findUnique({
        where: { reportId },
        select: {
          ...reportForStudentSelect,
          identifyingMarks: req.user.role !== 'STAFF',
          student: {
            select: { fullName: true, regNo: true, email: true }
          }
        }
      });

      if (!report) {
        throw new HttpError(404, 'Lost report not found', 'REPORT_NOT_FOUND');
      }

      // Fetch scheduled verification if any
      const upcomingVerification = await prisma.verification.findFirst({
        where: {
          match: { reportId },
          outcome: 'SCHEDULED'
        },
        select: {
          verificationId: true,
          scheduledAt: true,
          venue: true,
          outcome: true
        }
      });

      // Fetch handover letter if returned
      const handover = await prisma.handoverLetter.findFirst({
        where: {
          verification: {
            match: { reportId }
          }
        },
        select: {
          letterNo: true,
          verifyCode: true,
          generatedAt: true,
          verificationId: true
        }
      });

      // Timeline from audit logs (status changes only)
      const auditRows = await prisma.auditLog.findMany({
        where: {
          entityName: 'lost_reports',
          entityId: reportId
        },
        orderBy: { createdAt: 'asc' },
        select: {
          logId: true,
          action: true,
          createdAt: true,
          details: true
        }
      });

      return res.json({
        report,
        upcomingVerification,
        handoverLetter: handover,
        timeline: auditRows
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/reports/:id/withdraw (Student withdraws report)
router.post(
  '/:id/withdraw',
  auth,
  authorize('STUDENT'),
  validate([param('id').isInt({ min: 1 }).withMessage('Valid report ID required')]),
  async (req, res, next) => {
    try {
      const reportId = parseInt(req.params.id, 10);
      const report = await assertOwnReport(req.user, reportId);

      if (!['OPEN', 'ASSIGNED'].includes(report.status)) {
        throw new HttpError(409, `Cannot withdraw report in status ${report.status}`, 'CANNOT_WITHDRAW');
      }

      await asUser(req.user.id, async (tx) => {
        await tx.$executeRaw`CALL sp_close_report(${reportId}::int, 'WITHDRAWN_BY_STUDENT')`;
      });

      return res.json({ message: 'Lost report successfully withdrawn.' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/reports/:id/not-found (Faculty declares not found)
router.post(
  '/:id/not-found',
  auth,
  authorize('FACULTY', 'ADMIN'),
  validate([param('id').isInt({ min: 1 }).withMessage('Valid report ID required')]),
  async (req, res, next) => {
    try {
      const reportId = parseInt(req.params.id, 10);
      await assertFacultyOnCase(req.user, reportId, true);

      await asUser(req.user.id, async (tx) => {
        await tx.$executeRaw`CALL sp_declare_not_found(${reportId}::int)`;
      });

      return res.json({ message: 'Report declared not found. Student can visit SJT room.' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
