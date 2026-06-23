// src/features/dsa/dsa.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { DsaService } from './dsa.service';
import {
    createActivitySchema,
    updateActivitySchema,
    addStaffEntrySchema,
    updateStaffEntrySchema,
    activityIdSchema,
    entryIdSchema,
} from './dsa.validator';

export const dsaController = {

    // ── Stats ──────────────────────────────────────────────────────────────────
    getStats: asyncHandler(async (_req: Request, res: Response) => {
        const stats = await DsaService.getStats();
        return sendSuccess(res, stats, 'DSA statistics retrieved');
    }),

    // ── Activities ─────────────────────────────────────────────────────────────
    getAllActivities: asyncHandler(async (_req: Request, res: Response) => {
        const activities = await DsaService.findAllActivities();
        return sendSuccess(res, activities, 'Activities retrieved');
    }),

    getActivityById: asyncHandler(async (req: Request, res: Response) => {
        const result = activityIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const activity = await DsaService.findActivityById(result.data.params.id);
        if (!activity) {
            throw new AppError(404, 'Activity not found');
        }
        return sendSuccess(res, activity, 'Activity retrieved');
    }),

    createActivity: asyncHandler(async (req: Request, res: Response) => {
        const result = createActivitySchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const activity = await DsaService.createActivity(result.data.body, req.user!.id);
        return sendSuccess(res, activity, 'Activity created', 201);
    }),

    updateActivity: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = activityIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateActivitySchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const activity = await DsaService.updateActivity(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        return sendSuccess(res, activity, 'Activity updated');
    }),

    deleteActivity: asyncHandler(async (req: Request, res: Response) => {
        const result = activityIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await DsaService.deleteActivity(result.data.params.id);
        return sendSuccess(res, null, 'Activity deleted');
    }),

    // ── Staff entries ──────────────────────────────────────────────────────────
    getEntries: asyncHandler(async (req: Request, res: Response) => {
        const result = activityIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const entries = await DsaService.getEntriesForActivity(result.data.params.id);
        return sendSuccess(res, entries, 'Entries retrieved');
    }),

    addEntry: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = activityIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = addStaffEntrySchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const entry = await DsaService.addStaffEntry(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        return sendSuccess(res, entry, 'Staff added to activity', 201);
    }),

    updateEntry: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = entryIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateStaffEntrySchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const { id, entryId } = paramsResult.data.params;
        const entry = await DsaService.updateStaffEntry(id, entryId, bodyResult.data.body);
        return sendSuccess(res, entry, 'Entry updated');
    }),

    removeEntry: asyncHandler(async (req: Request, res: Response) => {
        const result = entryIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await DsaService.removeStaffEntry(result.data.params.id, result.data.params.entryId);
        return sendSuccess(res, null, 'Staff removed from activity');
    }),

    // ── Equity + Export ────────────────────────────────────────────────────────
    getEquitySuggestions: asyncHandler(async (_req: Request, res: Response) => {
        const suggestions = await DsaService.getEquitySuggestions();
        return sendSuccess(res, suggestions, 'Equity suggestions retrieved');
    }),

    exportCsv: asyncHandler(async (_req: Request, res: Response) => {
        const entries = await DsaService.getAllEntries();

        const headers = 'Activity,Staff Member,Date From,Date To,Nights,Rate (KES),Total (KES)\n';
        const rows = entries.map((e) =>
            `"${e.activity_name}","${e.full_name}","${e.date_from}","${e.date_to}",${e.night_outs},${e.rate_per_night},${e.total_kes}`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="dsa-records.csv"');
        res.send(headers + rows);
    }),
};