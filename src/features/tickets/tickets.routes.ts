// src/features/tickets/tickets.routes.ts
import { Router } from 'express';
import { ticketController } from './tickets.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// ── Read ──────────────────────────────────────────────────────────────────────
router.get('/', requireRole('super_admin', 'dept_head', 'staff'), ticketController.getAll);
router.get('/:id', requireRole('super_admin', 'dept_head', 'staff'), ticketController.getById);

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/', requireRole('dept_head', 'staff'), ticketController.create);

// ── Update ────────────────────────────────────────────────────────────────────
router.put('/:id', requireRole('dept_head', 'staff'), ticketController.update);

// ── Workflow ──────────────────────────────────────────────────────────────────
router.post('/:id/submit', ticketController.submitForApproval);
router.post('/:id/approve', requireRole('super_admin',), ticketController.approve);
router.post('/:id/reject', requireRole('super_admin'), ticketController.reject);
router.post('/:id/return', requireRole('super_admin', 'dept_head'), ticketController.return);
router.post('/:id/book', requireRole('super_admin', 'dept_head'), ticketController.book);
router.post('/:id/cancel', requireRole('dept_head'), ticketController.cancel);
router.post('/:id/complete', requireRole('dept_head'), ticketController.complete);

// ── Comments ──────────────────────────────────────────────────────────────────
router.post('/:id/comments', requireRole('super_admin', 'dept_head'), ticketController.addComment);
router.delete('/:id/comments/:commentId', requireRole('super_admin', 'dept_head'), ticketController.deleteComment);

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', requireRole('super_admin', 'dept_head'), ticketController.delete);

export default router;