// src/types/express/index.d.ts
import { UserRole } from '../../middlewares/auth.middleware';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id:            string;
        email:         string;
        full_name:     string;
        role:          UserRole;
        department_id: string | null;
      };
      resourceDepartmentId?: string; // set by resource-lookup middleware when dept context is needed
    }
  }
}