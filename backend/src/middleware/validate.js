import { validationResult } from 'express-validator';

export function validate(validations) {
  return async (req, res, next) => {
    for (const validation of validations) {
      const result = await validation.run(req);
      if (result.errors.length) break;
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    return res.status(422).json({
      error: 'VALIDATION',
      details: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg
      }))
    });
  };
}
