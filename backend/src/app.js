import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';

// Global BigInt JSON serialization patch — prevents "Do not know how to serialize a BigInt"
// crashes whenever a Prisma BigInt field (e.g. AuditLog.logId) leaks into a response.
BigInt.prototype.toJSON = function () { return this.toString(); };
import { generalLimiter, authLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { HttpError } from './utils/httpError.js';

// Route imports
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import reportsRoutes from './routes/reports.js';
import foundItemsRoutes from './routes/foundItems.js';
import facultyRoutes from './routes/faculty.js';
import matchesRoutes from './routes/matches.js';
import verificationsRoutes from './routes/verifications.js';
import lettersRoutes from './routes/letters.js';
import staffRoutes from './routes/staff.js';
import roomVisitsRoutes from './routes/roomVisits.js';
import notificationsRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';

const app = express();

// 1. Helmet security headers
app.use(helmet());

// 2. CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);
      if (env.CORS_ORIGIN.includes(origin) || env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: false
  })
);

// 3. Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// 5. General rate limiter on all API routes
app.use('/api', generalLimiter);

// 6. Strict rate limiter on /api/auth
app.use('/api/auth', authLimiter);

// 7. Mount Routers under /api
app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/found-items', foundItemsRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/verifications', verificationsRoutes);
app.use('/api/letters', lettersRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/room-visits', roomVisitsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);

// 8. 404 Handler
app.use((req, res, next) => {
  next(new HttpError(404, `Endpoint ${req.method} ${req.originalUrl} not found`, 'ENDPOINT_NOT_FOUND'));
});

// 9. Central Error Handler
app.use(errorHandler);

export default app;
