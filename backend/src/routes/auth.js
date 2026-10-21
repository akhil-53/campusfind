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

// POST /api/auth/google
router.post(
  '/google',
  authLimiter,
  validate([body('credential').isString().notEmpty().withMessage('Google credential is required')]),
  async (req, res, next) => {
    try {
      const { credential } = req.body;
      let payload;

      try {
        if (env.GOOGLE_CLIENT_ID) {
          const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: env.GOOGLE_CLIENT_ID
          });
          payload = ticket.getPayload();
        } else {
          // Dev decoding fallback if Google Client ID is not yet configured in local test
          payload = jwt.decode(credential);
        }
      } catch (err) {
        throw new HttpError(401, 'Invalid Google ID token', 'INVALID_CREDENTIAL');
      }

      if (!payload || !payload.email) {
        throw new HttpError(401, 'Unable to extract email from Google credential', 'INVALID_CREDENTIAL');
      }

      if (env.GOOGLE_CLIENT_ID && payload.email_verified === false) {
        throw new HttpError(401, 'Google email address is not verified', 'EMAIL_NOT_VERIFIED');
      }

      const email = payload.email.trim().toLowerCase();
      const fullName = payload.name || email.split('@')[0];
      const googleId = payload.sub;

      const isWhitelistedAdmin = env.BOOTSTRAP_ADMIN_EMAILS.includes(email);
      const isWhitelistedFaculty = env.BOOTSTRAP_FACULTY_EMAILS.includes(email);
      const isStudent = email.endsWith(`@${env.STUDENT_DOMAIN}`);
      const isStaff = email.endsWith(`@${env.STAFF_DOMAIN}`);

      let user = await prisma.user.findUnique({
        where: { email },
        include: { role: true, designation: true }
      });

      // Allow if valid student/staff domain, whitelisted as admin/faculty, or already provisioned in database
      if (!isStudent && !isStaff && !isWhitelistedAdmin && !isWhitelistedFaculty && !user) {
        throw new HttpError(403, 'Access denied. Please use your official VIT institutional email.', 'DOMAIN_FORBIDDEN');
      }

      if (!user) {
        if (isWhitelistedAdmin) {
          const adminRole = await prisma.role.findUnique({ where: { roleName: 'ADMIN' } });
          user = await prisma.user.create({
            data: {
              fullName,
              email,
              googleId,
              roleId: adminRole.roleId,
              lastLoginAt: new Date()
            },
            include: { role: true, designation: true }
          });
        } else if (isWhitelistedFaculty) {
          const facultyRole = await prisma.role.findUnique({ where: { roleName: 'FACULTY' } });
          const facultyDes = await prisma.designation.findUnique({ where: { title: 'Faculty' } });
          const hodUser = await prisma.user.findFirst({
            where: { designation: { title: 'HOD' }, isActive: true }
          });
          user = await prisma.user.create({
            data: {
              fullName,
              email,
              googleId,
              roleId: facultyRole.roleId,
              designationId: facultyDes?.designationId || null,
              reportsToId: hodUser?.userId || null,
              isActive: true,
              isAvailable: true,
              lastLoginAt: new Date()
            },
            include: { role: true, designation: true }
          });
        } else if (isStudent) {
          // Student auto-signup
          const studentRole = await prisma.role.findUnique({ where: { roleName: 'STUDENT' } });
          if (!studentRole) {
            throw new HttpError(500, 'Student role not configured in database', 'DATABASE_ERROR');
          }

          user = await prisma.user.create({
            data: {
              fullName,
              email,
              googleId,
              roleId: studentRole.roleId,
              lastLoginAt: new Date()
            },
            include: { role: true, designation: true }
          });
        } else if (isStaff) {
          throw new HttpError(
            403,
            'Your account has not been set up. Please contact the administrator.',
            'ACCOUNT_NOT_PROVISIONED'
          );
        }
      } else {
        if (!user.isActive) {
          throw new HttpError(401, 'Your account has been deactivated.', 'ACCOUNT_DEACTIVATED');
        }

        const updateData = {
          googleId: user.googleId || googleId,
          lastLoginAt: new Date()
        };

        // If email is explicitly configured in BOOTSTRAP_FACULTY_EMAILS, elevate to Faculty
        if (isWhitelistedFaculty && user.role.roleName !== 'FACULTY') {
          const facultyRole = await prisma.role.findUnique({ where: { roleName: 'FACULTY' } });
          const facultyDes = await prisma.designation.findUnique({ where: { title: 'Faculty' } });
          const hodUser = await prisma.user.findFirst({
            where: { designation: { title: 'HOD' }, isActive: true }
          });
          updateData.roleId = facultyRole.roleId;
          updateData.designationId = facultyDes?.designationId || user.designationId;
          updateData.reportsToId = hodUser?.userId || user.reportsToId;
          updateData.isAvailable = true;
        }

        user = await prisma.user.update({
          where: { userId: user.userId },
          data: updateData,
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
