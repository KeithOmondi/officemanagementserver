import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { NoticesService } from './notices.service';
import {
    createBroadcastSchema,
    updateBroadcastSchema,
    createNoticeSchema,
    updateNoticeSchema,
    noticesFiltersSchema,
    idSchema,
} from './notices.validator';

export const noticesController = {

    // ─── Stats & Audit ──────────────────────────────────────────────────────

    getStats: asyncHandler(async (req: Request, res: Response) => {
        const stats = await NoticesService.getStats(req.user!.id);
        return sendSuccess(res, stats, 'Notices statistics retrieved');
    }),

    getAuditLog: asyncHandler(async (req: Request, res: Response) => {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const logs = await NoticesService.getAuditLog(limit);
        return sendSuccess(res, logs, 'Audit log retrieved');
    }),

    getUnreadCount: asyncHandler(async (req: Request, res: Response) => {
        const unread = await NoticesService.getUnreadCount(req.user!.id);
        return sendSuccess(res, unread, 'Unread count retrieved');
    }),

    // ─── Broadcasts ──────────────────────────────────────────────────────────

    getAllBroadcasts: asyncHandler(async (req: Request, res: Response) => {
        const result = noticesFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const broadcasts = await NoticesService.findAllBroadcasts(result.data.query);
        return sendSuccess(res, broadcasts, 'Broadcasts retrieved');
    }),

    getBroadcastById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const broadcast = await NoticesService.findBroadcastWithReads(
            result.data.params.id,
            req.user!.id
        );
        if (!broadcast) {
            throw new AppError(404, 'Broadcast not found');
        }
        return sendSuccess(res, broadcast, 'Broadcast retrieved');
    }),

    createBroadcast: asyncHandler(async (req: Request, res: Response) => {
        const result = createBroadcastSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const broadcast = await NoticesService.createBroadcast(
            result.data.body,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, broadcast, 'Broadcast created', 201);
    }),

    updateBroadcast: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateBroadcastSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const broadcast = await NoticesService.updateBroadcast(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        return sendSuccess(res, broadcast, 'Broadcast updated');
    }),

    sendBroadcast: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const broadcast = await NoticesService.updateBroadcast(
            result.data.params.id,
            { is_sent: true }
        );
        return sendSuccess(res, broadcast, 'Broadcast sent');
    }),

    deleteBroadcast: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await NoticesService.deleteBroadcast(result.data.params.id);
        return sendSuccess(res, null, 'Broadcast deleted');
    }),

    // ─── Notices ─────────────────────────────────────────────────────────────

    getAllNotices: asyncHandler(async (req: Request, res: Response) => {
        const result = noticesFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const notices = await NoticesService.findAllNotices(result.data.query);
        return sendSuccess(res, notices, 'Notices retrieved');
    }),

    getNoticeById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const notice = await NoticesService.findNoticeWithReads(
            result.data.params.id,
            req.user!.id
        );
        if (!notice) {
            throw new AppError(404, 'Notice not found');
        }
        return sendSuccess(res, notice, 'Notice retrieved');
    }),

    createNotice: asyncHandler(async (req: Request, res: Response) => {
        const result = createNoticeSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const notice = await NoticesService.createNotice(
            result.data.body,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, notice, 'Notice created', 201);
    }),

    updateNotice: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateNoticeSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const notice = await NoticesService.updateNotice(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        return sendSuccess(res, notice, 'Notice updated');
    }),

    publishNotice: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const notice = await NoticesService.updateNotice(
            result.data.params.id,
            { is_published: true }
        );
        return sendSuccess(res, notice, 'Notice published');
    }),

    deleteNotice: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await NoticesService.deleteNotice(result.data.params.id);
        return sendSuccess(res, null, 'Notice deleted');
    }),

    // ─── Read Receipts ──────────────────────────────────────────────────────

    markBroadcastRead: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await NoticesService.markBroadcastRead(result.data.params.id, req.user!.id);
        return sendSuccess(res, null, 'Broadcast marked as read');
    }),

    markNoticeRead: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await NoticesService.markNoticeRead(result.data.params.id, req.user!.id);
        return sendSuccess(res, null, 'Notice marked as read');
    }),

    getBroadcastReadCount: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const count = await NoticesService.getBroadcastReadCount(result.data.params.id);
        return sendSuccess(res, { count }, 'Read count retrieved');
    }),

    getNoticeReadCount: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const count = await NoticesService.getNoticeReadCount(result.data.params.id);
        return sendSuccess(res, { count }, 'Read count retrieved');
    }),
};