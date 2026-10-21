import { HttpError } from '../utils/httpError.js';

export function requireProfile(req, res, next) {
  if (req.user && req.user.role === 'STUDENT' && req.user.needsProfile) {
    return next(new HttpError(403, 'Please complete your profile by providing your registration number.', 'PROFILE_INCOMPLETE'));
  }
  next();
}
