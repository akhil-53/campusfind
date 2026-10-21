import { HttpError } from '../utils/httpError.js';

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, `Access forbidden for role ${req.user.role}`, 'FORBIDDEN'));
    }

    next();
  };
}
