// src/features/e-stamp/e-stamp.routes.ts

import { Router } from 'express';
import { EStampController } from './e-stamp.controller';
import {
    generateEStampSchema,
    verifyEStampSchema,
    revokeEStampSchema,
    getEStampByDocumentSchema,
    listEStampsSchema,
} from './e-stamp.schema';
import { protect, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ── POST /api/e-stamps/generate ────────────────────────────────────────────
// Super Admin can generate 'approved' stamps
// Admin Desk can generate 'received' stamps
router.post(
    '/generate',
    requireRole('super_admin', 'dept_head'),
    validate(generateEStampSchema),
    EStampController.generateEStamp
);

// ── POST /api/e-stamps/verify ──────────────────────────────────────────────
// Public endpoint - anyone can verify
router.post(
    '/verify',
    validate(verifyEStampSchema),
    EStampController.verifyEStamp
);

// ── POST /api/e-stamps/:id/revoke ──────────────────────────────────────────
// Only Super Admin can revoke
router.post(
    '/:id/revoke',
    requireRole('super_admin'),
    validate(revokeEStampSchema),
    EStampController.revokeEStamp
);

// ── GET /api/e-stamps/document/:document_id ────────────────────────────────
router.get(
    '/document/:document_id',
    validate(getEStampByDocumentSchema),
    EStampController.getEStampByDocument
);

// ── GET /api/e-stamps ──────────────────────────────────────────────────────
router.get(
    '/',
    validate(listEStampsSchema),
    EStampController.listEStamps
);

export default router;