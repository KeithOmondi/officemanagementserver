import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ─── User Routes ─────────────────────────────────────────────────────────────
router.get('/', notificationsController.getMyNotifications);
router.get('/unread', notificationsController.getUnreadCount);
router.get('/stats', notificationsController.getStats);

// ─── Read Status ─────────────────────────────────────────────────────────────
router.put('/:id/read', notificationsController.markAsRead);
router.put('/read/all', notificationsController.markAllAsRead);

// ─── Delete ──────────────────────────────────────────────────────────────────
router.delete('/:id', notificationsController.deleteNotification);

// ─── Preferences ─────────────────────────────────────────────────────────────
router.get('/preferences', notificationsController.getPreferences);
router.put('/preferences', notificationsController.updatePreferences);

// ─── Admin Routes ────────────────────────────────────────────────────────────
router.post('/', requireRole('dept_head', 'super_admin'), notificationsController.createNotification);
router.delete('/cleanup', requireRole('super_admin'), notificationsController.cleanupOldNotifications);

export default router;