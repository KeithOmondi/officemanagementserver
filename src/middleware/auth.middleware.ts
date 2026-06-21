// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/response';

export type UserRole = 'super_admin' | 'dept_head' | 'staff' | 'viewer';

interface DecodedToken {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department_id: string | null;
}

// Role hierarchy — higher number = more access
const ROLE_RANK: Record<UserRole, number> = {
  viewer:     0,
  staff:      1,
  dept_head:  2,
  super_admin: 3,
};

/**
 * Protect — verifies the access token and attaches user context to req.user.
 * Must be the first auth middleware on any protected route.
 */
export const protect = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Access denied. No token provided.'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as DecodedToken;

    req.user = {
      id:            decoded.id,
      email:         decoded.email,
      full_name:     decoded.full_name,
      role:          decoded.role,
      department_id: decoded.department_id,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'Session expired. Please log in again.'));
    }
    return next(new AppError(401, 'Authentication failed. Invalid token signature.'));
  }
};

/**
 * requireRole — gates a route to users at or above the specified role level.
 * super_admin always passes regardless of the required role.
 *
 * Usage: router.delete('/users/:id', protect, requireRole('dept_head'), ...)
 */
export const requireRole = (minRole: UserRole) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AppError(401, 'Authentication required.'));

    const userRole = req.user.role as UserRole;

    if (!(userRole in ROLE_RANK)) {
      return next(new AppError(403, 'Unrecognised role. Access denied.'));
    }

    if (ROLE_RANK[userRole] < ROLE_RANK[minRole]) {
      return next(
        new AppError(403, `This action requires '${minRole}' privileges or above.`)
      );
    }

    next();
  };
};
/**
 * requireSameDept — ensures the acting user belongs to the same department
 * as the resource they are accessing (passed as req.params.departmentId or
 * resolved from a prior middleware into req.resourceDepartmentId).
 *
 * super_admin bypasses this check entirely.
 *
 * Usage: router.get('/dept/:departmentId/records', protect, requireSameDept, ...)
 */
export const requireSameDept = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) return next(new AppError(401, 'Authentication required.'));

  // super_admin sees everything
  if (req.user.role === 'super_admin') return next();

  const targetDeptId = req.params.departmentId ?? req.resourceDepartmentId;

  if (!targetDeptId) {
    return next(new AppError(400, 'Department context could not be resolved for this request.'));
  }

  if (req.user.department_id !== targetDeptId) {
    return next(new AppError(403, 'You do not have access to resources outside your department.'));
  }

  next();
};

/**
 * requireSuperAdmin — hard gate for system-level operations only.
 * (user creation, role changes, cross-dept reports, audit logs)
 *
 * Usage: router.post('/admin/register', protect, requireSuperAdmin, ...)
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) return next(new AppError(401, 'Authentication required.'));

  if (req.user.role !== 'super_admin') {
    return next(new AppError(403, 'Restricted to superadministrators only.'));
  }

  next();
};