// src/features/tickets/tickets.routes.ts
import { Router } from 'express';
import { ticketController } from './tickets.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// ── Read ──────────────────────────────────────────────────────────────────────
router.get('/', ticketController.getAll);
router.get('/:id', ticketController.getById);

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/', requireRole('staff'), ticketController.create);

// ── Update ────────────────────────────────────────────────────────────────────
router.put('/:id', requireRole('staff'), ticketController.update);

// ── Workflow ──────────────────────────────────────────────────────────────────
router.post('/:id/submit', ticketController.submitForApproval);
router.post('/:id/approve', requireRole('super_admin'), ticketController.approve);
router.post('/:id/reject', requireRole('super_admin'), ticketController.reject);
router.post('/:id/return', requireRole('super_admin'), ticketController.return);
router.post('/:id/book', requireRole('super_admin'), ticketController.book);
router.post('/:id/cancel', requireRole('staff'), ticketController.cancel);
router.post('/:id/complete', requireRole('staff'), ticketController.complete);

// ── Comments ──────────────────────────────────────────────────────────────────
router.post('/:id/comments', ticketController.addComment);
router.delete('/:id/comments/:commentId', ticketController.deleteComment);

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', requireRole('super_admin'), ticketController.delete);

export default router;