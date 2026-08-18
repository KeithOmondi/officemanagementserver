// src/features/tickets/tickets.routes.ts
import { Router } from 'express';
import { ticketController } from './tickets.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// ── All routes require authentication ──────────────────────────────────────
router.use(protect);

// ── Read ──────────────────────────────────────────────────────────────────────
router.get('/', requireRole('super_admin', 'dept_head', 'staff'), ticketController.getAll);
router.get('/:id', requireRole('super_admin', 'dept_head', 'staff'), ticketController.getById);

// ── Create ────────────────────────────────────────────────────────────────────
// Dept heads and staff can create tickets with multiple passengers
router.post('/', requireRole('dept_head', 'staff'), ticketController.create);

// ── Update ────────────────────────────────────────────────────────────────────
// Dept heads and staff can update tickets (including passenger list)
router.put('/:id', requireRole('dept_head', 'staff'), ticketController.update);

// ── Workflow ──────────────────────────────────────────────────────────────────
// Submit for approval (dept heads and staff)
router.post('/:id/submit', requireRole('dept_head', 'staff'), ticketController.submitForApproval);

// Approve/Reject (super admin only)
router.post('/:id/approve', requireRole('super_admin'), ticketController.approve);
router.post('/:id/reject', requireRole('super_admin'), ticketController.reject);

// Return (super admin or dept head)
router.post('/:id/return', requireRole('super_admin', 'dept_head'), ticketController.return);

// Book (super admin or dept head)
router.post('/:id/book', requireRole('super_admin', 'dept_head'), ticketController.book);

// Cancel (dept head only)
router.post('/:id/cancel', requireRole('dept_head'), ticketController.cancel);

// Complete (dept head only)
router.post('/:id/complete', requireRole('dept_head'), ticketController.complete);

// ── Comments ──────────────────────────────────────────────────────────────────
// Add comment (super admin or dept head)
router.post('/:id/comments', requireRole('super_admin', 'dept_head'), ticketController.addComment);

// Delete comment (super admin or dept head)
router.delete('/:id/comments/:commentId', requireRole('super_admin', 'dept_head'), ticketController.deleteComment);

// ── Delete ────────────────────────────────────────────────────────────────────
// Soft delete (super admin, dept head, or staff)
router.delete('/:id', requireRole('super_admin', 'dept_head', 'staff'), ticketController.delete);

export default router;