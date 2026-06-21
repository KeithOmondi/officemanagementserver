import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/response';
import { env } from '../config/env';

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // 1. Intercept Zod Schema Validation Issues
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // 2. Intercept Intentional App Operational Errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // 3. Intercept Postgres Unique Constraint Violations (e.g. duplicating emails)
  if (err.code === '23505') {
    res.status(409).json({
      success: false,
      error: 'Resource conflict: This record already exists.',
    });
    return;
  }

  // 4. Critical Server Exceptions Fallback
  console.error('💥 Unhandled Exception Core Error:', err);
  
  res.status(500).json({
    success: false,
    error: env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message || err,
  });
};