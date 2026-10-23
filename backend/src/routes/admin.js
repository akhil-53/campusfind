import { Router } from 'express';
import { body, param, query } from 'express-validator';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma.js';
import { env } from '../config/env.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asUser } from '../services/dbActor.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

// Ensure only ADMIN can access
router.use(auth, authorize('ADMIN'));

// GET /api/admin/stats (Dashboard statistics and analytical aggregates)
router.get('/stats', async (req, res, next) => {
  try {
    const [
      activeReports,
      notFoundReports,
      returnedReports,
      theftForwardedReports,
      overdueAssignments,
      itemsInRoom,
      flaggedItems
    ] = await Promise.all([
      prisma.lostReport.count({ where: { status: { in: ['OPEN', 'ASSIGNED', 'VISIT_SCHEDULED'] } } }),
      prisma.lostReport.count({ where: { status: 'NOT_FOUND' } }),
      prisma.lostReport.count({ where: { status: 'RETURNED' } }),
      prisma.lostReport.count({ where: { status: 'THEFT_FORWARDED' } }),
      prisma.assignment.count({ where: { status: 'ACTIVE', dueAt: { lt: new Date() } } }),
      prisma.foundItem.count({ where: { status: 'AVAILABLE' } }),
      prisma.foundItem.count({ where: { status: 'AVAILABLE', unclaimedFlaggedAt: { not: null } } })
    ]);

    // Categories breakdown with recovery percentage
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { lostReports: true }
        },
        lostReports: {
          where: { status: 'RETURNED' },
          select: { reportId: true }
        }
      }
    });

    const categoryStats = categories.map(c => {
      const total = c._count.lostReports;
      const returned = c.lostReports.length;
      return {
        categoryName: c.categoryName,
        total,
        returned,
        recoveryPct: total > 0 ? Math.round((returned / total) * 100) : 0
      };
    });

    // Hotspot locations
    const locations = await prisma.location.findMany({
      include: {
        _count: {
          select: { lostReports: true }
        }
      },
      orderBy: {
        lostReports: { _count: 'desc' }
      },
      take: 6
    });

    const roomHotspots = locations.map(l => ({
      roomName: `${l.block} - ${l.roomName}`,
      reports: l._count.lostReports
    }));

    // Escalations per faculty member
    const escalatedAssignments = await prisma.assignment.findMany({
      where: { status: 'ESCALATED' },
      include: {
        assignee: { select: { fullName: true } }
      }
    });

    const escalationCounts = {};
    escalatedAssignments.forEach(a => {
      const name = a.assignee.fullName;
      escalationCounts[name] = (escalationCounts[name] || 0) + 1;
    });

    const escalationsPerFaculty = Object.entries(escalationCounts).map(([fullName, count]) => ({
      fullName,
      escalated: count
    }));

    // Reports per day (last 14 days)
    const recentReports = await prisma.lostReport.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        }
      },
      select: { createdAt: true }
    });

    const reportsByDayMap = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      reportsByDayMap[key] = 0;
    }

    recentReports.forEach(r => {
      const key = r.createdAt.toISOString().split('T')[0];
      if (reportsByDayMap[key] !== undefined) {
        reportsByDayMap[key]++;
      }
    });

    const reportsPerDay = Object.entries(reportsByDayMap).map(([day, count]) => ({
      day,
      count
    }));

    return res.json({
      overview: {
        activeReports,
        notFoundReports,
        returnedReports,
        theftForwardedReports,
        overdueAssignments,
        itemsInRoom,
        flaggedItems
      },
      categoryStats,
      roomHotspots,
      escalationsPerFaculty,
      reportsPerDay
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users
router.get(
  '/users',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('role').optional().isString(),
    query('search').optional().isString()
  ]),
  async (req, res, next) => {
    try {
      const { page, pageSize, skip, take } = getPaginationParams(req, 15);
      const { role, search } = req.query;

      const where = {};
      if (role) {
        where.role = { roleName: role };
      }

      if (search && search.trim()) {
        const queryTerm = search.trim();
        where.OR = [
          { fullName: { contains: queryTerm, mode: 'insensitive' } },
          { email: { contains: queryTerm, mode: 'insensitive' } },
          { regNo: { contains: queryTerm, mode: 'insensitive' } }
        ];
      }

      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            role: true,
            designation: true,
            reportsTo: { select: { fullName: true } },
            assignments: {
              where: { status: 'ACTIVE' },
              select: { assignmentId: true }
            }
          }
        })
      ]);

      const formatted = users.map(u => ({
        id: u.userId,
        fullName: u.fullName,
        email: u.email,
        regNo: u.regNo,
        role: u.role.roleName,
        designation: u.designation?.title || null,
        designationLevel: u.designation?.levelRank || null,
        reportsToId: u.reportsToId,
        reportsToName: u.reportsTo?.fullName || null,
        isActive: u.isActive,
        isAvailable: u.isAvailable,
        activeAssignmentsCount: u.assignments.length,
        lastLoginAt: u.lastLoginAt
      }));

      return res.json(formatPaginatedResponse(formatted, total, page, pageSize));
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/admin/users (Pre-provision institutional user)
router.post(
  '/users',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid institutional email required'),
    body('fullName').isString().trim().notEmpty().withMessage('Full name is required'),
    body('role').isIn(['FACULTY', 'STAFF', 'ADMIN']).withMessage('Role must be FACULTY, STAFF, or ADMIN'),
    body('designationId').optional({ nullable: true }).isInt({ min: 1 }),
    body('reportsToId').optional({ nullable: true }).isInt({ min: 1 }),
    body('password').optional().isString()
  ]),
  async (req, res, next) => {
    try {
      const { email, fullName, role, designationId, reportsToId, password } = req.body;

      if (!email.endsWith(`@${env.STAFF_DOMAIN}`) && !email.endsWith(`@${env.STUDENT_DOMAIN}`)) {
        throw new HttpError(422, `Email must end with institutional domain @${env.STAFF_DOMAIN} or @${env.STUDENT_DOMAIN}`, 'INVALID_DOMAIN');
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new HttpError(409, 'User with this email already exists', 'EMAIL_EXISTS');
      }

      const roleRecord = await prisma.role.findUnique({ where: { roleName: role } });
      if (!roleRecord) {
        throw new HttpError(404, 'Role record not found in system', 'ROLE_NOT_FOUND');
      }

      let parsedDesignationId = designationId ? parseInt(designationId, 10) : null;
      let parsedReportsToId = reportsToId ? parseInt(reportsToId, 10) : null;

      if (role === 'FACULTY') {
        if (!parsedDesignationId) {
          // Default to Level 1 Faculty
          const defaultDes = await prisma.designation.findFirst({ where: { levelRank: 1 } });
          parsedDesignationId = defaultDes?.designationId || null;
        }

        const des = await prisma.designation.findUnique({ where: { designationId: parsedDesignationId } });
        if (!des || ![1, 2, 3].includes(des.levelRank)) {
          throw new HttpError(422, 'Faculty must have one of the 3 supported levels: Level 1 (Faculty), Level 2 (HOD), or Level 3 (Dean)', 'INVALID_DESIGNATION_LEVEL');
        }

        // If level 1 faculty and reportsTo not given, default report to HOD (admin)
        if (des.levelRank === 1 && !parsedReportsToId) {
          const hodUser = await prisma.user.findFirst({
            where: { designation: { title: 'HOD' }, isActive: true }
          });
          if (hodUser) parsedReportsToId = hodUser.userId;
        }
      }

      const plainPassword = password || (role === 'FACULTY' ? 'faculty123' : 'staff123');
      const passwordHash = await bcrypt.hash(plainPassword, 10);

      const user = await asUser(req.user.id, async (tx) => {
        return tx.user.create({
          data: {
            email,
            fullName,
            roleId: roleRecord.roleId,
            designationId: parsedDesignationId,
            reportsToId: parsedReportsToId,
            passwordHash,
            isActive: true,
            isAvailable: true
          },
          include: { role: true, designation: true }
        });
      });

      return res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/admin/users/:id (Update user role, hierarchy, availability, active state)
router.patch(
  '/users/:id',
  validate([
    param('id').isInt({ min: 1 }),
    body('role').optional().isIn(['STUDENT', 'FACULTY', 'STAFF', 'ADMIN']),
    body('designationId').optional({ nullable: true }).isInt({ min: 1 }),
    body('reportsToId').optional({ nullable: true }),
    body('isActive').optional().isBoolean(),
    body('isAvailable').optional().isBoolean()
  ]),
  async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const { role, designationId, reportsToId, isActive, isAvailable } = req.body;

      const user = await prisma.user.findUnique({
        where: { userId },
        include: {
          assignments: { where: { status: 'ACTIVE' } }
        }
      });

      if (!user) {
        throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
      }

      // Block deactivation if user has active assignments
      if (isActive === false && user.assignments.length > 0) {
        throw new HttpError(
          409,
          `Cannot deactivate user with ${user.assignments.length} ACTIVE assigned case(s). Reassign them first.`,
          'ACTIVE_ASSIGNMENTS_EXIST'
        );
      }

      const updateData = {};
      if (role) {
        const roleRecord = await prisma.role.findUnique({ where: { roleName: role } });
        updateData.roleId = roleRecord.roleId;
      }
      if (designationId !== undefined) {
        updateData.designationId = designationId ? parseInt(designationId, 10) : null;
      }
      if (reportsToId !== undefined) {
        updateData.reportsToId = reportsToId ? parseInt(reportsToId, 10) : null;
      }
      if (isActive !== undefined) updateData.isActive = isActive;
      if (isAvailable !== undefined) updateData.isAvailable = isAvailable;

      const updated = await asUser(req.user.id, async (tx) => {
        return tx.user.update({
          where: { userId },
          data: updateData,
          include: { role: true, designation: true, reportsTo: true }
        });
      });

      return res.json({ user: updated });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/admin/hierarchy (Hierarchy tree)
router.get('/hierarchy', async (req, res, next) => {
  try {
    const facultyUsers = await prisma.user.findMany({
      where: {
        role: { roleName: 'FACULTY' },
        isActive: true
      },
      include: {
        designation: true,
        assignments: {
          where: { status: 'ACTIVE' },
          select: { assignmentId: true }
        }
      }
    });

    const userMap = {};
    facultyUsers.forEach(u => {
      userMap[u.userId] = {
        id: u.userId,
        name: u.fullName,
        email: u.email,
        title: u.designation?.title || 'Faculty',
        levelRank: u.designation?.levelRank || 1,
        activeCases: u.assignments.length,
        reportsToId: u.reportsToId,
        children: []
      };
    });

    const roots = [];
    Object.values(userMap).forEach(u => {
      if (u.reportsToId && userMap[u.reportsToId]) {
        userMap[u.reportsToId].children.push(u);
      } else {
        roots.push(u);
      }
    });

    return res.json({ tree: roots });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/overdue (Overdue cases)
router.get('/overdue', async (req, res, next) => {
  try {
    const overdue = await prisma.assignment.findMany({
      where: {
        status: 'ACTIVE',
        dueAt: { lt: new Date() }
      },
      include: {
        report: {
          include: {
            category: true,
            location: true,
            student: true
          }
        },
        assignee: {
          include: { designation: true }
        }
      },
      orderBy: { dueAt: 'asc' }
    });

    const formatted = overdue.map(a => ({
      assignmentId: a.assignmentId,
      reportId: a.report.reportId,
      assignmentType: a.assignmentType,
      level: a.level,
      dueAt: a.dueAt,
      assigneeName: a.assignee.fullName,
      assigneeId: a.assignee.userId,
      designation: a.assignee.designation?.title || 'Faculty',
      atTop: !a.assignee.reportsToId,
      categoryName: a.report.category.categoryName,
      roomName: a.report.location
        ? a.report.location.roomName
        : (a.report.locationText || 'Not specified'),
      studentName: a.report.student.fullName,
      description: a.report.description
    }));

    return res.json({ data: formatted });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/reports (All reports with marks)
router.get(
  '/reports',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('status').optional().isString(),
    query('search').optional().isString()
  ]),
  async (req, res, next) => {
    try {
      const { page, pageSize, skip, take } = getPaginationParams(req, 15);
      const { status, search } = req.query;

      const where = {};
      if (status) where.status = status;

      if (search && search.trim()) {
        const term = search.trim();
        where.OR = [
          { description: { contains: term, mode: 'insensitive' } },
          { identifyingMarks: { contains: term, mode: 'insensitive' } },
          { student: { regNo: { contains: term, mode: 'insensitive' } } },
          { student: { fullName: { contains: term, mode: 'insensitive' } } }
        ];
      }

      const [total, reports] = await Promise.all([
        prisma.lostReport.count({ where }),
        prisma.lostReport.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            category: true,
            location: true,
            student: { select: { fullName: true, regNo: true, email: true } },
            assignments: {
              where: { status: 'ACTIVE' },
              include: { assignee: { select: { fullName: true, userId: true } } }
            }
          }
        })
      ]);

      const formatted = reports.map(r => ({
        reportId: r.reportId,
        description: r.description,
        color: r.color,
        brand: r.brand,
        identifyingMarks: r.identifyingMarks,
        status: r.status,
        lostFrom: r.lostFrom,
        lostTo: r.lostTo,
        createdAt: r.createdAt,
        categoryName: r.category.categoryName,
        categoryCustom: r.categoryCustom || null,
        roomName: r.location
          ? `${r.location.block} - ${r.location.roomName}`
          : (r.locationText || 'Not specified'),
        studentName: r.student.fullName,
        regNo: r.student.regNo,
        currentAssignee: r.assignments[0]?.assignee?.fullName || 'None'
      }));

      return res.json(formatPaginatedResponse(formatted, total, page, pageSize));
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/admin/reports/:id/reassign
router.post(
  '/reports/:id/reassign',
  validate([
    param('id').isInt({ min: 1 }),
    body('toUserId').isInt({ min: 1 }).withMessage('toUserId is required')
  ]),
  async (req, res, next) => {
    try {
      const reportId = parseInt(req.params.id, 10);
      const toUserId = parseInt(req.body.toUserId, 10);

      const targetUser = await prisma.user.findUnique({
        where: { userId: toUserId },
        include: { role: true }
      });

      if (!targetUser || targetUser.role.roleName !== 'FACULTY' || !targetUser.isActive) {
        throw new HttpError(400, 'Target user must be an active faculty member', 'INVALID_TARGET_USER');
      }

      await asUser(req.user.id, async (tx) => {
        await tx.$executeRaw`CALL sp_reassign(${reportId}::int, ${toUserId}::int)`;
      });

      return res.json({ message: `Report #${reportId} reassigned to ${targetUser.fullName}.` });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/admin/reports/:id/close
router.post(
  '/reports/:id/close',
  validate([param('id').isInt({ min: 1 })]),
  async (req, res, next) => {
    try {
      const reportId = parseInt(req.params.id, 10);

      await asUser(req.user.id, async (tx) => {
        await tx.$executeRaw`CALL sp_close_report(${reportId}::int, 'ADMIN_CLOSED')`;
      });

      return res.json({ message: `Report #${reportId} closed by administrator.` });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/admin/settings & PUT /api/admin/settings/:key
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      orderBy: { settingKey: 'asc' }
    });
    return res.json({ data: settings });
  } catch (err) {
    next(err);
  }
});

router.put(
  '/settings/:key',
  validate([
    param('key').isString().notEmpty(),
    body('settingValue').isString().notEmpty().withMessage('settingValue is required')
  ]),
  async (req, res, next) => {
    try {
      const key = req.params.key;
      const { settingValue } = req.body;

      if (key === 'theft_handler_user_id' && settingValue.trim() !== '') {
        const facultyUser = await prisma.user.findUnique({
          where: { userId: parseInt(settingValue, 10) },
          include: { role: true }
        });
        if (!facultyUser || facultyUser.role.roleName !== 'FACULTY' || !facultyUser.isActive) {
          throw new HttpError(400, 'Theft handler must be an active faculty member.', 'INVALID_THEFT_HANDLER');
        }
      }

      const updated = await prisma.systemSetting.upsert({
        where: { settingKey: key },
        update: { settingValue },
        create: { settingKey: key, settingValue }
      });

      return res.json({ setting: updated });
    } catch (err) {
      next(err);
    }
  }
);

// CRUD for Categories, Locations, Designations
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { categoryName: 'asc' } });
    return res.json({ data: categories });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/categories',
  validate([body('categoryName').isString().trim().notEmpty()]),
  async (req, res, next) => {
    try {
      const created = await prisma.category.create({
        data: { categoryName: req.body.categoryName.trim() }
      });
      return res.status(201).json({ category: created });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/categories/:id',
  validate([param('id').isInt({ min: 1 }), body('isActive').isBoolean()]),
  async (req, res, next) => {
    try {
      const updated = await prisma.category.update({
        where: { categoryId: parseInt(req.params.id, 10) },
        data: { isActive: req.body.isActive }
      });
      return res.json({ category: updated });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/locations', async (req, res, next) => {
  try {
    const locations = await prisma.location.findMany({ orderBy: [{ block: 'asc' }, { roomName: 'asc' }] });
    return res.json({ data: locations });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/locations',
  validate([
    body('roomName').isString().trim().notEmpty(),
    body('block').optional().isString().trim(),
    body('floorNo').optional().isInt(),
    body('locationType').isIn(['CLASSROOM', 'EXAM_HALL', 'LAB', 'COMMON_AREA'])
  ]),
  async (req, res, next) => {
    try {
      const created = await prisma.location.create({
        data: {
          roomName: req.body.roomName.trim(),
          block: req.body.block || 'SJT',
          floorNo: req.body.floorNo !== undefined ? parseInt(req.body.floorNo, 10) : null,
          locationType: req.body.locationType
        }
      });
      return res.status(201).json({ location: created });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/locations/:id',
  validate([param('id').isInt({ min: 1 }), body('isActive').isBoolean()]),
  async (req, res, next) => {
    try {
      const updated = await prisma.location.update({
        where: { locationId: parseInt(req.params.id, 10) },
        data: { isActive: req.body.isActive }
      });
      return res.json({ location: updated });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/designations', async (req, res, next) => {
  try {
    const list = await prisma.designation.findMany({ orderBy: { levelRank: 'asc' } });
    return res.json({ data: list });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/designations',
  validate([
    body('title').isString().trim().notEmpty(),
    body('levelRank').isInt({ min: 1 })
  ]),
  async (req, res, next) => {
    try {
      const created = await prisma.designation.create({
        data: {
          title: req.body.title.trim(),
          levelRank: parseInt(req.body.levelRank, 10)
        }
      });
      return res.status(201).json({ designation: created });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/admin/audit-logs
router.get(
  '/audit-logs',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('entity').optional().isString(),
    query('action').optional().isString()
  ]),
  async (req, res, next) => {
    try {
      const { page, pageSize, skip, take } = getPaginationParams(req, 20);
      const { entity, action } = req.query;

      const where = {};
      if (entity) where.entityName = entity;
      if (action) where.action = { contains: action, mode: 'insensitive' };

      const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { fullName: true, email: true } }
          }
        })
      ]);

      const formatted = logs.map(l => ({
        logId: String(l.logId),
        action: l.action,
        entityName: l.entityName,
        entityId: l.entityId,
        actorName: l.user?.fullName || 'System Job',
        actorEmail: l.user?.email || null,
        details: l.details,
        createdAt: l.createdAt
      }));

      return res.json(formatPaginatedResponse(formatted, total, page, pageSize));
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/admin/jobs/run (Run pg_cron scheduled jobs immediately for demo/admin)
router.post('/jobs/run', async (req, res, next) => {
  try {
    await prisma.$executeRaw`CALL sp_run_jobs()`;
    return res.json({ message: 'CampusFind background jobs executed successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
