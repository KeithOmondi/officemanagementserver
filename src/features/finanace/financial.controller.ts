import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { FinancialService } from './financial.service';
import {
    createVoteLineSchema,
    updateVoteLineSchema,
    createFinancialActivitySchema,
    updateFinancialActivitySchema,
    createProBonoSchema,
    updateProBonoSchema,
    createBudgetReportSchema,
    activityFiltersSchema,
    proBonoFiltersSchema,
    voteLineIdSchema,
    activityIdSchema,
    proBonoIdSchema,
    reportIdSchema,
} from './financial.validator';
import { CreateFinancialActivityInput } from './financial.types';

export const financialController = {

    // ── Stats ──────────────────────────────────────────────────────────────────
    getStats: asyncHandler(async (_req: Request, res: Response) => {
        const stats = await FinancialService.getStats();
        return sendSuccess(res, stats, 'Financial statistics retrieved');
    }),

    // ── Vote Lines ─────────────────────────────────────────────────────────────
    getAllVoteLines: asyncHandler(async (_req: Request, res: Response) => {
        const voteLines = await FinancialService.findAllVoteLines();
        return sendSuccess(res, voteLines, 'Vote lines retrieved');
    }),

    getVoteLineById: asyncHandler(async (req: Request, res: Response) => {
        const result = voteLineIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const voteLine = await FinancialService.findVoteLineById(result.data.params.id);
        if (!voteLine) {
            throw new AppError(404, 'Vote line not found');
        }
        return sendSuccess(res, voteLine, 'Vote line retrieved');
    }),

    createVoteLine: asyncHandler(async (req: Request, res: Response) => {
        const result = createVoteLineSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const voteLine = await FinancialService.createVoteLine(result.data.body);
        return sendSuccess(res, voteLine, 'Vote line created', 201);
    }),

    updateVoteLine: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = voteLineIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateVoteLineSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const voteLine = await FinancialService.updateVoteLine(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        return sendSuccess(res, voteLine, 'Vote line updated');
    }),

    deleteVoteLine: asyncHandler(async (req: Request, res: Response) => {
        const result = voteLineIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await FinancialService.deleteVoteLine(result.data.params.id);
        return sendSuccess(res, null, 'Vote line deleted');
    }),

    // ── Financial Activities ──────────────────────────────────────────────────
    getAllActivities: asyncHandler(async (req: Request, res: Response) => {
        const result = activityFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const activities = await FinancialService.findAllActivities(result.data.query);
        return sendSuccess(res, activities, 'Activities retrieved');
    }),

    getActivityById: asyncHandler(async (req: Request, res: Response) => {
        const result = activityIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const activity = await FinancialService.findActivityById(result.data.params.id);
        if (!activity) {
            throw new AppError(404, 'Financial activity not found');
        }
        return sendSuccess(res, activity, 'Activity retrieved');
    }),

    createActivity: asyncHandler(async (req: Request, res: Response) => {
    const result = createFinancialActivitySchema.safeParse({ body: req.body });
    if (!result.success) {
        throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
    }
    
    // Type assertion to handle the null/undefined mismatch
    const activityData = result.data.body as CreateFinancialActivityInput;
    const activity = await FinancialService.createActivity(
        activityData,
        req.user!.id
    );
    return sendSuccess(res, activity, 'Activity created', 201);
}),

    updateActivity: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = activityIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateFinancialActivitySchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const activity = await FinancialService.updateActivity(
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
        await FinancialService.deleteActivity(result.data.params.id);
        return sendSuccess(res, null, 'Activity deleted');
    }),

    // ── Pro Bono Requests ─────────────────────────────────────────────────────
    getAllProBono: asyncHandler(async (req: Request, res: Response) => {
        const result = proBonoFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const requests = await FinancialService.findAllProBono(result.data.query);
        return sendSuccess(res, requests, 'Pro bono requests retrieved');
    }),

    getProBonoById: asyncHandler(async (req: Request, res: Response) => {
        const result = proBonoIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const request = await FinancialService.findProBonoById(result.data.params.id);
        if (!request) {
            throw new AppError(404, 'Pro bono request not found');
        }
        return sendSuccess(res, request, 'Pro bono request retrieved');
    }),

    createProBono: asyncHandler(async (req: Request, res: Response) => {
        const result = createProBonoSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const request = await FinancialService.createProBono(
            result.data.body,
            req.user!.id
        );
        return sendSuccess(res, request, 'Pro bono request created', 201);
    }),

    updateProBono: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = proBonoIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateProBonoSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const request = await FinancialService.updateProBono(
            paramsResult.data.params.id,
            bodyResult.data.body,
            req.user!.id
        );
        return sendSuccess(res, request, 'Pro bono request updated');
    }),

    deleteProBono: asyncHandler(async (req: Request, res: Response) => {
        const result = proBonoIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await FinancialService.deleteProBono(result.data.params.id);
        return sendSuccess(res, null, 'Pro bono request deleted');
    }),

    // ── Audit Log ──────────────────────────────────────────────────────────────
    // ─── Audit Log ──────────────────────────────────────────────────────────────
getAuditLog: asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const logs = await FinancialService.getAuditLog(limit);
    return sendSuccess(res, logs, 'Audit log retrieved');
}),

    // ── Budget Reports ─────────────────────────────────────────────────────────
    getAllBudgetReports: asyncHandler(async (_req: Request, res: Response) => {
        const reports = await FinancialService.getAllBudgetReports();
        return sendSuccess(res, reports, 'Budget reports retrieved');
    }),

    createBudgetReport: asyncHandler(async (req: Request, res: Response) => {
        const result = createBudgetReportSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const report = await FinancialService.createBudgetReport(
            result.data.body,
            req.user!.id
        );
        return sendSuccess(res, report, 'Budget report created', 201);
    }),

    submitBudgetReport: asyncHandler(async (req: Request, res: Response) => {
        const result = reportIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const report = await FinancialService.submitBudgetReport(
            result.data.params.id,
            req.user!.id
        );
        return sendSuccess(res, report, 'Budget report submitted');
    }),

    approveBudgetReport: asyncHandler(async (req: Request, res: Response) => {
        const result = reportIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const report = await FinancialService.approveBudgetReport(
            result.data.params.id,
            req.user!.id
        );
        return sendSuccess(res, report, 'Budget report approved');
    }),
};