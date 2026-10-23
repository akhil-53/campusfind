import { Router } from 'express';
import multer from 'multer';
import { body, param, query } from 'express-validator';
import prisma from '../config/prisma.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asUser } from '../services/dbActor.js';
import { uploadItemImage, getSignedImageUrl } from '../services/storage.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024 // 3 MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/pjpeg'];
    if (allowed.includes(file.mimetype.toLowerCase()) || /\.(jpe?g|png|webp)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new HttpError(400, 'Only JPEG, PNG and WebP images are allowed.', 'INVALID_FILE_TYPE'));
    }
  }
});

// POST /api/found-items (Staff logs found item)
router.post(
  '/',
  auth,
  authorize('STAFF', 'ADMIN'),
  upload.array('images', 3),
  validate([
    body('categoryId').isInt({ min: 1 }).withMessage('Valid category ID is required'),
    body('categoryCustom').optional({ nullable: true }).isString().trim().isLength({ max: 80 }),
    body('locationId').optional({ nullable: true }),
    body('locationText').optional({ nullable: true }).isString().trim().isLength({ min: 2, max: 200 }),
    body('description').isString().trim().isLength({ min: 3, max: 200 }).withMessage('Description must be 3-200 characters'),
    body('color').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
    body('brand').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
    body('shelfCode').isString().trim().notEmpty().withMessage('Shelf code is required (e.g. SH-A01)'),
    body('foundAt').isISO8601().withMessage('Valid foundAt ISO date required')
  ]),
  async (req, res, next) => {
    let createdItemId = null;
    try {
      const { categoryId, categoryCustom, locationId, locationText, description, color, brand, shelfCode, foundAt } = req.body;
      const foundDate = new Date(foundAt);
      const now = new Date();

      if (foundDate > new Date(now.getTime() + 5 * 60 * 1000)) {
        throw new HttpError(422, 'Found time cannot be in the future', 'FUTURE_DATE_NOT_ALLOWED');
      }

      const parsedLocationId = locationId && parseInt(locationId, 10) > 0 ? parseInt(locationId, 10) : null;
      const cleanLocationText = locationText && locationText.trim() ? locationText.trim() : null;

      if (!parsedLocationId && !cleanLocationText) {
        throw new HttpError(400, 'Please enter a room number or location', 'LOCATION_REQUIRED');
      }

      // Check shelf code uniqueness
      const existingShelf = await prisma.foundItem.findUnique({ where: { shelfCode: shelfCode.trim() } });
      if (existingShelf) {
        throw new HttpError(409, `Shelf code ${shelfCode} is already occupied.`, 'SHELF_CODE_EXISTS');
      }

      const item = await asUser(req.user.id, async (tx) => {
        return tx.foundItem.create({
          data: {
            categoryId: parseInt(categoryId, 10),
            categoryCustom: categoryCustom && categoryCustom.trim() ? categoryCustom.trim() : null,
            locationId: parsedLocationId,
            locationText: cleanLocationText,
            loggedBy: req.user.id,
            description,
            color: color || null,
            brand: brand || null,
            shelfCode: shelfCode.trim(),
            status: 'AVAILABLE',
            foundAt: foundDate
          }
        });
      });

      createdItemId = item.foundId;

      // Handle photos if any uploaded
      const files = req.files || [];
      if (files.length > 0) {
        try {
          const imageRecords = [];
          for (const file of files) {
            const storagePath = await uploadItemImage(item.foundId, file);
            imageRecords.push({
              foundId: item.foundId,
              storagePath
            });
          }

          if (imageRecords.length > 0) {
            await prisma.itemImage.createMany({
              data: imageRecords
            });
          }
        } catch (uploadErr) {
          // Compensate: delete item row if storage upload fails
          console.error('[FoundItems] Upload failed, rolling back item row:', uploadErr);
          await prisma.foundItem.delete({ where: { foundId: createdItemId } });
          throw new HttpError(502, 'Failed to upload item images to storage service', 'STORAGE_UPLOAD_FAILED');
        }
      }

      const completeItem = await prisma.foundItem.findUnique({
        where: { foundId: item.foundId },
        include: {
          category: true,
          location: true,
          images: true
        }
      });

      return res.status(201).json({ item: completeItem });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/found-items (Staff/Faculty/Admin list & search)
router.get(
  '/',
  auth,
  authorize('STAFF', 'FACULTY', 'ADMIN'),
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1 }),
    query('search').optional().isString(),
    query('categoryId').optional().isInt({ min: 1 }),
    query('locationId').optional().isInt({ min: 1 }),
    query('status').optional().isString(),
    query('flagged').optional().isBoolean()
  ]),
  async (req, res, next) => {
    try {
      const { page, pageSize, skip, take } = getPaginationParams(req);
      const { search, categoryId, locationId, status, flagged, from, to } = req.query;

      const where = {};

      if (categoryId) where.categoryId = parseInt(categoryId, 10);
      if (locationId) where.locationId = parseInt(locationId, 10);
      if (status) where.status = status;
      if (flagged === 'true' || flagged === true) where.unclaimedFlaggedAt = { not: null };

      if (from || to) {
        where.foundAt = {};
        if (from) where.foundAt.gte = new Date(from);
        if (to) where.foundAt.lte = new Date(to);
      }

      if (search && search.trim()) {
        const queryTerm = search.trim();
        where.OR = [
          { description: { contains: queryTerm, mode: 'insensitive' } },
          { brand: { contains: queryTerm, mode: 'insensitive' } },
          { shelfCode: { contains: queryTerm, mode: 'insensitive' } },
          { locationText: { contains: queryTerm, mode: 'insensitive' } },
          { categoryCustom: { contains: queryTerm, mode: 'insensitive' } }
        ];
      }

      const [total, items] = await Promise.all([
        prisma.foundItem.count({ where }),
        prisma.foundItem.findMany({
          where,
          skip,
          take,
          orderBy: { foundAt: 'desc' },
          include: {
            category: true,
            location: true,
            images: true
          }
        })
      ]);

      // Sign photo URLs for viewing
      const itemsWithSignedUrls = await Promise.all(
        items.map(async (item) => {
          const signedImages = await Promise.all(
            item.images.map(async (img) => ({
              ...img,
              url: await getSignedImageUrl(img.storagePath, 3600)
            }))
          );
          return {
            ...item,
            images: signedImages
          };
        })
      );

      return res.json(formatPaginatedResponse(itemsWithSignedUrls, total, page, pageSize));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/found-items/:id (Detail with photos and match count)
router.get(
  '/:id',
  auth,
  authorize('STAFF', 'FACULTY', 'ADMIN'),
  validate([param('id').isInt({ min: 1 })]),
  async (req, res, next) => {
    try {
      const foundId = parseInt(req.params.id, 10);
      const item = await prisma.foundItem.findUnique({
        where: { foundId },
        include: {
          category: true,
          location: true,
          images: true,
          _count: {
            select: { matches: true }
          }
        }
      });

      if (!item) {
        throw new HttpError(404, 'Found item not found', 'ITEM_NOT_FOUND');
      }

      const signedImages = await Promise.all(
        item.images.map(async (img) => ({
          ...img,
          url: await getSignedImageUrl(img.storagePath, 3600)
        }))
      );

      return res.json({
        item: {
          ...item,
          images: signedImages,
          matchCount: item._count.matches
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/found-items/:id (Edit available item)
router.patch(
  '/:id',
  auth,
  authorize('STAFF', 'ADMIN'),
  validate([
    param('id').isInt({ min: 1 }),
    body('description').optional().isString().trim().isLength({ min: 3, max: 200 }),
    body('color').optional({ nullable: true }).isString().trim(),
    body('brand').optional({ nullable: true }).isString().trim(),
    body('shelfCode').optional().isString().trim()
  ]),
  async (req, res, next) => {
    try {
      const foundId = parseInt(req.params.id, 10);
      const existing = await prisma.foundItem.findUnique({ where: { foundId } });

      if (!existing) {
        throw new HttpError(404, 'Item not found', 'ITEM_NOT_FOUND');
      }

      if (existing.status !== 'AVAILABLE') {
        throw new HttpError(409, `Cannot edit item in status ${existing.status}`, 'CANNOT_EDIT_ITEM');
      }

      const updateData = {};
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.color !== undefined) updateData.color = req.body.color;
      if (req.body.brand !== undefined) updateData.brand = req.body.brand;
      if (req.body.shelfCode !== undefined) updateData.shelfCode = req.body.shelfCode.trim();

      const updated = await prisma.foundItem.update({
        where: { foundId },
        data: updateData
      });

      return res.json({ item: updated });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/found-items/:id/dispose (Staff disposes or donates unclaimed item)
router.post(
  '/:id/dispose',
  auth,
  authorize('STAFF', 'ADMIN'),
  validate([
    param('id').isInt({ min: 1 }),
    body('action').isIn(['DISPOSED', 'DONATED']).withMessage('Action must be DISPOSED or DONATED'),
    body('reason').isString().trim().notEmpty().withMessage('Disposal reason is required')
  ]),
  async (req, res, next) => {
    try {
      const foundId = parseInt(req.params.id, 10);
      const { action, reason } = req.body;

      const item = await prisma.foundItem.findUnique({ where: { foundId } });
      if (!item) {
        throw new HttpError(404, 'Item not found', 'ITEM_NOT_FOUND');
      }

      if (item.status !== 'AVAILABLE') {
        throw new HttpError(409, `Cannot dispose item with status ${item.status}`, 'CANNOT_DISPOSE');
      }

      const updated = await asUser(req.user.id, async (tx) => {
        return tx.foundItem.update({
          where: { foundId },
          data: {
            status: action,
            disposedAt: new Date(),
            disposalReason: reason
          }
        });
      });

      return res.json({ item: updated, message: `Item successfully marked as ${action.toLowerCase()}.` });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/found-items/:id/handed-over (Mark handed over on letter)
router.post(
  '/:id/handed-over',
  auth,
  authorize('STAFF', 'FACULTY', 'ADMIN'),
  validate([param('id').isInt({ min: 1 })]),
  async (req, res, next) => {
    try {
      const foundId = parseInt(req.params.id, 10);

      const letter = await prisma.handoverLetter.findFirst({
        where: {
          verification: {
            match: { foundId }
          }
        }
      });

      if (!letter) {
        throw new HttpError(404, 'No handover letter found for this item', 'LETTER_NOT_FOUND');
      }

      const updated = await prisma.handoverLetter.update({
        where: { letterId: letter.letterId },
        data: { handedOverAt: new Date() }
      });

      return res.json({
        message: 'Item physical handover confirmed.',
        letter: updated
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
