import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { NotificationsService } from './notifications.service';
import {
    createNotificationSchema,
    updateNotificationSchema,
    updatePreferencesSchema,
    notificationFiltersSchema,
    notificationIdSchema,
    userIdSchema,
} from './notifications.validator';

export const notificationsController = {

    // ─── Get User Notifications ──────────────────────────────────────────────

    getMyNotifications: asyncHandler(async (req: Request, res: Response) => {
        const result = notificationFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const { notifications, total } = await NotificationsService.getUserNotifications(
            req.user!.id,
            result.data.query
        );
        return sendSuccess(res, { notifications, total }, 'Notifications retrieved');
    }),

    // ─── Get Unread Count ─────────────────────────────────────────────────────

    getUnreadCount: asyncHandler(async (req: Request, res: Response) => {
        const count = await NotificationsService.getUnreadCount(req.user!.id);
        return sendSuccess(res, { count }, 'Unread count retrieved');
    }),

    // ─── Get Stats ────────────────────────────────────────────────────────────

    getStats: asyncHandler(async (req: Request, res: Response) => {
        const stats = await NotificationsService.getStats(req.user!.id);
        return sendSuccess(res, stats, 'Notification stats retrieved');
    }),

    // ─── Mark as Read ─────────────────────────────────────────────────────────

    markAsRead: asyncHandler(async (req: Request, res: Response) => {
        const result = notificationIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const notification = await NotificationsService.markAsRead(
            result.data.params.id,
            req.user!.id,
            req.app.get('io')
        );
        return sendSuccess(res, notification, 'Notification marked as read');
    }),

    // ─── Mark All as Read ─────────────────────────────────────────────────────

    markAllAsRead: asyncHandler(async (req: Request, res: Response) => {
        await NotificationsService.markAllAsRead(req.user!.id, req.app.get('io'));
        return sendSuccess(res, null, 'All notifications marked as read');
    }),

    // ─── Delete Notification ──────────────────────────────────────────────────

    deleteNotification: asyncHandler(async (req: Request, res: Response) => {
        const result = notificationIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await NotificationsService.deleteNotification(
            result.data.params.id,
            req.user!.id
        );
        return sendSuccess(res, null, 'Notification deleted');
    }),

    // ─── Get Preferences ──────────────────────────────────────────────────────

    getPreferences: asyncHandler(async (req: Request, res: Response) => {
        const preferences = await NotificationsService.getPreferences(req.user!.id);
        return sendSuccess(res, preferences, 'Preferences retrieved');
    }),

    // ─── Update Preferences ──────────────────────────────────────────────────

    updatePreferences: asyncHandler(async (req: Request, res: Response) => {
        const result = updatePreferencesSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const preferences = await NotificationsService.updatePreferences(
            req.user!.id,
            result.data.body
        );
        return sendSuccess(res, preferences, 'Preferences updated');
    }),

    // ─── Admin: Create Notification ──────────────────────────────────────────

    createNotification: asyncHandler(async (req: Request, res: Response) => {
        const result = createNotificationSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const notification = await NotificationsService.createNotification(
            result.data.body,
            req.app.get('io')
        );
        return sendSuccess(res, notification, 'Notification created', 201);
    }),

    // ─── Admin: Cleanup Old Notifications ────────────────────────────────────

    cleanupOldNotifications: asyncHandler(async (req: Request, res: Response) => {
        const days = req.query.days ? parseInt(req.query.days as string) : 90;
        const count = await NotificationsService.cleanupOldNotifications(days);
        return sendSuccess(res, { deleted: count }, `Cleaned up ${count} old notifications`);
    }),
};