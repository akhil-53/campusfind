import { Router } from 'express';
import { param } from 'express-validator';
import prisma from '../config/prisma.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { generateHandoverPdf } from '../services/pdf.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

// GET /api/letters/:verificationId/pdf
router.get(
  '/:verificationId/pdf',
  auth,
  validate([param('verificationId').isInt({ min: 1 })]),
  async (req, res, next) => {
    try {
      const verificationId = parseInt(req.params.verificationId, 10);

      const verification = await prisma.verification.findUnique({
        where: { verificationId },
        include: {
          handoverLetter: true,
          verifier: {
            include: { designation: true }
          },
          match: {
            include: {
              report: {
                include: {
                  student: true
                }
              },
              foundItem: {
                include: {
                  category: true,
                  location: true
                }
              }
            }
          }
        }
      });

      if (!verification || !verification.handoverLetter) {
        throw new HttpError(404, 'Handover letter not found for this verification', 'LETTER_NOT_FOUND');
      }

      const report = verification.match.report;
      const student = report.student;

      // Access check: Student (own), Faculty (on case), or Admin
      if (req.user.role === 'STUDENT' && student.userId !== req.user.id) {
        throw new HttpError(404, 'Letter not found', 'LETTER_NOT_FOUND');
      }

      const letterData = {
        letterNo: verification.handoverLetter.letterNo,
        verifyCode: verification.handoverLetter.verifyCode,
        generatedAt: verification.handoverLetter.generatedAt,
        studentName: student.fullName,
        regNo: student.regNo,
        categoryName: verification.match.foundItem.category.categoryName,
        shelfCode: verification.match.foundItem.shelfCode,
        description: verification.match.foundItem.description,
        roomName: verification.match.foundItem.location.roomName,
        foundAt: verification.match.foundItem.foundAt,
        verifierName: verification.verifier?.fullName || 'Faculty Verifier',
        verifierDesignation: verification.verifier?.designation?.title || 'Faculty',
        marksClaimed: verification.marksClaimed,
        marksObserved: verification.marksObserved
      };

      await generateHandoverPdf(letterData, res);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
