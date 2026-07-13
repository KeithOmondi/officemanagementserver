import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import {
    generateAndSaveMonthlyReport,
    findAllReports,
    findReportById,
    approveReport,
} from './ai-reports.service';
import { monthlyReportQuerySchema, reportFiltersSchema, idSchema } from './ai-reports.validator';

export const aiReportsController = {

    generateMonthly: asyncHandler(async (req: Request, res: Response) => {
        const result = monthlyReportQuerySchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid month/year');
        }
        const { month, year } = result.data.query;
        const report = await generateAndSaveMonthlyReport(month, year, req.user!.id);
        return sendSuccess(res, report, 'Monthly report generated', 201);
    }),

    getAllReports: asyncHandler(async (req: Request, res: Response) => {
        const result = reportFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const reports = await findAllReports(result.data.query);
        return sendSuccess(res, reports, 'Reports retrieved');
    }),

    getReportById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const report = await findReportById(result.data.params.id);
        if (!report) {
            throw new AppError(404, 'Report not found');
        }
        return sendSuccess(res, report, 'Report retrieved');
    }),

    approveReport: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const report = await approveReport(result.data.params.id, req.user!.id);
        return sendSuccess(res, report, 'Report approved');
    }),
};