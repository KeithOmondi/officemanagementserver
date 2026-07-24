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
  createSentryRequestSchema,
  updateSentryRequestSchema,
  getSentryRequestSchema,
  listSentryRequestsSchema,
  deleteSentryRequestSchema,
  getSentryStatsSchema,
} from './aide.validator';
import type {
  AideRequestFilters,
  SentryRequestFilters,
} from './aides.types';
import { ZodSchema, ZodError } from 'zod';

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Validate request with schema and return parsed data
 * Throws AppError if validation fails
 */
const validateRequest = <T>(
  schema: ZodSchema<T>,
  data: unknown,
  errorMessage = 'Invalid request data'
): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error('❌ Validation errors:', result.error.issues);
    result.error.issues.forEach((issue: ZodError['issues'][0], index: number) => {
      console.error(`  Error ${index + 1}:`, {
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      });
    });
    throw new AppError(400, result.error.issues[0]?.message ?? errorMessage);
  }
  console.log('✅ Validation passed');
  return result.data;
};

/**
 * Extract and normalize date range from query params
 */
const extractDateRange = (query: { start_date?: any; end_date?: any }) => {
  const { start_date, end_date } = query;
  
  const startDate = start_date instanceof Date 
    ? start_date.toISOString() 
    : start_date || undefined;
  const endDate = end_date instanceof Date 
    ? end_date.toISOString() 
    : end_date || undefined;

  return { startDate, endDate };
};

/**
 * Log request body with user context
 */
const logRequest = (label: string, body: any, user?: { id: string; full_name: string }) => {
  console.log(`📥 ${label}:`, JSON.stringify(body, null, 2));
  console.log('📥 User:', user?.id, user?.full_name);
};

/**
 * Log field validation details
 */
const logFieldValidation = (body: Record<string, any>, fields: string[]) => {
  console.log('🔍 Field validation:');
  fields.forEach((field: string) => {
    console.log(`  ${field}:`, body[field], typeof body[field]);
  });
};

// ─── Controller ─────────────────────────────────────────────────────────────

export const aideController = {
  // ─── Aide Controllers ──────────────────────────────────────────────────────

  /**
   * Create Aide Request
   */
  createAideRequest: asyncHandler(async (req: Request, res: Response) => {
    logRequest('Create aide request body', req.body, req.user);
    
    const aideFields = ['judge_name', 'officer_rank', 'officer_name', 'employment_number', 
                         'current_station', 'current_unit', 'proposed_assignment', 
                         'reporting_date', 'remarks'];
    logFieldValidation(req.body, aideFields);

    const validated = validateRequest<{ body: any }>(
      createAideRequestSchema,
      { body: req.body },
      'Invalid aide request data'
    );

    const aideRequest = await AideService.createAideRequest(
      validated.body,
      req.user!.id,
      req.user!.full_name
    );

    return sendSuccess(res, aideRequest, 'Aide request created successfully', 201);
  }),

  /**
   * Get All Aide Requests
   */
  getAideRequests: asyncHandler(async (req: Request, res: Response) => {
    const validated = validateRequest<{ query: any }>(
      listAideRequestsSchema,
      { query: req.query },
      'Invalid query parameters'
    );

    const filters = validated.query as AideRequestFilters;
    const response = await AideService.getAideRequests(filters);

    return sendSuccess(res, response, 'Aide requests retrieved successfully');
  }),

  /**
   * Get Aide Request by ID
   */
  getAideRequestById: asyncHandler(async (req: Request, res: Response) => {
    const validated = validateRequest<{ params: any }>(
      getAideRequestSchema,
      { params: req.params },
      'Invalid ID'
    );

    const aideRequest = await AideService.findAideByIdOrThrow(validated.params.id);

    return sendSuccess(res, aideRequest, 'Aide request retrieved successfully');
  }),

  /**
   * Update Aide Request
   */
  updateAideRequest: asyncHandler(async (req: Request, res: Response) => {
    logRequest('Update aide request body', req.body, req.user);

    const paramsValidated = validateRequest<{ params: any }>(
      getAideRequestSchema,
      { params: req.params },
      'Invalid ID'
    );

    const bodyValidated = validateRequest<{ body: any }>(
      updateAideRequestSchema,
      { body: req.body },
      'Invalid update data'
    );

    const updated = await AideService.updateAideRequest(
      paramsValidated.params.id,
      bodyValidated.body
    );

    return sendSuccess(res, updated, 'Aide request updated successfully');
  }),

  /**
   * Delete Aide Request
   */
  deleteAideRequest: asyncHandler(async (req: Request, res: Response) => {
    const validated = validateRequest<{ params: any }>(
      deleteAideRequestSchema,
      { params: req.params },
      'Invalid ID'
    );

    await AideService.deleteAideRequest(validated.params.id);

    return sendSuccess(res, null, 'Aide request deleted successfully');
  }),

  /**
   * Get Aide Request Stats
   */
  getAideStats: asyncHandler(async (req: Request, res: Response) => {
    const validated = validateRequest<{ query: any }>(
      getAideStatsSchema,
      { query: req.query },
      'Invalid query parameters'
    );

    const { startDate, endDate } = extractDateRange(validated.query);
    const stats = await AideService.getAideStats(startDate, endDate);

    return sendSuccess(res, stats, 'Aide request statistics retrieved successfully');
  }),

  // ─── Sentry Controllers ────────────────────────────────────────────────────

  /**
   * Create Sentry Request
   */
  createSentryRequest: asyncHandler(async (req: Request, res: Response) => {
    logRequest('Create sentry request body', req.body, req.user);

    const validated = validateRequest<{ body: any }>(
      createSentryRequestSchema,
      { body: req.body },
      'Invalid sentry request data'
    );

    const sentryRequest = await AideService.createSentryRequest(
      validated.body,
      req.user!.id,
      req.user!.full_name
    );

    return sendSuccess(res, sentryRequest, 'Sentry request created successfully', 201);
  }),

  /**
   * Get All Sentry Requests
   */
  getSentryRequests: asyncHandler(async (req: Request, res: Response) => {
    const validated = validateRequest<{ query: any }>(
      listSentryRequestsSchema,
      { query: req.query },
      'Invalid query parameters'
    );

    const filters = validated.query as SentryRequestFilters;
    const response = await AideService.getSentryRequests(filters);

    return sendSuccess(res, response, 'Sentry requests retrieved successfully');
  }),

  /**
   * Get Sentry Request by ID
   */
  getSentryRequestById: asyncHandler(async (req: Request, res: Response) => {
    const validated = validateRequest<{ params: any }>(
      getSentryRequestSchema,
      { params: req.params },
      'Invalid ID'
    );

    const sentryRequest = await AideService.findSentryByIdOrThrow(validated.params.id);

    return sendSuccess(res, sentryRequest, 'Sentry request retrieved successfully');
  }),

  /**
   * Update Sentry Request
   */
  updateSentryRequest: asyncHandler(async (req: Request, res: Response) => {
    logRequest('Update sentry request body', req.body, req.user);

    const paramsValidated = validateRequest<{ params: any }>(
      getSentryRequestSchema,
      { params: req.params },
      'Invalid ID'
    );

    const bodyValidated = validateRequest<{ body: any }>(
      updateSentryRequestSchema,
      { body: req.body },
      'Invalid update data'
    );

    const updated = await AideService.updateSentryRequest(
      paramsValidated.params.id,
      bodyValidated.body
    );

    return sendSuccess(res, updated, 'Sentry request updated successfully');
  }),

  /**
   * Delete Sentry Request
   */
  deleteSentryRequest: asyncHandler(async (req: Request, res: Response) => {
    const validated = validateRequest<{ params: any }>(
      deleteSentryRequestSchema,
      { params: req.params },
      'Invalid ID'
    );

    await AideService.deleteSentryRequest(validated.params.id);

    return sendSuccess(res, null, 'Sentry request deleted successfully');
  }),

  /**
   * Get Sentry Request Stats
   */
  getSentryStats: asyncHandler(async (req: Request, res: Response) => {
    const validated = validateRequest<{ query: any }>(
      getSentryStatsSchema,
      { query: req.query },
      'Invalid query parameters'
    );

    const { startDate, endDate } = extractDateRange(validated.query);
    const stats = await AideService.getSentryStats(startDate, endDate);

    return sendSuccess(res, stats, 'Sentry request statistics retrieved successfully');
  }),
};