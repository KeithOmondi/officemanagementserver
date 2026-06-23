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
 * requireRole — gates a route to users with one of the specified roles OR 
 * users with a role rank higher than the minimum required.
 * 
 * @param allowedRoles - Array of roles that are allowed, or a single role
 * @param requireMinimumRank - If true (default), users with higher rank also pass
 * 
 * Usage examples:
 *   requireRole(['dept_head', 'super_admin'])  // Only these roles
 *   requireRole('dept_head')                   // Single role
 *   requireRole(['dept_head'], false)          // Only dept_head, not super_admin
 */
export const requireRole = (
  allowedRoles: UserRole | UserRole[], 
  requireMinimumRank: boolean = true
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required.'));
    }

    const userRole = req.user.role as UserRole;
    
    // Check if user role exists in the rank system
    if (!(userRole in ROLE_RANK)) {
      return next(new AppError(403, 'Unrecognised role. Access denied.'));
    }

    // Convert to array for consistent handling
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Check if the user's role is explicitly allowed
    if (roles.includes(userRole)) {
      return next();
    }

    // If requireMinimumRank is true, check if user has a higher rank
    if (requireMinimumRank) {
      // Find the minimum rank among allowed roles
      const minRank = Math.min(...roles.map(role => ROLE_RANK[role]));
      
      if (ROLE_RANK[userRole] >= minRank) {
        return next();
      }
    }

    // Access denied
    const roleNames = roles.join(' or ');
    return next(
      new AppError(403, `This action requires ${roleNames} privileges or above.`)
    );
  };
};

/**
 * requireSameDept — ensures the acting user belongs to the same department
 * as the resource they are accessing.
 * 
 * super_admin bypasses this check entirely.
 */
export const requireSameDept = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new AppError(401, 'Authentication required.'));
  }

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
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new AppError(401, 'Authentication required.'));
  }

  if (req.user.role !== 'super_admin') {
    return next(new AppError(403, 'Restricted to superadministrators only.'));
  }

  next();
};