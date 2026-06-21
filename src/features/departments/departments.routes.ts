// src/features/departments/departments.routes.ts
import { Router } from 'express';
import { protect, requireSuperAdmin } from '../../middleware/auth.middleware';
import { departmentController } from './departments.controller';

const router = Router();

router.use(protect);

// Any authenticated user can read (needed for dropdowns)
router.get('/',    departmentController.getAll);
router.get('/:id', departmentController.getById);

// Superadmin only for mutations
router.post('/',      requireSuperAdmin, departmentController.create);
router.put('/:id',    requireSuperAdmin, departmentController.update);
router.delete('/:id', requireSuperAdmin, departmentController.delete);

export default router;