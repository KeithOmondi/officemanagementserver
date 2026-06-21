// src/features/auth/auth.routes.ts
import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { createUserSchema, requestLoginSchema, verifyLoginSchema } from './auth.schema';
import { protect, requireSuperAdmin } from '../../middleware/auth.middleware';

const router = Router();

// Only super_admin can register new users
router.post('/register-admin', protect, requireSuperAdmin, validate(createUserSchema), authController.createUser);
router.post('/request-otp',    validate(requestLoginSchema), authController.requestLogin);
router.post('/verify-otp',     validate(verifyLoginSchema),  authController.verifyLogin);
router.post('/refresh-token',  authController.refreshToken);
router.post('/logout',         authController.logout);

export default router;