import { Router } from 'express';
import { noticesController } from './notices.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ─── Stats & Audit ──────────────────────────────────────────────────────────
router.get('/stats', noticesController.getStats);
router.get('/audit', noticesController.getAuditLog);
router.get('/unread', noticesController.getUnreadCount);

// ─── Broadcasts ──────────────────────────────────────────────────────────────
router.get('/broadcasts', noticesController.getAllBroadcasts);
router.get('/broadcasts/:id', noticesController.getBroadcastById);
router.post('/broadcasts', requireRole(['dept_head', 'super_admin']), noticesController.createBroadcast);
router.put('/broadcasts/:id', requireRole(['dept_head', 'super_admin']), noticesController.updateBroadcast);
router.put('/broadcasts/:id/send', requireRole(['dept_head', 'super_admin']), noticesController.sendBroadcast);
router.delete('/broadcasts/:id', requireRole(['super_admin']), noticesController.deleteBroadcast);

// ─── Broadcast Read Receipts ──────────────────────────────────────────────────
router.put('/broadcasts/:id/read', noticesController.markBroadcastRead);
router.get('/broadcasts/:id/read-count', noticesController.getBroadcastReadCount);

// ─── Notices ──────────────────────────────────────────────────────────────────
router.get('/notices', noticesController.getAllNotices);
router.get('/notices/:id', noticesController.getNoticeById);
router.post('/notices', requireRole(['dept_head', 'super_admin']), noticesController.createNotice);
router.put('/notices/:id', requireRole(['dept_head', 'super_admin']), noticesController.updateNotice);
router.put('/notices/:id/publish', requireRole(['dept_head', 'super_admin']), noticesController.publishNotice);
router.delete('/notices/:id', requireRole(['super_admin']), noticesController.deleteNotice);

// ─── Notice Read Receipts ─────────────────────────────────────────────────────
router.put('/notices/:id/read', noticesController.markNoticeRead);
router.get('/notices/:id/read-count', noticesController.getNoticeReadCount);

export default router;