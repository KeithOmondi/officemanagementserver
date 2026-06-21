// src/features/users/users.routes.ts
import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { userController } from './users.controller';
import { updateUserSchema, userIdSchema, userFiltersSchema, createUserSchema } from './users.validator';
import { protect, requireRole, requireSuperAdmin } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// Any authenticated user — self only
router.get('/me',  userController.getCurrentUser);
router.put('/me',  validate(updateUserSchema), userController.updateCurrentUser);

// dept_head and above can view stats and list users
router.get('/stats', requireRole('dept_head'), userController.getUserStats);
router.get('/',      requireRole('dept_head'), validate(userFiltersSchema), userController.getAllUsers);

// super_admin only — create, modify, delete
router.post('/',     requireSuperAdmin, validate(createUserSchema),   userController.createUser);
router.get(   '/:id', requireRole('dept_head'), validate(userIdSchema), userController.getUserById);
router.put(   '/:id', requireSuperAdmin, validate(userIdSchema), validate(updateUserSchema), userController.updateUser);
router.delete('/:id', requireSuperAdmin, validate(userIdSchema), userController.deleteUser);
router.delete('/:id/permanent', requireSuperAdmin, validate(userIdSchema), userController.hardDeleteUser);

export default router;