// src/features/conference/conference.controller.ts

import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { ConferenceService } from './conference.service';
import {
  createConferenceRequestSchema,
  updateConferenceRequestSchema,
  getConferenceRequestSchema,
  listConferenceRequestsSchema,
  deleteConferenceRequestSchema,
  getConferenceStatsSchema,
  approveConferenceRequestSchema,
  returnConferenceRequestSchema,
  completeConferenceSchema,
  cancelConferenceSchema,
  submitConferenceRequestSchema, // ← ADD THIS
} from './conference.validator';
import type {
  ConferenceRequestFilters,
} from './conference.types';
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

export const conferenceController = {
  /**
   * Create Conference Request
   */
  createConferenceRequest: asyncHandler(async (req: Request, res: Response) => {
    logRequest('Create conference request body', req.body, req.user);
    
    const conferenceFields = ['particulars', 'start_date', 'end_date', 'number_of_pax'];
    logFieldValidation(req.body, conferenceFields);

    const validated = validateRequest<{ body: any }>(
      createConferenceRequestSchema,
      { body: req.body },
      'Invalid conference request data'
    );

    const conferenceRequest = await ConferenceService.createConferenceRequest(
      validated.body,
      req.user!.id,
      req.user!.full_name
    );

    return sendSuccess(res, conferenceRequest, 'Conference request created successfully', 201);
  }),

  /**
   * Get All Conference Requests
   */
  getConferenceRequests: asyncHandler(async (req: Request, res: Response) => {
    const validated = validateRequest<{ query: any }>(
      listConferenceRequestsSchema,
      { query: req.query },
      'Invalid query parameters'
    );

    const filters = validated.query as ConferenceRequestFilters;
    const response = await ConferenceService.getConferenceRequests(filters);

    return sendSuccess(res, response, 'Conference requests retrieved successfully');
  }),

  /**
   * Get Conference Request by ID
   */
  getConferenceRequestById: asyncHandler(async (req: Request, res: Response) => {
    const validated = validateRequest<{ params: any }>(
      getConferenceRequestSchema,
      { params: req.params },
      'Invalid ID'
    );

    const conferenceRequest = await ConferenceService.findConferenceByIdOrThrow(validated.params.id);

    return sendSuccess(res, conferenceRequest, 'Conference request retrieved successfully');
  }),

  /**
   * Update Conference Request
   */
  updateConferenceRequest: asyncHandler(async (req: Request, res: Response) => {
    logRequest('Update conference request body', req.body, req.user);

    const validated = validateRequest<{ params: any; body: any }>(
      updateConferenceRequestSchema,
      { params: req.params, body: req.body },
      'Invalid update data'
    );

    const updated = await ConferenceService.updateConferenceRequest(
      validated.params.id,
      validated.body
    );

    return sendSuccess(res, updated, 'Conference request updated successfully');
  }),

  /**
   * Submit Conference Request for Approval
   * Transitions status from 'draft' to 'pending'
   */
  submitConferenceRequest: asyncHandler(async (req: Request, res: Response) => {
    const validated = validateRequest<{ params: any }>(
      submitConferenceRequestSchema, // ← USE THE IMPORTED SCHEMA
      { params: req.params },
      'Invalid ID'
    );

    const updated = await ConferenceService.submitConferenceRequest(validated.params.id);

    return sendSuccess(res, updated, 'Conference request submitted for approval successfully');
  }),

  /**
   * Approve Conference Request (Super Admin only)
   * Transitions status from 'pending' to 'approved'
   */
  approveConferenceRequest: asyncHandler(async (req: Request, res: Response) => {
    logRequest('Approve conference request', req.body, req.user);

    const validated = validateRequest<{ params: any; body: any }>(
      approveConferenceRequestSchema,
      { params: req.params, body: req.body },
      'Invalid approval data'
    );

    const updated = await ConferenceService.approveConferenceRequest(
      validated.params.id,
      validated.body.comments
    );

    return sendSuccess(res, updated, 'Conference request approved successfully');
  }),

  /**
   * Return Conference Request to Requester (Super Admin only)
   * Transitions status from 'pending' to 'rejected'
   */
  returnConferenceRequest: asyncHandler(async (req: Request, res: Response) => {
    logRequest('Return conference request', req.body, req.user);

    const validated = validateRequest<{ params: any; body: any }>(
      returnConferenceRequestSchema,
      { params: req.params, body: req.body },
      'Invalid return data'
    );

    const updated = await ConferenceService.returnConferenceRequest(
      validated.params.id,
      validated.body.reason
    );

    return sendSuccess(res, updated, 'Conference request returned successfully');
  }),

  /**
   * Complete Conference Request
   * Transitions status from 'approved' to 'completed'
   */
  completeConferenceRequest: asyncHandler(async (req: Request, res: Response) => {
    logRequest('Complete conference request', req.body, req.user);

    const validated = validateRequest<{ params: any; body: any }>(
      completeConferenceSchema,
      { params: req.params, body: req.body },
      'Invalid completion data'
    );

    const updated = await ConferenceService.completeConference(
      validated.params.id,
      validated.body.feedback
    );

    return sendSuccess(res, updated, 'Conference marked as completed successfully');
  }),

  /**
   * Cancel Conference Request
   * Transitions status to 'cancelled'
   */
  cancelConferenceRequest: asyncHandler(async (req: Request, res: Response) => {
    logRequest('Cancel conference request', req.body, req.user);

    const validated = validateRequest<{ params: any; body: any }>(
      cancelConferenceSchema,
      { params: req.params, body: req.body },
      'Invalid cancellation data'
    );

    const updated = await ConferenceService.cancelConference(
      validated.params.id,
      validated.body.reason
    );

    return sendSuccess(res, updated, 'Conference cancelled successfully');
  }),

  /**
   * Delete Conference Request
   */
  deleteConferenceRequest: asyncHandler(async (req: Request, res: Response) => {
    const validated = validateRequest<{ params: any }>(
      deleteConferenceRequestSchema,
      { params: req.params },
      'Invalid ID'
    );

    await ConferenceService.deleteConferenceRequest(validated.params.id);

    return sendSuccess(res, null, 'Conference request deleted successfully');
  }),

  /**
   * Get Conference Request Stats
   */
  getConferenceStats: asyncHandler(async (req: Request, res: Response) => {
    const validated = validateRequest<{ query: any }>(
      getConferenceStatsSchema,
      { query: req.query },
      'Invalid query parameters'
    );

    const { startDate, endDate } = extractDateRange(validated.query);
    const stats = await ConferenceService.getConferenceStats(startDate, endDate);

    return sendSuccess(res, stats, 'Conference request statistics retrieved successfully');
  }),
};