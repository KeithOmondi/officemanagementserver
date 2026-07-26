// src/features/dashboard/dashboard.routes.ts
import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// ── All dashboard routes require authentication and super admin role ──────
router.use(protect);
router.use(requireRole('super_admin'));

// ── Get all dashboard statistics ──────────────────────────────────────────
router.get('/stats', dashboardController.getStats);

export default router;