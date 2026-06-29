// src/features/external-links/external-links.routes.ts

import { Router } from 'express';
import { protect, requireRole } from '../../middleware/auth.middleware';
import { externalLinksController } from './links.controller';

const router = Router();

router.use(protect);

// ─── Static routes FIRST ──────────────────────────────────────────────────

router.get('/stats', externalLinksController.getStats);
router.get('/categories', externalLinksController.getCategories);
router.post('/categories', requireRole('super_admin'), externalLinksController.createCategory);
router.put('/categories/:categoryId', requireRole('super_admin'), externalLinksController.updateCategory);
router.delete('/categories/:categoryId', requireRole('super_admin'), externalLinksController.deleteCategory);

// ─── General link routes ──────────────────────────────────────────────────

router.get('/', externalLinksController.getLinks);
router.post('/', requireRole('super_admin'), externalLinksController.createLink);

// ─── Param routes LAST ────────────────────────────────────────────────────

router.get('/:id', externalLinksController.getLinkById);
router.put('/:id', requireRole('super_admin'), externalLinksController.updateLink);
router.delete('/:id', requireRole('super_admin'), externalLinksController.deleteLink);
router.post('/:id/click', externalLinksController.trackClick);

export default router;