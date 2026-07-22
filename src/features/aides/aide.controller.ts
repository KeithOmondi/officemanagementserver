// src/features/aide/aide.controller.ts

import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { AideService } from './aide.service';
import {
  createAideRequestSchema,
  updateAideRequestSchema,
  getAideRequestSchema,
  listAideRequestsSchema,
  deleteAideRequestSchema,
  getAideStatsSchema,
} from './aide.validator';
import type {
  AideRequestFilters,
} from './aides.types';

export const aideController = {
  // ─── Create Aide Request ────────────────────────────────────────────────────

  createAideRequest: asyncHandler(async (req: Request, res: Response) => {
    console.log('📥 Request body:', JSON.stringify(req.body, null, 2));
    console.log('📥 User:', req.user?.id, req.user?.full_name);

    // Check each field individually
    console.log('🔍 Field validation:');
    console.log('  judge_name:', req.body.judge_name, typeof req.body.judge_name);
    console.log('  officer_rank:', req.body.officer_rank, typeof req.body.officer_rank);
    console.log('  officer_name:', req.body.officer_name, typeof req.body.officer_name);
    console.log('  employment_number:', req.body.employment_number, typeof req.body.employment_number);
    console.log('  current_station:', req.body.current_station, typeof req.body.current_station);
    console.log('  current_unit:', req.body.current_unit, typeof req.body.current_unit);
    console.log('  proposed_assignment:', req.body.proposed_assignment, typeof req.body.proposed_assignment);
    console.log('  reporting_date:', req.body.reporting_date, typeof req.body.reporting_date);
    console.log('  remarks:', req.body.remarks, typeof req.body.remarks);

    const result = createAideRequestSchema.safeParse({ body: req.body });
    if (!result.success) {
      console.error('❌ Validation errors:', result.error.issues);
      // Log each error in detail
      result.error.issues.forEach((issue, index) => {
        console.error(`  Error ${index + 1}:`, {
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        });
      });
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid aide request data');
    }

    console.log('✅ Validation passed');

    const aideRequest = await AideService.createAideRequest(
      result.data.body,
      req.user!.id,
      req.user!.full_name
    );

    return sendSuccess(res, aideRequest, 'Aide request created successfully', 201);
  }),

  // ─── Get All Aide Requests ──────────────────────────────────────────────────

  getAideRequests: asyncHandler(async (req: Request, res: Response) => {
    const result = listAideRequestsSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid query parameters');
    }

    const filters = result.data.query as AideRequestFilters;
    const response = await AideService.getAideRequests(filters);

    return sendSuccess(res, response, 'Aide requests retrieved successfully');
  }),

  // ─── Get Aide Request by ID ─────────────────────────────────────────────────

  getAideRequestById: asyncHandler(async (req: Request, res: Response) => {
    const result = getAideRequestSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    const aideRequest = await AideService.findByIdOrThrow(result.data.params.id);

    return sendSuccess(res, aideRequest, 'Aide request retrieved successfully');
  }),

  // ─── Update Aide Request ────────────────────────────────────────────────────

  updateAideRequest: asyncHandler(async (req: Request, res: Response) => {
    console.log('📥 Update request body:', JSON.stringify(req.body, null, 2));
    
    const paramsResult = getAideRequestSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }

    const bodyResult = updateAideRequestSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      console.error('❌ Validation errors:', bodyResult.error.issues);
      bodyResult.error.issues.forEach((issue, index) => {
        console.error(`  Error ${index + 1}:`, {
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        });
      });
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid update data');
    }

    const updated = await AideService.updateAideRequest(
      paramsResult.data.params.id,
      bodyResult.data.body
    );

    return sendSuccess(res, updated, 'Aide request updated successfully');
  }),

  // ─── Delete Aide Request ────────────────────────────────────────────────────

  deleteAideRequest: asyncHandler(async (req: Request, res: Response) => {
    const result = deleteAideRequestSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    await AideService.deleteAideRequest(result.data.params.id);

    return sendSuccess(res, null, 'Aide request deleted successfully');
  }),

  // ─── Get Aide Request Stats ─────────────────────────────────────────────────

  getAideStats: asyncHandler(async (req: Request, res: Response) => {
    const result = getAideStatsSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid query parameters');
    }

    // Extract and normalize dates
    const { start_date, end_date } = result.data.query;
    
    // Convert Date objects to ISO strings if needed
    const startDate = start_date instanceof Date ? start_date.toISOString() : start_date;
    const endDate = end_date instanceof Date ? end_date.toISOString() : end_date;

    const stats = await AideService.getAideStats(startDate, endDate);

    return sendSuccess(res, stats, 'Aide request statistics retrieved successfully');
  }),
};