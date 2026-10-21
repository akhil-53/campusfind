import { Router } from 'express';
import { query } from 'express-validator';
import prisma from '../config/prisma.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { reportForStaffSelect } from '../services/access.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

const router = Router();

// GET /api/staff/not-found-cases (Staff view of NOT_FOUND cases eligible for room search)
router.get(
  '/not-found-cases',
  auth,
  authorize('STAFF', 'ADMIN'),
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('search').optional().isString()
  ]),
  async (req, res, next) => {
    try {
      const { page, pageSize, skip, take } = getPaginationParams(req);
      const { search } = req.query;

      const where = {
        status: 'NOT_FOUND'
      };

      if (search && search.trim()) {
        const queryTerm = search.trim();
        where.OR = [
          { student: { regNo: { contains: queryTerm, mode: 'insensitive' } } },
          { student: { fullName: { contains: queryTerm, mode: 'insensitive' } } },
          { description: { contains: queryTerm, mode: 'insensitive' } }
        ];
      }

      const [total, reports, setting] = await Promise.all([
        prisma.lostReport.count({ where }),
        prisma.lostReport.findMany({
          where,
          skip,
          take,
          orderBy: { notFoundAt: 'desc' },
          select: reportForStaffSelect
        }),
        prisma.systemSetting.findUnique({ where: { settingKey: 'visit_window_days' } })
      ]);

      const windowDays = parseInt(setting?.settingValue || '7', 10);

      const formatted = reports.map(r => {
        const deadline = r.notFoundAt
          ? new Date(new Date(r.notFoundAt).getTime() + windowDays * 24 * 60 * 60 * 1000)
          : null;
        return {
          reportId: r.reportId,
          description: r.description,
          color: r.color,
          brand: r.brand,
          lostFrom: r.lostFrom,
          lostTo: r.lostTo,
          status: r.status,
          notFoundAt: r.notFoundAt,
          visitDeadline: deadline,
          categoryName: r.category.categoryName,
          roomName: r.location.roomName,
          studentName: r.student.fullName,
          regNo: r.student.regNo
        };
      });

      return res.json(formatPaginatedResponse(formatted, total, page, pageSize));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
