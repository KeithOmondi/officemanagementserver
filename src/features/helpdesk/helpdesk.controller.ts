// ============================================================
// helpdesk.controller.ts
// ============================================================
// All request payloads are validated against Zod schemas.
// The Firearm rule (firearm_type required only if officer_assigned is present)
// is enforced by createGeneralRequestSchema and updateGeneralRequestSchema.
// ============================================================

import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { HelpDeskService } from './helpdesk.service';
import {
    createUtilitySchema,
    addUtilityItemSchema,
    updateUtilityItemSchema,
    utilityFiltersSchema,
    utilityItemIdSchema,
    createClubMembershipSchema,
    createCircuitSchema,
    createSpecialBenchSchema,
    updateBenchSchema,
    createPartHeardSchema,
    updatePartHeardSchema,
    createMedicalClaimSchema,
    createGeneralRequestSchema,
    updateGeneralRequestSchema,
    createVisaRequestSchema,
    createProtocolEventSchema,
    createSecurityRequestSchema,
    updateSecurityRequestSchema,
    helpDeskFiltersSchema,
    idSchema,
    updateCircuitDSASchema,
    createServiceWeekSchema,
    createOtherPaymentSchema,
    updateOtherPaymentDSASchema,
    dsaReportFiltersSchema,
    markDocumentViewedSchema,
    documentViewStatusSchema,
} from './helpdesk.validator';
import type { ReportModule, DSAReportFilters, RequestType, RemarkType, GeneralRequestCategory, UpdateStatusInput } from './helpdesk.types';
import { generateDSAReportExcel } from './helpdesk-report.excel';
import { getRealtimeService } from '../../middleware/realtime.middleware';

// ─── Helper: Safe realtime emit ──────────────────────────────────────────────

const safeRealtimeBroadcast = (req: Request, event: string, data: any) => {
    const realtime = getRealtimeService(req);
    if (realtime) {
        realtime.broadcast(event, data);
    } else {
        console.warn(`⚠️ Realtime service not available, skipping broadcast for event: ${event}`);
    }
};

export const helpDeskController = {

    // ─── Stats & Audit ──────────────────────────────────────────────────────

    getStats: asyncHandler(async (_req: Request, res: Response) => {
        const stats = await HelpDeskService.getStats();
        return sendSuccess(res, stats, 'Help desk statistics retrieved');
    }),

    getAuditLog: asyncHandler(async (req: Request, res: Response) => {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const logs = await HelpDeskService.getAuditLog(limit);
        return sendSuccess(res, logs, 'Audit log retrieved');
    }),

    // ============================================================
    // GENERAL REQUESTS (UNIFIED - includes all security/personnel)
    // ============================================================

    /**
     * GET /api/helpdesk/general
     * Get all general requests with optional filters
     * Supports filtering by: status, judge_name, request_type, remark_type, category
     */
    getAllGeneralRequests: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const requests = await HelpDeskService.findAllGeneralRequests(result.data.query);
        return sendSuccess(res, requests, 'General requests retrieved');
    }),

    /**
     * GET /api/helpdesk/general/:id
     * Get a specific general request by ID
     */
    getGeneralRequestById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const request = await HelpDeskService.findGeneralRequestById(result.data.params.id);
        if (!request) {
            throw new AppError(404, 'General request not found');
        }
        return sendSuccess(res, request, 'General request retrieved');
    }),

    /**
     * GET /api/helpdesk/general/judge/:judgeName
     * Get general requests by judge name
     */
    getGeneralRequestsByJudge: asyncHandler(async (req: Request, res: Response) => {
        const { judgeName } = req.params;
        const judgeNameStr = Array.isArray(judgeName) ? judgeName[0] : judgeName;
        if (!judgeNameStr) {
            throw new AppError(400, 'Judge name is required');
        }
        const requests = await HelpDeskService.findGeneralRequestsByJudge(judgeNameStr);
        return sendSuccess(res, requests, 'General requests retrieved by judge');
    }),

    /**
     * GET /api/helpdesk/general/type/:requestType
     * Get general requests by request type
     */
    getGeneralRequestsByType: asyncHandler(async (req: Request, res: Response) => {
        const { requestType } = req.params;
        const requestTypeStr = Array.isArray(requestType) ? requestType[0] : requestType;
        if (!requestTypeStr) {
            throw new AppError(400, 'Request type is required');
        }
        if (!['Driver', 'Bodyguard', 'Firearm', 'Current Station', 'Force Number', 'Residence Security', 'Sentry'].includes(requestTypeStr)) {
            throw new AppError(400, 'Valid request type is required');
        }
        const requests = await HelpDeskService.findGeneralRequestsByType(requestTypeStr as RequestType);
        return sendSuccess(res, requests, 'General requests retrieved by type');
    }),

    /**
     * GET /api/helpdesk/general/remark/:remarkType
     * Get general requests by remark type (Onboarding/Release)
     */
    getGeneralRequestsByRemarkType: asyncHandler(async (req: Request, res: Response) => {
        const { remarkType } = req.params;
        const remarkTypeStr = Array.isArray(remarkType) ? remarkType[0] : remarkType;
        if (!remarkTypeStr) {
            throw new AppError(400, 'Remark type is required');
        }
        if (!['Onboarding', 'Release'].includes(remarkTypeStr)) {
            throw new AppError(400, 'Valid remark type is required (Onboarding or Release)');
        }
        const requests = await HelpDeskService.findGeneralRequestsByRemarkType(remarkTypeStr as RemarkType);
        return sendSuccess(res, requests, 'General requests retrieved by remark type');
    }),

    /**
     * POST /api/helpdesk/general
     * Create a new general request (supports all 7 types: Driver, Bodyguard, Firearm, 
     * Current Station, Force Number, Residence Security, Sentry)
     * 
     * Firearm rule: firearm_type is optional unless officer_assigned is provided.
     */
    createGeneralRequest: asyncHandler(async (req: Request, res: Response) => {
        const result = createGeneralRequestSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const request = await HelpDeskService.createGeneralRequest(result.data.body, req.user!.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'general_request_created', request);
        
        return sendSuccess(res, request, 'General request created', 201);
    }),

    /**
     * PUT /api/helpdesk/general/:id
     * Update a general request
     * 
     * Firearm rule: if updating to Firearm type and setting officer_assigned, 
     * firearm_type must be provided.
     */
    updateGeneralRequest: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateGeneralRequestSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const request = await HelpDeskService.updateGeneralRequest(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'general_request_updated', request);
        
        return sendSuccess(res, request, 'General request updated');
    }),

    /**
     * PATCH /api/helpdesk/general/:id/status
     * Update general request status
     */
    updateGeneralRequestStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status, notes, email } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        
        const resolvedBy = req.user?.full_name || req.user?.email || 'System Administrator';
        const rejectedBy = req.user?.full_name || req.user?.email || 'System Administrator';
        
        const updateInput: UpdateStatusInput = {
            status,
            notes,
            resolvedBy,
            rejectedBy
        };
        
        if (email) {
            updateInput.email = email;
        }
        
        const request = await HelpDeskService.updateGeneralRequestStatus(
            paramsResult.data.params.id,
            updateInput
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'general_request_status_updated', {
            id: request.id,
            status: request.status,
            updated_at: new Date().toISOString()
        });
        
        return sendSuccess(res, request, 'General request status updated');
    }),

    /**
     * DELETE /api/helpdesk/general/:id
     * Delete a general request (soft delete)
     */
    deleteGeneralRequest: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteGeneralRequest(result.data.params.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'general_request_deleted', { id: result.data.params.id });
        
        return sendSuccess(res, null, 'General request deleted');
    }),

    /**
     * GET /api/helpdesk/general/stats
     * Get general request statistics
     */
    getGeneralRequestStats: asyncHandler(async (_req: Request, res: Response) => {
        const stats = await HelpDeskService.getGeneralRequestStats();
        return sendSuccess(res, stats, 'General request statistics retrieved');
    }),

    /**
     * POST /api/helpdesk/general/:id/email
     * Send email notification for a general request
     */
    sendGeneralRequestEmail: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { email, type } = req.body;
        if (!email) {
            throw new AppError(400, 'Email is required');
        }
        if (!type || !['acknowledgement', 'resolved', 'rejected'].includes(type)) {
            throw new AppError(400, 'Valid email type is required (acknowledgement, resolved, or rejected)');
        }
        
        await HelpDeskService.sendGeneralRequestEmail(
            paramsResult.data.params.id,
            email,
            type as 'acknowledgement' | 'resolved' | 'rejected'
        );
        return sendSuccess(res, null, `Email (${type}) sent successfully`);
    }),

    // ============================================================
    // LEGACY SECURITY REQUESTS (Deprecated - kept for backward compatibility)
    // ============================================================

    /**
     * @deprecated Use getAllGeneralRequests with request_type filter instead
     * GET /api/helpdesk/security
     */
    getAllSecurityRequests: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const requests = await HelpDeskService.findAllSecurityRequests(result.data.query);
        return sendSuccess(res, requests, 'Security requests retrieved');
    }),

    /**
     * @deprecated Use getGeneralRequestById instead
     * GET /api/helpdesk/security/:id
     */
    getSecurityRequestById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const request = await HelpDeskService.findSecurityRequestById(result.data.params.id);
        if (!request) {
            throw new AppError(404, 'Security request not found');
        }
        return sendSuccess(res, request, 'Security request retrieved');
    }),

    /**
     * @deprecated Use getGeneralRequestsByJudge instead
     * GET /api/helpdesk/security/judge/:judgeName
     */
    getSecurityRequestsByJudge: asyncHandler(async (req: Request, res: Response) => {
        const { judgeName } = req.params;
        const judgeNameStr = Array.isArray(judgeName) ? judgeName[0] : judgeName;
        if (!judgeNameStr) {
            throw new AppError(400, 'Judge name is required');
        }
        const requests = await HelpDeskService.findSecurityRequestsByJudge(judgeNameStr);
        return sendSuccess(res, requests, 'Security requests retrieved by judge');
    }),

    /**
     * @deprecated Use getGeneralRequestsByType instead
     * GET /api/helpdesk/security/type/:requestType
     */
    getSecurityRequestsByType: asyncHandler(async (req: Request, res: Response) => {
        const { requestType } = req.params;
        if (!requestType) {
            throw new AppError(400, 'Request type is required');
        }
        const requests = await HelpDeskService.findSecurityRequestsByType(requestType as RequestType);
        return sendSuccess(res, requests, 'Security requests retrieved by type');
    }),

    /**
     * @deprecated Use createGeneralRequest instead
     * POST /api/helpdesk/security
     */
    createSecurityRequest: asyncHandler(async (req: Request, res: Response) => {
        const result = createSecurityRequestSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const request = await HelpDeskService.createSecurityRequest(result.data.body, req.user!.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'security_request_created', request);
        
        return sendSuccess(res, request, 'Security request created', 201);
    }),

    /**
     * @deprecated Use updateGeneralRequest instead
     * PUT /api/helpdesk/security/:id
     */
    updateSecurityRequest: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateSecurityRequestSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const request = await HelpDeskService.updateSecurityRequest(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'security_request_updated', request);
        
        return sendSuccess(res, request, 'Security request updated');
    }),

    /**
     * @deprecated Use updateGeneralRequestStatus instead
     * PATCH /api/helpdesk/security/:id/status
     */
    updateSecurityRequestStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status, notes } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const request = await HelpDeskService.updateSecurityRequestStatus(
            paramsResult.data.params.id,
            { status, notes }
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'security_request_status_updated', {
            id: request.id,
            status: request.status,
            updated_at: new Date().toISOString()
        });
        
        return sendSuccess(res, request, 'Security request status updated');
    }),

    /**
     * @deprecated Use deleteGeneralRequest instead
     * DELETE /api/helpdesk/security/:id
     */
    deleteSecurityRequest: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteSecurityRequest(result.data.params.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'security_request_deleted', { id: result.data.params.id });
        
        return sendSuccess(res, null, 'Security request deleted');
    }),

    /**
     * @deprecated Use getGeneralRequestStats instead
     * GET /api/helpdesk/security/stats
     */
    getSecurityRequestStats: asyncHandler(async (_req: Request, res: Response) => {
        const stats = await HelpDeskService.getSecurityRequestStats();
        return sendSuccess(res, stats, 'Security request statistics retrieved');
    }),

    // ─── Judge Utilities (one judge → many utility items) ───────────────────

    getAllUtilities: asyncHandler(async (req: Request, res: Response) => {
        const result = utilityFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const utilities = await HelpDeskService.findAllUtilities(result.data.query);
        return sendSuccess(res, utilities, 'Judge utilities retrieved');
    }),

    getUtilityById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const utility = await HelpDeskService.findUtilityById(result.data.params.id);
        if (!utility) {
            throw new AppError(404, 'Judge utility record not found');
        }
        return sendSuccess(res, utility, 'Judge utility record retrieved');
    }),

    createUtility: asyncHandler(async (req: Request, res: Response) => {
        const result = createUtilitySchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const utility = await HelpDeskService.createUtility(result.data.body, req.user!.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'utility_created', utility);
        
        return sendSuccess(res, utility, 'Judge utility record created', 201);
    }),

    addUtilityItem: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = addUtilityItemSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const utility = await HelpDeskService.addUtilityItem(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'utility_item_added', utility);
        
        return sendSuccess(res, utility, 'Utility item added', 201);
    }),

    updateUtilityItem: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = utilityItemIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateUtilityItemSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const utility = await HelpDeskService.updateUtilityItem(
            paramsResult.data.params.id,
            paramsResult.data.params.itemId,
            bodyResult.data.body
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'utility_item_updated', utility);
        
        return sendSuccess(res, utility, 'Utility item updated');
    }),

    deleteUtilityItem: asyncHandler(async (req: Request, res: Response) => {
        const result = utilityItemIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteUtilityItem(result.data.params.id, result.data.params.itemId);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'utility_item_deleted', { 
            utilityId: result.data.params.id, 
            itemId: result.data.params.itemId 
        });
        
        return sendSuccess(res, null, 'Utility item deleted');
    }),

    deleteUtility: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteUtility(result.data.params.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'utility_deleted', { id: result.data.params.id });
        
        return sendSuccess(res, null, 'Judge utility record deleted');
    }),

    // ─── Club Membership ─────────────────────────────────────────────────────

    getAllClubMemberships: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const memberships = await HelpDeskService.findAllClubMemberships(result.data.query);
        return sendSuccess(res, memberships, 'Club memberships retrieved');
    }),

    getClubMembershipById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const membership = await HelpDeskService.findClubMembershipById(result.data.params.id);
        if (!membership) {
            throw new AppError(404, 'Club membership not found');
        }
        return sendSuccess(res, membership, 'Club membership retrieved');
    }),

    createClubMembership: asyncHandler(async (req: Request, res: Response) => {
        const result = createClubMembershipSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const membership = await HelpDeskService.createClubMembership(result.data.body, req.user!.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'club_membership_created', membership);
        
        return sendSuccess(res, membership, 'Club membership created', 201);
    }),

    updateClubMembershipStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const membership = await HelpDeskService.updateClubMembershipStatus(
            paramsResult.data.params.id,
            { status }
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'club_membership_updated', membership);
        
        return sendSuccess(res, membership, 'Club membership status updated');
    }),

    deleteClubMembership: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteClubMembership(result.data.params.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'club_membership_deleted', { id: result.data.params.id });
        
        return sendSuccess(res, null, 'Club membership deleted');
    }),

    // ─── Circuits ────────────────────────────────────────────────────────────

    getAllCircuits: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const circuits = await HelpDeskService.findAllCircuits(result.data.query);
        return sendSuccess(res, circuits, 'Circuits retrieved');
    }),

    getCircuitById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const circuit = await HelpDeskService.findCircuitById(result.data.params.id);
        if (!circuit) {
            throw new AppError(404, 'Circuit not found');
        }
        return sendSuccess(res, circuit, 'Circuit retrieved');
    }),

    createCircuit: asyncHandler(async (req: Request, res: Response) => {
        const result = createCircuitSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const circuit = await HelpDeskService.createCircuit(result.data.body, req.user!.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'circuit_created', circuit);
        
        return sendSuccess(res, circuit, 'Circuit created', 201);
    }),

    updateCircuitStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const circuit = await HelpDeskService.updateCircuitStatus(
            paramsResult.data.params.id,
            { status }
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'circuit_updated', circuit);
        
        return sendSuccess(res, circuit, 'Circuit status updated');
    }),

    updateCircuitDSADetails: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const result = updateCircuitDSASchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid DSA details data');
        }
        const circuit = await HelpDeskService.updateCircuitDSADetails(
            paramsResult.data.params.id,
            result.data.body.dsa_details
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'circuit_dsa_updated', circuit);
        
        return sendSuccess(res, circuit, 'Circuit DSA details updated');
    }),

    deleteCircuit: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteCircuit(result.data.params.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'circuit_deleted', { id: result.data.params.id });
        
        return sendSuccess(res, null, 'Circuit deleted');
    }),

    // ─── Special Benches ─────────────────────────────────────────────────────

    getAllBenches: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const benches = await HelpDeskService.findAllBenches(result.data.query);
        return sendSuccess(res, benches, 'Special benches retrieved');
    }),

    getBenchById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bench = await HelpDeskService.findBenchById(result.data.params.id);
        if (!bench) {
            throw new AppError(404, 'Special bench not found');
        }
        return sendSuccess(res, bench, 'Special bench retrieved');
    }),

    createBench: asyncHandler(async (req: Request, res: Response) => {
        const result = createSpecialBenchSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const bench = await HelpDeskService.createSpecialBench(result.data.body, req.user!.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'bench_created', bench);
        
        return sendSuccess(res, bench, 'Special bench created', 201);
    }),

    updateBench: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateBenchSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const bench = await HelpDeskService.updateBench(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'bench_updated', bench);
        
        return sendSuccess(res, bench, 'Special bench updated');
    }),

    updateBenchStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const bench = await HelpDeskService.updateBenchStatus(
            paramsResult.data.params.id,
            { status }
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'bench_status_updated', bench);
        
        return sendSuccess(res, bench, 'Bench status updated');
    }),

    deleteBench: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteBench(result.data.params.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'bench_deleted', { id: result.data.params.id });
        
        return sendSuccess(res, null, 'Special bench deleted');
    }),

    // ─── Part-Heards ─────────────────────────────────────────────────────────

    getAllPartHeards: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const partHeards = await HelpDeskService.findAllPartHeards(result.data.query);
        return sendSuccess(res, partHeards, 'Part-heards retrieved');
    }),

    getPartHeardById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const partHeard = await HelpDeskService.findPartHeardById(result.data.params.id);
        if (!partHeard) {
            throw new AppError(404, 'Part-heard not found');
        }
        return sendSuccess(res, partHeard, 'Part-heard retrieved');
    }),

    createPartHeard: asyncHandler(async (req: Request, res: Response) => {
        const result = createPartHeardSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const partHeard = await HelpDeskService.createPartHeard(result.data.body, req.user!.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'part_heard_created', partHeard);
        
        return sendSuccess(res, partHeard, 'Part-heard created', 201);
    }),

    updatePartHeard: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updatePartHeardSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const partHeard = await HelpDeskService.updatePartHeard(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'part_heard_updated', partHeard);
        
        return sendSuccess(res, partHeard, 'Part-heard updated');
    }),

    updatePartHeardStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const partHeard = await HelpDeskService.updatePartHeardStatus(
            paramsResult.data.params.id,
            { status }
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'part_heard_status_updated', partHeard);
        
        return sendSuccess(res, partHeard, 'Part-heard status updated');
    }),

    deletePartHeard: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deletePartHeard(result.data.params.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'part_heard_deleted', { id: result.data.params.id });
        
        return sendSuccess(res, null, 'Part-heard deleted');
    }),

    // ─── Service Weeks ──────────────────────────────────────────────────────

    getAllServiceWeeks: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const weeks = await HelpDeskService.findAllServiceWeeks(result.data.query);
        return sendSuccess(res, weeks, 'Service weeks retrieved');
    }),

    getServiceWeekById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const week = await HelpDeskService.findServiceWeekById(result.data.params.id);
        if (!week) {
            throw new AppError(404, 'Service week not found');
        }
        return sendSuccess(res, week, 'Service week retrieved');
    }),

    createServiceWeek: asyncHandler(async (req: Request, res: Response) => {
        const result = createServiceWeekSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const week = await HelpDeskService.createServiceWeek(result.data.body, req.user!.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'service_week_created', week);
        
        return sendSuccess(res, week, 'Service week created', 201);
    }),

    updateServiceWeekStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const week = await HelpDeskService.updateServiceWeekStatus(
            paramsResult.data.params.id,
            { status }
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'service_week_updated', week);
        
        return sendSuccess(res, week, 'Service week status updated');
    }),

    deleteServiceWeek: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteServiceWeek(result.data.params.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'service_week_deleted', { id: result.data.params.id });
        
        return sendSuccess(res, null, 'Service week deleted');
    }),

    // ─── Medical Expense Claims ─────────────────────────────────────────────

    getAllMedicalClaims: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const claims = await HelpDeskService.findAllMedicalClaims(result.data.query);
        return sendSuccess(res, claims, 'Medical claims retrieved');
    }),

    getMedicalClaimById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const claim = await HelpDeskService.findMedicalClaimById(result.data.params.id);
        if (!claim) {
            throw new AppError(404, 'Medical claim not found');
        }
        return sendSuccess(res, claim, 'Medical claim retrieved');
    }),

    createMedicalClaim: asyncHandler(async (req: Request, res: Response) => {
        const result = createMedicalClaimSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const claim = await HelpDeskService.createMedicalClaim(result.data.body, req.user!.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'medical_claim_created', claim);
        
        return sendSuccess(res, claim, 'Medical claim created', 201);
    }),

    updateMedicalClaimStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status, remarks } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const claim = await HelpDeskService.updateMedicalClaimStatus(
            paramsResult.data.params.id,
            { status, remarks }
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'medical_claim_updated', claim);
        
        return sendSuccess(res, claim, 'Medical claim status updated');
    }),

    deleteMedicalClaim: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteMedicalClaim(result.data.params.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'medical_claim_deleted', { id: result.data.params.id });
        
        return sendSuccess(res, null, 'Medical claim deleted');
    }),

    // ─── Visa Support ────────────────────────────────────────────────────────

    getAllVisaRequests: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const visas = await HelpDeskService.findAllVisaRequests(result.data.query);
        return sendSuccess(res, visas, 'Visa requests retrieved');
    }),

    getVisaRequestById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const visa = await HelpDeskService.findVisaRequestById(result.data.params.id);
        if (!visa) {
            throw new AppError(404, 'Visa request not found');
        }
        return sendSuccess(res, visa, 'Visa request retrieved');
    }),

    createVisaRequest: asyncHandler(async (req: Request, res: Response) => {
        const result = createVisaRequestSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const visa = await HelpDeskService.createVisaRequest(result.data.body, req.user!.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'visa_request_created', visa);
        
        return sendSuccess(res, visa, 'Visa request created', 201);
    }),

    updateVisaStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status, notes } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const visa = await HelpDeskService.updateVisaStatus(
            paramsResult.data.params.id,
            { status, notes }
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'visa_request_updated', visa);
        
        return sendSuccess(res, visa, 'Visa status updated');
    }),

    deleteVisaRequest: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteVisaRequest(result.data.params.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'visa_request_deleted', { id: result.data.params.id });
        
        return sendSuccess(res, null, 'Visa request deleted');
    }),

    // ─── Visa Document Tracking ─────────────────────────────────────────────

    markDocumentViewed: asyncHandler(async (req: Request, res: Response) => {
        const result = markDocumentViewedSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid document ID');
        }

        const documentId = result.data.params.id;
        const userId = req.user!.id;
        const userName = req.user!.full_name || req.user!.email || 'Unknown User';
        const ipAddress = req.ip || req.socket?.remoteAddress;
        const userAgent = req.headers['user-agent'];

        await HelpDeskService.markDocumentViewed(
            documentId,
            userId,
            userName,
            ipAddress,
            userAgent
        );

        return sendSuccess(res, null, 'Document marked as viewed');
    }),

    getDocumentViewStatus: asyncHandler(async (req: Request, res: Response) => {
        const result = documentViewStatusSchema.safeParse({ 
            params: req.params,
            query: req.query 
        });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid document ID');
        }

        const documentId = result.data.params.id;
        const includeViewers = result.data.query?.include_viewers || false;

        const status = await HelpDeskService.getDocumentViewStatus(documentId, includeViewers);
        return sendSuccess(res, status, 'Document view status retrieved');
    }),

    // ─── Protocol Support ────────────────────────────────────────────────────

    getAllProtocolEvents: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const events = await HelpDeskService.findAllProtocolEvents(result.data.query);
        return sendSuccess(res, events, 'Protocol events retrieved');
    }),

    getProtocolEventById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const event = await HelpDeskService.findProtocolEventById(result.data.params.id);
        if (!event) {
            throw new AppError(404, 'Protocol event not found');
        }
        return sendSuccess(res, event, 'Protocol event retrieved');
    }),

    createProtocolEvent: asyncHandler(async (req: Request, res: Response) => {
        const result = createProtocolEventSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const event = await HelpDeskService.createProtocolEvent(result.data.body, req.user!.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'protocol_event_created', event);
        
        return sendSuccess(res, event, 'Protocol event created', 201);
    }),

    updateProtocolStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status, notes } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const event = await HelpDeskService.updateProtocolStatus(
            paramsResult.data.params.id,
            { status, notes }
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'protocol_event_updated', event);
        
        return sendSuccess(res, event, 'Protocol status updated');
    }),

    deleteProtocolEvent: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteProtocolEvent(result.data.params.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'protocol_event_deleted', { id: result.data.params.id });
        
        return sendSuccess(res, null, 'Protocol event deleted');
    }),

    // ─── Other Payments ──────────────────────────────────────────────────────

    getAllOtherPayments: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const payments = await HelpDeskService.findAllOtherPayments(result.data.query);
        return sendSuccess(res, payments, 'Other payments retrieved');
    }),

    getOtherPaymentById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const payment = await HelpDeskService.findOtherPaymentById(result.data.params.id);
        if (!payment) {
            throw new AppError(404, 'Other payment not found');
        }
        return sendSuccess(res, payment, 'Other payment retrieved');
    }),

    createOtherPayment: asyncHandler(async (req: Request, res: Response) => {
        const result = createOtherPaymentSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const payment = await HelpDeskService.createOtherPayment(result.data.body, req.user!.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'other_payment_created', payment);
        
        return sendSuccess(res, payment, 'Other payment created', 201);
    }),

    updateOtherPaymentStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const payment = await HelpDeskService.updateOtherPaymentStatus(
            paramsResult.data.params.id,
            { status }
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'other_payment_updated', payment);
        
        return sendSuccess(res, payment, 'Other payment status updated');
    }),

    updateOtherPaymentDSADetails: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const result = updateOtherPaymentDSASchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid DSA details data');
        }
        const payment = await HelpDeskService.updateOtherPaymentDSADetails(
            paramsResult.data.params.id,
            result.data.body.dsa_details
        );
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'other_payment_dsa_updated', payment);
        
        return sendSuccess(res, payment, 'Other payment DSA details updated');
    }),

    deleteOtherPayment: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteOtherPayment(result.data.params.id);
        
        // ── Emit real-time event ──────────────────────────────────────────────────
        safeRealtimeBroadcast(req, 'other_payment_deleted', { id: result.data.params.id });
        
        return sendSuccess(res, null, 'Other payment deleted');
    }),

    // ─── DSA Report ──────────────────────────────────────────────────────────

    getDSAReport: asyncHandler(async (req: Request, res: Response) => {
        const result = dsaReportFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid report filters');
        }

        const filters: DSAReportFilters = {};
        const query = result.data.query;

        if (query.limit !== undefined) filters.limit = query.limit;
        if (query.offset !== undefined) filters.offset = query.offset;
        if (query.judge_name) filters.judge_name = query.judge_name;
        if (query.payment_status) filters.payment_status = query.payment_status;
        if (query.travel_start) filters.travel_start = query.travel_start;
        if (query.travel_end) filters.travel_end = query.travel_end;

        if (query.modules) {
            const moduleList = query.modules.split(',').filter(
                (m) => ['circuit', 'special_bench', 'part_heard', 'service_week', 'other_payment'].includes(m)
            ) as ReportModule[];
            if (moduleList.length > 0) {
                filters.modules = moduleList;
            }
        }

        const report = await HelpDeskService.getDSAReport(filters);
        return sendSuccess(res, report, 'DSA report retrieved');
    }),

    exportDSAReport: asyncHandler(async (req: Request, res: Response) => {
        const result = dsaReportFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid report filters');
        }

        const filters: DSAReportFilters = {};
        const query = result.data.query;

        if (query.judge_name) filters.judge_name = query.judge_name;
        if (query.payment_status) filters.payment_status = query.payment_status;
        if (query.travel_start) filters.travel_start = query.travel_start;
        if (query.travel_end) filters.travel_end = query.travel_end;

        if (query.modules) {
            const moduleList = query.modules.split(',').filter(
                (m) => ['circuit', 'special_bench', 'part_heard', 'service_week', 'other_payment'].includes(m)
            ) as ReportModule[];
            if (moduleList.length > 0) {
                filters.modules = moduleList;
            }
        }

        const report = await HelpDeskService.getDSAReport(filters);
        const buffer = await generateDSAReportExcel(report);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="dsa-report-${Date.now()}.xlsx"`);
        return res.send(buffer);
    }),
};