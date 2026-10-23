import { Router } from 'express';
import { body, param, query } from 'express-validator';
import prisma from '../config/prisma.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asUser } from '../services/dbActor.js';
import { assertFacultyOnCase, assertTheftHandler, reportForFacultySelect } from '../services/access.js';
import { getSignedImageUrl } from '../services/storage.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

// GET /api/faculty/queue (Faculty assigned cases)
router.get(
  '/queue',
  auth,
  authorize('FACULTY', 'ADMIN'),
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1 }),
    query('overdue').optional().isBoolean(),
    query('type').optional().isString()
  ]),
  async (req, res, next) => {
    try {
      const { page, pageSize, skip, take } = getPaginationParams(req);
      const { overdue, type } = req.query;

      const where = {
        assignedTo: req.user.id,
        status: 'ACTIVE'
      };

      if (type) where.assignmentType = type;
      if (overdue === 'true' || overdue === true) {
        where.dueAt = { lt: new Date() };
      }

      const [total, assignments] = await Promise.all([
        prisma.assignment.count({ where }),
        prisma.assignment.findMany({
          where,
          skip,
          take,
          orderBy: { dueAt: 'asc' },
          include: {
            report: {
              select: {
                reportId: true,
                status: true,
                description: true,
                color: true,
                brand: true,
                lostFrom: true,
                lostTo: true,
                identifyingMarks: true,
                locationText: true,
                categoryCustom: true,
                category: { select: { categoryName: true } },
                location: { select: { roomName: true, block: true } },
                student: { select: { fullName: true, regNo: true } },
                _count: {
                  select: {
                    matches: {
                      where: { status: { in: ['SUGGESTED', 'SHORTLISTED'] } }
                    }
                  }
                }
              }
            }
          }
        })
      ]);

      const formatted = assignments.map(a => ({
        assignmentId: a.assignmentId,
        assignedTo: a.assignedTo,
        assignmentType: a.assignmentType,
        level: a.level,
        assignedAt: a.assignedAt,
        dueAt: a.dueAt,
        isOverdue: new Date(a.dueAt) < new Date(),
        reportId: a.report.reportId,
        reportStatus: a.report.status,
        description: a.report.description,
        color: a.report.color,
        brand: a.report.brand,
        identifyingMarks: a.report.identifyingMarks,
        locationText: a.report.locationText || null,
        categoryCustom: a.report.categoryCustom || null,
        lostFrom: a.report.lostFrom,
        lostTo: a.report.lostTo,
        categoryName: a.report.category.categoryName,
        roomName: a.report.location
          ? `${a.report.location.block} - ${a.report.location.roomName}`
          : (a.report.locationText || 'Not specified'),
        studentName: a.report.student.fullName,
        regNo: a.report.student.regNo,
        openMatches: a.report._count.matches
      }));

      return res.json(formatPaginatedResponse(formatted, total, page, pageSize));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/faculty/cases/:reportId (Complete case dossier for faculty)
router.get(
  '/cases/:reportId',
  auth,
  authorize('FACULTY', 'ADMIN'),
  validate([param('reportId').isInt({ min: 1 })]),
  async (req, res, next) => {
    try {
      const reportId = parseInt(req.params.reportId, 10);
      await assertFacultyOnCase(req.user, reportId);

      const [report, matches, verifications, escalations, visits] = await Promise.all([
        prisma.lostReport.findUnique({
          where: { reportId },
          select: reportForFacultySelect
        }),
        prisma.match.findMany({
          where: { reportId },
          orderBy: { score: 'desc' },
          include: {
            foundItem: {
              include: {
                location: true,
                images: true
              }
            }
          }
        }),
        prisma.verification.findMany({
          where: { match: { reportId } },
          orderBy: { scheduledAt: 'desc' },
          include: {
            verifier: { select: { fullName: true } },
            handoverLetter: true
          }
        }),
        prisma.assignment.findMany({
          where: { reportId },
          orderBy: { assignedAt: 'asc' },
          include: {
            assignee: {
              select: {
                fullName: true,
                designation: { select: { title: true } }
              }
            }
          }
        }),
        prisma.roomVisit.findMany({
          where: { reportId },
          orderBy: { visitedAt: 'desc' },
          include: {
            handler: { select: { fullName: true } },
            foundItem: { select: { shelfCode: true, description: true } }
          }
        })
      ]);

      if (!report) {
        throw new HttpError(404, 'Case report not found', 'REPORT_NOT_FOUND');
      }

      // Prepare signed photo URLs for all matches
      const enrichedMatches = await Promise.all(
        matches.map(async (m) => {
          const signedImages = await Promise.all(
            m.foundItem.images.map(async (img) => ({
              ...img,
              url: await getSignedImageUrl(img.storagePath, 3600)
            }))
          );
          return {
            matchId: m.matchId,
            score: m.score,
            source: m.source,
            status: m.status,
            createdAt: m.createdAt,
            foundItem: {
              foundId: m.foundItem.foundId,
              description: m.foundItem.description,
              color: m.foundItem.color,
              brand: m.foundItem.brand,
              shelfCode: m.foundItem.shelfCode,
              foundAt: m.foundItem.foundAt,
              status: m.foundItem.status,
              roomName: m.foundItem.location.roomName,
              images: signedImages
            }
          };
        })
      );

      return res.json({
        report,
        matches: enrichedMatches,
        verifications,
        escalationHistory: escalations.map(e => ({
          assignmentId: e.assignmentId,
          level: e.level,
          type: e.assignmentType,
          status: e.status,
          assigneeName: e.assignee.fullName,
          designation: e.assignee.designation?.title || 'Faculty',
          assignedAt: e.assignedAt,
          dueAt: e.dueAt,
          closedAt: e.closedAt
        })),
        roomVisits: visits
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/faculty/me/availability (Toggle availability)
router.patch(
  '/me/availability',
  auth,
  authorize('FACULTY', 'ADMIN'),
  validate([body('isAvailable').isBoolean().withMessage('isAvailable must be boolean')]),
  async (req, res, next) => {
    try {
      const updated = await prisma.user.update({
        where: { userId: req.user.id },
        data: { isAvailable: req.body.isAvailable }
      });

      return res.json({
        isAvailable: updated.isAvailable,
        message: `Auto-assignment availability set to ${updated.isAvailable ? 'available' : 'unavailable'}.`
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/theft-cases (Theft tracking queue)
router.get('/theft-cases', auth, authorize('FACULTY', 'ADMIN'), async (req, res, next) => {
  try {
    await assertTheftHandler(req.user);

    const cases = await prisma.assignment.findMany({
      where: {
        assignedTo: req.user.id,
        assignmentType: 'THEFT_TRACKING',
        status: 'ACTIVE'
      },
      orderBy: { dueAt: 'asc' },
      include: {
        report: {
          include: {
            student: { select: { fullName: true, regNo: true, email: true } },
            location: true,
            roomVisits: {
              where: { cctvOutcome: 'THEFT_SUSPECTED' },
              orderBy: { visitedAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    const formatted = cases.map(c => ({
      assignmentId: c.assignmentId,
      dueAt: c.dueAt,
      reportId: c.report.reportId,
      studentName: c.report.student.fullName,
      regNo: c.report.student.regNo,
      description: c.report.description,
      roomName: c.report.location
        ? c.report.location.roomName
        : (c.report.locationText || 'Not specified'),
      lostFrom: c.report.lostFrom,
      lostTo: c.report.lostTo,
      cctvNotes: c.report.roomVisits[0]?.notes || 'Theft suspected on room visit',
      visitedAt: c.report.roomVisits[0]?.visitedAt || c.assignedAt
    }));

    return res.json({ data: formatted });
  } catch (err) {
    next(err);
  }
});

// POST /api/theft-cases/:reportId/acknowledge
router.post(
  '/theft-cases/:reportId/acknowledge',
  auth,
  authorize('FACULTY', 'ADMIN'),
  validate([
    param('reportId').isInt({ min: 1 }),
    body('notes').isString().trim().notEmpty().withMessage('Action notes are required')
  ]),
  async (req, res, next) => {
    try {
      const reportId = parseInt(req.params.reportId, 10);
      await assertTheftHandler(req.user);

      const assignment = await prisma.assignment.findFirst({
        where: {
          reportId,
          assignedTo: req.user.id,
          assignmentType: 'THEFT_TRACKING',
          status: 'ACTIVE'
        }
      });

      if (!assignment) {
        throw new HttpError(404, 'Active theft tracking assignment not found', 'ASSIGNMENT_NOT_FOUND');
      }

      await asUser(req.user.id, async (tx) => {
        await tx.assignment.update({
          where: { assignmentId: assignment.assignmentId },
          data: {
            status: 'COMPLETED',
            closedAt: new Date()
          }
        });

        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'THEFT_CASE_ACKNOWLEDGED',
            entityName: 'lost_reports',
            entityId: reportId,
            details: { notes: req.body.notes }
          }
        });
      });

      return res.json({ message: 'Theft case acknowledged and tracking resolved.' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
