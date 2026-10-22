import { Router } from 'express';
import { body } from 'express-validator';
import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import prisma from '../config/prisma.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, adminLoginLimiter } from '../middleware/rateLimit.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

function generateJwt(user) {
  return jwt.sign(
    {
      sub: String(user.userId),
      role: user.role.roleName,
      name: user.fullName,
      email: user.email,
      designationLevel: user.designation?.levelRank || 1
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

function sanitizeUser(user) {
  return {
    id: user.userId,
    fullName: user.fullName,
    email: user.email,
    regNo: user.regNo,
    role: user.role?.roleName || 'STUDENT',
    designation: user.designation?.title || null,
    isAvailable: user.isAvailable,
    needsProfile: user.role?.roleName === 'STUDENT' && !user.regNo
  };
}

// POST /api/auth/student-login
router.post(
  '/student-login',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid VIT student email required'),
    body('password').isString().notEmpty().withMessage('Password is required')
  ]),
  async (req, res, next) => {
    try {
      const { email, password, fullName, regNo } = req.body;

      if (!email.endsWith(`@${env.STUDENT_DOMAIN}`)) {
        throw new HttpError(403, `Student login requires an official @${env.STUDENT_DOMAIN} email`, 'DOMAIN_FORBIDDEN');
      }

      let user = await prisma.user.findUnique({
        where: { email },
        include: { role: true, designation: true }
      });

      if (!user) {
        // If student account does not exist yet, auto-create it
        const studentRole = await prisma.role.findUnique({ where: { roleName: 'STUDENT' } });
        if (!studentRole) {
          throw new HttpError(500, 'Student role not configured in database', 'DATABASE_ERROR');
        }

        const name = (fullName || email.split('@')[0]).trim();
        const studentRegNo = regNo ? regNo.trim().toUpperCase() : null;
        const passwordHash = await bcrypt.hash(password, 10);

        user = await prisma.user.create({
          data: {
            fullName: name,
            email,
            regNo: studentRegNo,
            passwordHash,
            roleId: studentRole.roleId,
            isActive: true,
            isAvailable: true,
            lastLoginAt: new Date()
          },
          include: { role: true, designation: true }
        });
      } else {
        if (!user.isActive) {
          throw new HttpError(401, 'Your account has been deactivated.', 'ACCOUNT_DEACTIVATED');
        }

        if (user.passwordHash) {
          const match = await bcrypt.compare(password, user.passwordHash);
          if (!match) {
            throw new HttpError(401, 'Incorrect password. Please try again.', 'INVALID_CREDENTIALS');
          }
        } else {
          // If no password set previously, set it now
          const passwordHash = await bcrypt.hash(password, 10);
          await prisma.user.update({
            where: { userId: user.userId },
            data: { passwordHash }
          });
        }

        user = await prisma.user.update({
          where: { userId: user.userId },
          data: { lastLoginAt: new Date() },
          include: { role: true, designation: true }
        });
      }

      const token = generateJwt(user);
      return res.json({
        token,
        user: sanitizeUser(user)
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/student-register
router.post(
  '/student-register',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid VIT student email required'),
    body('password').isString().notEmpty().withMessage('Password is required'),
    body('fullName').isString().trim().notEmpty().withMessage('Full name is required'),
    body('regNo').isString().trim().notEmpty().withMessage('Registration number is required (e.g. 23BCT0038)')
  ]),
  async (req, res, next) => {
    try {
      const { email, password, fullName, regNo } = req.body;

      if (!email.endsWith(`@${env.STUDENT_DOMAIN}`)) {
        throw new HttpError(403, `Registration requires an official @${env.STUDENT_DOMAIN} email`, 'DOMAIN_FORBIDDEN');
      }

      const studentRole = await prisma.role.findUnique({ where: { roleName: 'STUDENT' } });
      const passwordHash = await bcrypt.hash(password, 10);
      const studentRegNo = regNo.trim().toUpperCase();

      const existing = await prisma.user.findUnique({
        where: { email },
        include: { role: true, designation: true }
      });

      let user;
      if (existing) {
        // If user already exists, update their profile and password, then log them in
        user = await prisma.user.update({
          where: { userId: existing.userId },
          data: {
            fullName: fullName.trim(),
            regNo: studentRegNo,
            passwordHash,
            roleId: studentRole.roleId,
            isActive: true,
            lastLoginAt: new Date()
          },
          include: { role: true, designation: true }
        });
      } else {
        user = await prisma.user.create({
          data: {
            fullName: fullName.trim(),
            email,
            regNo: studentRegNo,
            passwordHash,
            roleId: studentRole.roleId,
            isActive: true,
            isAvailable: true,
            lastLoginAt: new Date()
          },
          include: { role: true, designation: true }
        });
      }

      const token = generateJwt(user);
      return res.status(200).json({
        token,
        user: sanitizeUser(user)
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/staff-login
router.post(
  '/staff-login',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid institutional email required'),
    body('password').isString().notEmpty().withMessage('Password is required')
  ]),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
        include: { role: true, designation: true }
      });

      if (!user) {
        throw new HttpError(
          401,
          'Staff/Faculty account not found. Please contact the HOD/Admin (admin@vit.ac.in) to add your account.',
          'ACCOUNT_NOT_FOUND'
        );
      }

      if (user.role.roleName === 'STUDENT') {
        throw new HttpError(403, 'This login is for Staff and Faculty members. Please use the Student login tab.', 'ROLE_MISMATCH');
      }

      if (!user.isActive) {
        throw new HttpError(401, 'Your account has been deactivated.', 'ACCOUNT_DEACTIVATED');
      }

      if (user.passwordHash) {
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
          throw new HttpError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
        }
      } else {
        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.user.update({
          where: { userId: user.userId },
          data: { passwordHash }
        });
      }

      await prisma.user.update({
        where: { userId: user.userId },
        data: { lastLoginAt: new Date() }
      });

      const token = generateJwt(user);
      return res.json({
        token,
        user: sanitizeUser(user)
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/complete-profile
router.post(
  '/complete-profile',
  auth,
  validate([
    body('regNo')
      .isString()
      .trim()
      .matches(/^\d{2}[A-Z]{3}\d{4}$/)
      .withMessage('Registration number must match pattern e.g. 23BCT0038')
  ]),
  async (req, res, next) => {
    try {
      if (req.user.role !== 'STUDENT') {
        throw new HttpError(403, 'Profile completion is only applicable to students', 'FORBIDDEN');
      }

      const regNo = req.body.regNo.trim().toUpperCase();

      const existing = await prisma.user.findUnique({ where: { regNo } });
      if (existing && existing.userId !== req.user.id) {
        throw new HttpError(409, 'This registration number is already linked to another account.', 'REG_NO_EXISTS');
      }

      const updated = await prisma.user.update({
        where: { userId: req.user.id },
        data: { regNo },
        include: { role: true, designation: true }
      });

      return res.json({
        user: sanitizeUser(updated)
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/admin-login (Break-glass admin)
router.post(
  '/admin-login',
  adminLoginLimiter,
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isString().notEmpty().withMessage('Password is required')
  ]),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
        include: { role: true, designation: true }
      });

      if (!user || user.role.roleName !== 'ADMIN' || !user.passwordHash) {
        throw new HttpError(401, 'Invalid admin email or password', 'INVALID_CREDENTIALS');
      }

      if (!user.isActive) {
        throw new HttpError(401, 'Your account has been deactivated.', 'ACCOUNT_DEACTIVATED');
      }

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        throw new HttpError(401, 'Invalid admin email or password', 'INVALID_CREDENTIALS');
      }

      await prisma.user.update({
        where: { userId: user.userId },
        data: { lastLoginAt: new Date() }
      });

      const token = generateJwt(user);
      return res.json({
        token,
        user: sanitizeUser(user)
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { userId: req.user.id },
      include: { role: true, designation: true }
    });

    if (!user) {
      throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
    }

    return res.json({
      user: sanitizeUser(user)
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  return res.status(204).send();
});

export default router;
