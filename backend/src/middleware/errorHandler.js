import { HttpError } from '../utils/httpError.js';

export function errorHandler(err, req, res, next) {
  // Log real error for debugging
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.code || 'HTTP_ERROR',
      message: err.message,
      ...(err.details ? { details: err.details } : {})
    });
  }

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'CONFLICT',
      message: 'A record with this unique value already exists.',
      fields: err.meta?.target
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: 'The requested record was not found.'
    });
  }

  // Postgres RAISE EXCEPTION / P0001
  if (err.code === 'P0001' || err.message?.includes('P0001')) {
    const cleanMsg = err.message.replace(/.*(?:EXCEPTION|Error):\s*/i, '').split('\n')[0];
    return res.status(409).json({
      error: 'BUSINESS_RULE_VIOLATION',
      message: cleanMsg || 'A business rule violation occurred.'
    });
  }

  // Postgres Check constraint violation (23514)
  if (err.code === '23514' || err.message?.includes('23514')) {
    return res.status(422).json({
      error: 'CHECK_VIOLATION',
      message: 'Input failed database constraint check.'
    });
  }

  // Fallback 500
  return res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected internal error occurred. Please try again later.'
  });
}
