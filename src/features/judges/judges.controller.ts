// src/features/judges/judges.controller.ts

import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { JudgesService } from './judges.service';
import {
  createJudgeSchema,
  updateJudgeSchema,
  judgeFiltersSchema,
  judgeIdSchema,
  judgePJNumberSchema,
} from './judges.validator';

export const judgesController = {
  // ── Get all judges (paginated) ──────────────────────────────────────────
  getAll: asyncHandler(async (req: Request, res: Response) => {
    const result = judgeFiltersSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    }

    const judges = await JudgesService.findAll(result.data.query);
    return sendSuccess(res, judges, 'Judges retrieved successfully');
  }),

  // ── Get judge by ID ─────────────────────────────────────────────────────
  getById: asyncHandler(async (req: Request, res: Response) => {
    const result = judgeIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid judge ID');
    }

    const judge = await JudgesService.findById(result.data.params.id);
    return sendSuccess(res, judge, 'Judge retrieved successfully');
  }),

  // ── Get judge by PJ Number ──────────────────────────────────────────────
  getByPJNumber: asyncHandler(async (req: Request, res: Response) => {
    const result = judgePJNumberSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid PJ number');
    }

    const judge = await JudgesService.findByPJNumber(result.data.params.pj_number);
    if (!judge) {
      throw new AppError(404, 'Judge not found');
    }
    return sendSuccess(res, judge, 'Judge retrieved successfully');
  }),

  // ── Search judges by name ──────────────────────────────────────────────
  search: asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      throw new AppError(400, 'Search term is required');
    }

    const judges = await JudgesService.searchByName(q.trim());
    return sendSuccess(res, judges, 'Search results retrieved');
  }),

  // ── Get judge stats ─────────────────────────────────────────────────────
  getStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await JudgesService.getStats();
    return sendSuccess(res, stats, 'Judge stats retrieved successfully');
  }),

  // ── Create judge ────────────────────────────────────────────────────────
  create: asyncHandler(async (req: Request, res: Response) => {
    const result = createJudgeSchema.safeParse({ body: req.body });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid judge data');
    }

    const judge = await JudgesService.create(result.data.body);
    return sendSuccess(res, judge, 'Judge created successfully', 201);
  }),

  // ── Update judge ────────────────────────────────────────────────────────
  update: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = judgeIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid judge ID');
    }

    const bodyResult = updateJudgeSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid update data');
    }

    const judge = await JudgesService.update(
      paramsResult.data.params.id,
      bodyResult.data.body
    );
    return sendSuccess(res, judge, 'Judge updated successfully');
  }),

  // ── Delete judge ────────────────────────────────────────────────────────
  delete: asyncHandler(async (req: Request, res: Response) => {
    const result = judgeIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid judge ID');
    }

    await JudgesService.delete(result.data.params.id);
    return sendSuccess(res, null, 'Judge deleted successfully');
  }),
};