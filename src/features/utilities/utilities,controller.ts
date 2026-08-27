// ============================================================
// utilities.controller.ts - UPDATED with Document Sync Support
// ============================================================

import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';

import { getRealtimeService } from '../../middleware/realtime.middleware';
import { UtilitiesService } from './utlities.service';
import {
    addUtilityItemSchema,
    bulkUpdateUtilityItemsSchema,
    createUtilitySchema,
    deleteUtilityItemSchema,
    deleteUtilitySchema,
    generateMemoSchema,
    getPendingUtilitiesSchema,
    memoFiltersSchema,
    memoIdSchema,
    memoSummarySchema,
    sendMemoForApprovalSchema,
    updateUtilityItemSchema,
    updateUtilitySchema,
    utilityApprovalStatusEnum,
    utilityFiltersSchema,
    utilityTypeEnum,
    syncUtilitiesWithDocumentSchema,
    checkMemoAvailabilitySchema,
    getItemsWithDocumentStatusSchema,
    documentStatusEnum,
} from './utlities.validator';

// ─── Helper: Safe realtime emit ──────────────────────────────────────────────

const safeRealtimeBroadcast = (req: Request, event: string, data: any) => {
    const realtime = getRealtimeService(req);
    if (realtime) {
        realtime.broadcast(event, data);
    } else {
        console.warn(`⚠️ Realtime service not available, skipping broadcast for event: ${event}`);
    }
};

// ─── Helper: Extract string from params ──────────────────────────────────────

const extractStringParam = (param: string | string[] | undefined): string => {
    if (!param) return '';
    if (Array.isArray(param)) return param[0] || '';
    return param;
};

// ─── ID Schema ─────────────────────────────────────────────────────────────────

const idSchema = z.object({
    params: z.object({
        id: z.string().uuid('ID must be a valid UUID'),
    }),
});

const utilityItemIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Request ID must be a valid UUID'),
        itemId: z.string().uuid('Item ID must be a valid UUID'),
    }),
});

export const utilitiesController = {

    // ============================================================
    // JUDGE UTILITIES
    // ============================================================

    /**
     * GET /api/utilities
     * Get all judge utility records with optional filters
     */
    getAllUtilities: asyncHandler(async (req: Request, res: Response) => {
        const result = utilityFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const utilities = await UtilitiesService.findAllUtilities(result.data.query);
        return sendSuccess(res, utilities, 'Judge utilities retrieved');
    }),

    /**
     * GET /api/utilities/:id
     * Get a specific judge utility record by ID
     */
    getUtilityById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const utility = await UtilitiesService.findUtilityById(result.data.params.id);
        if (!utility) {
            throw new AppError(404, 'Judge utility record not found');
        }
        return sendSuccess(res, utility, 'Judge utility record retrieved');
    }),

    /**
     * GET /api/utilities/by-pj/:pjNumber
     * Get a judge utility record by PJ number
     */
    getUtilityByPjNumber: asyncHandler(async (req: Request, res: Response) => {
        const pjNumber = extractStringParam(req.params.pjNumber);
        if (!pjNumber || pjNumber.trim() === '') {
            throw new AppError(400, 'PJ number is required');
        }
        const utility = await UtilitiesService.findUtilityByPjNumber(pjNumber);
        if (!utility) {
            throw new AppError(404, `Judge utility record not found for PJ number: ${pjNumber}`);
        }
        return sendSuccess(res, utility, 'Judge utility record retrieved by PJ number');
    }),

    /**
     * POST /api/utilities
     * Create a new judge utility record - PJ number is REQUIRED
     */
    createUtility: asyncHandler(async (req: Request, res: Response) => {
        const result = createUtilitySchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const utility = await UtilitiesService.createUtility(result.data.body, req.user!.id);
        safeRealtimeBroadcast(req, 'utility_created', utility);
        return sendSuccess(res, utility, 'Judge utility record created', 201);
    }),

    /**
     * POST /api/utilities/items
     * Add a utility item using PJ number from the body
     */
    addUtilityItem: asyncHandler(async (req: Request, res: Response) => {
        const result = addUtilityItemSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const utility = await UtilitiesService.addUtilityItem(result.data.body);
        safeRealtimeBroadcast(req, 'utility_item_added', utility);
        return sendSuccess(res, utility, 'Utility item added', 201);
    }),

    /**
     * PUT /api/utilities/:id/items/:itemId
     * Update a specific utility item
     */
    updateUtilityItem: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = utilityItemIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateUtilityItemSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const utility = await UtilitiesService.updateUtilityItem(
            paramsResult.data.params.id,
            paramsResult.data.params.itemId,
            bodyResult.data.body
        );
        safeRealtimeBroadcast(req, 'utility_item_updated', utility);
        return sendSuccess(res, utility, 'Utility item updated');
    }),

    /**
     * PUT /api/utilities/:id
     * Update the main utility record
     */
    updateUtility: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateUtilitySchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const utility = await UtilitiesService.updateUtility(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        safeRealtimeBroadcast(req, 'utility_updated', utility);
        return sendSuccess(res, utility, 'Judge utility record updated');
    }),

    /**
     * DELETE /api/utilities/:id/items/:itemId
     * Delete a specific utility item
     */
    deleteUtilityItem: asyncHandler(async (req: Request, res: Response) => {
        const result = deleteUtilityItemSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const utilityId = extractStringParam(req.params.id);
        if (!utilityId) {
            throw new AppError(400, 'Utility ID is required');
        }
        await UtilitiesService.deleteUtilityItem(
            utilityId,
            result.data.params.itemId
        );
        safeRealtimeBroadcast(req, 'utility_item_deleted', {
            utilityId: utilityId,
            itemId: result.data.params.itemId
        });
        return sendSuccess(res, null, 'Utility item deleted');
    }),

    /**
     * DELETE /api/utilities/:id
     * Delete an entire utility record
     */
    deleteUtility: asyncHandler(async (req: Request, res: Response) => {
        const result = deleteUtilitySchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await UtilitiesService.deleteUtility(result.data.params.id);
        safeRealtimeBroadcast(req, 'utility_deleted', { id: result.data.params.id });
        return sendSuccess(res, null, 'Judge utility record deleted');
    }),

    // ============================================================
    // CONSOLIDATED MEMOS
    // ============================================================

    /**
     * GET /api/utilities/memos
     * Get all consolidated memos with optional filters
     */
    getAllMemos: asyncHandler(async (req: Request, res: Response) => {
        const result = memoFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const memos = await UtilitiesService.findAllMemos(result.data.query);
        return sendSuccess(res, memos, 'Consolidated memos retrieved');
    }),

    /**
     * GET /api/utilities/memos/:id
     * Get a specific memo by ID
     */
    getMemoById: asyncHandler(async (req: Request, res: Response) => {
        const result = memoIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const memo = await UtilitiesService.findMemoById(result.data.params.id);
        if (!memo) {
            throw new AppError(404, 'Memo not found');
        }
        return sendSuccess(res, memo, 'Memo retrieved');
    }),

    /**
     * GET /api/utilities/memos/entity/:entityId
     * Get a memo by entity ID
     */
    getMemoByEntityId: asyncHandler(async (req: Request, res: Response) => {
        const entityId = extractStringParam(req.params.entityId);
        if (!entityId) {
            throw new AppError(400, 'Entity ID is required');
        }
        const memo = await UtilitiesService.findMemoByEntityId(entityId);
        if (!memo) {
            throw new AppError(404, `Memo not found for entity ID: ${entityId}`);
        }
        return sendSuccess(res, memo, 'Memo retrieved by entity ID');
    }),

    /**
     * POST /api/utilities/memos/generate
     * Generate a new consolidated memo
     */
    generateMemo: asyncHandler(async (req: Request, res: Response) => {
        const result = generateMemoSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const memo = await UtilitiesService.generateMemo(result.data.body, req.user!.id);
        safeRealtimeBroadcast(req, 'memo_generated', memo);
        return sendSuccess(res, memo, 'Memo generated successfully', 201);
    }),

    /**
     * POST /api/utilities/memos/:id/send
     * Send a memo for approval
     */
    sendMemoForApproval: asyncHandler(async (req: Request, res: Response) => {
        const result = sendMemoForApprovalSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const memo = await UtilitiesService.sendMemoForApproval(result.data.params.id);
        safeRealtimeBroadcast(req, 'memo_sent', memo);
        return sendSuccess(res, memo, 'Memo sent for approval');
    }),

    /**
     * POST /api/utilities/memos/:id/approve
     * Approve a memo
     */
    approveMemo: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = memoIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { notes } = req.body;
        const approvedBy = req.user?.full_name || req.user?.email || 'System Administrator';
        
        const memo = await UtilitiesService.approveMemo(
            paramsResult.data.params.id,
            approvedBy,
            notes
        );
        safeRealtimeBroadcast(req, 'memo_approved', memo);
        return sendSuccess(res, memo, 'Memo approved');
    }),

    /**
     * POST /api/utilities/memos/:id/reject
     * Reject a memo and reset items to pending
     */
    rejectMemo: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = memoIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { reason } = req.body;
        const rejectedBy = req.user?.full_name || req.user?.email || 'System Administrator';
        
        const memo = await UtilitiesService.rejectMemo(
            paramsResult.data.params.id,
            rejectedBy,
            reason
        );
        safeRealtimeBroadcast(req, 'memo_rejected', memo);
        return sendSuccess(res, memo, 'Memo rejected and items reset to pending');
    }),

    /**
     * POST /api/utilities/memos/:id/cancel
     * Cancel a memo and reset items to pending
     */
    cancelMemo: asyncHandler(async (req: Request, res: Response) => {
        const result = memoIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const memo = await UtilitiesService.cancelMemo(result.data.params.id);
        safeRealtimeBroadcast(req, 'memo_cancelled', memo);
        return sendSuccess(res, memo, 'Memo cancelled and items reset to pending');
    }),

    // ============================================================
    // ─── NEW: DOCUMENT SYNC ENDPOINTS ──────────────────────────────────────
    // ============================================================

    /**
     * POST /api/utilities/sync-with-document
     * Sync utility items with document status (called by document service)
     */
    syncUtilitiesWithDocument: asyncHandler(async (req: Request, res: Response) => {
        const result = syncUtilitiesWithDocumentSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        
        const syncResult = await UtilitiesService.syncUtilitiesWithDocument(result.data.body);
        
        safeRealtimeBroadcast(req, 'utilities_synced_with_document', {
            memo_id: result.data.body.memo_id,
            document_status: result.data.body.document_status,
            updated_count: syncResult.updatedCount,
        });
        
        return sendSuccess(res, syncResult, syncResult.message);
    }),

    /**
     * GET /api/utilities/available-items
     * Get items available for memo generation
     */
    getAvailableItemsForMemo: asyncHandler(async (req: Request, res: Response) => {
        const result = checkMemoAvailabilitySchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid parameters');
        }
        
        const { period, utility_type, exclude_with_documents } = result.data.query;
        const items = await UtilitiesService.getItemsAvailableForMemo(
            period,
            utility_type,
            exclude_with_documents ?? true
        );
        
        return sendSuccess(res, items, 'Available items retrieved');
    }),

    /**
     * GET /api/utilities/items-with-document-status
     * Get utility items filtered by document status
     */
    getItemsWithDocumentStatus: asyncHandler(async (req: Request, res: Response) => {
        const result = getItemsWithDocumentStatusSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid parameters');
        }
        
        const { document_status, period, utility_type, limit, offset } = result.data.query;
        const items = await UtilitiesService.getItemsWithDocumentStatus(
            document_status,
            period,
            utility_type,
            limit,
            offset
        );
        
        return sendSuccess(res, items, 'Items with document status retrieved');
    }),

    /**
     * GET /api/utilities/memos/:id/with-document
     * Get a memo with its associated document
     */
    getMemoWithDocument: asyncHandler(async (req: Request, res: Response) => {
        const result = memoIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        
        const { memo, document } = await UtilitiesService.getMemoWithDocument(result.data.params.id);
        if (!memo) {
            throw new AppError(404, 'Memo not found');
        }
        
        return sendSuccess(res, { memo, document }, 'Memo with document retrieved');
    }),

    /**
     * POST /api/utilities/check-items-availability
     * Check if specific items are available for memo generation
     */
    checkItemsAvailability: asyncHandler(async (req: Request, res: Response) => {
        const schema = z.object({
            body: z.object({
                item_ids: z.array(z.string().uuid('Each item ID must be a valid UUID'))
                    .min(1, 'At least one item ID is required'),
                exclude_with_documents: z.boolean().optional().default(true),
            }).strict(),
        });
        
        const result = schema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        
        const { item_ids, exclude_with_documents } = result.data.body;
        const availability = await UtilitiesService.checkItemsAvailability(
            item_ids,
            exclude_with_documents
        );
        
        return sendSuccess(res, availability, 'Item availability checked');
    }),

    // ============================================================
    // UTILITY QUERY HELPERS
    // ============================================================

    /**
     * GET /api/utilities/pending
     * Get pending utilities (not yet sent for approval)
     */
    getPendingUtilities: asyncHandler(async (req: Request, res: Response) => {
        const result = getPendingUtilitiesSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        
        const { period, utility_type, judge_name, pj_number, limit, offset } = result.data.query;
        const items = await UtilitiesService.getPendingUtilities(
            period,
            utility_type,
            judge_name,
            pj_number,
            limit,
            offset
        );
        return sendSuccess(res, items, 'Pending utilities retrieved');
    }),

    /**
     * GET /api/utilities/by-approval-status/:status
     * Get utilities by approval status
     */
    getUtilitiesByApprovalStatus: asyncHandler(async (req: Request, res: Response) => {
        // Parse params separately
        const paramsSchema = z.object({
            status: utilityApprovalStatusEnum,
        });
        
        const paramsResult = paramsSchema.safeParse(req.params);
        if (!paramsResult.success) {
            throw new AppError(400, `Invalid approval status: ${req.params.status}`);
        }
        
        // Parse query separately
        const querySchema = z.object({
            period: z.string().optional(),
            utility_type: utilityTypeEnum.optional(),
            limit: z.string().regex(/^\d+$/).optional().transform(Number),
            offset: z.string().regex(/^\d+$/).optional().transform(Number),
        });
        
        const queryResult = querySchema.safeParse(req.query);
        if (!queryResult.success) {
            throw new AppError(400, queryResult.error.issues[0]?.message ?? 'Invalid query parameters');
        }
        
        const { status } = paramsResult.data;
        const { period, utility_type, limit, offset } = queryResult.data;
        
        const items = await UtilitiesService.getUtilitiesByApprovalStatus(
            status,
            period,
            utility_type,
            limit,
            offset
        );
        
        return sendSuccess(res, items, `Utilities with approval status '${status}' retrieved`);
    }),

    /**
     * GET /api/utilities/available-periods
     * Get available periods for memo generation
     */
    getAvailablePeriods: asyncHandler(async (_req: Request, res: Response) => {
        const periods = await UtilitiesService.getAvailablePeriods();
        return sendSuccess(res, periods, 'Available periods retrieved');
    }),

    /**
     * GET /api/utilities/summary
     * Get utility summary statistics
     */
    getUtilitySummary: asyncHandler(async (req: Request, res: Response) => {
        const result = memoSummarySchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        
        const summary = await UtilitiesService.getMemoSummary(result.data.query.period);
        const stats = await UtilitiesService.getUtilityStats();
        
        return sendSuccess(res, {
            ...summary,
            ...stats,
        }, 'Utility summary retrieved');
    }),

    // ============================================================
    // BULK OPERATIONS
    // ============================================================

    /**
     * POST /api/utilities/bulk-update
     * Bulk update utility items
     */
    bulkUpdateUtilityItems: asyncHandler(async (req: Request, res: Response) => {
        const result = bulkUpdateUtilityItemsSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        
        const { item_ids, approval_status, memo_id } = result.data.body;
        const updated = await UtilitiesService.bulkUpdateUtilityItems(
            item_ids,
            approval_status,
            memo_id
        );
        
        safeRealtimeBroadcast(req, 'utility_items_bulk_updated', {
            updated: updated.updated,
            approval_status,
            memo_id,
        });
        
        return sendSuccess(res, updated, `Updated ${updated.updated} utility items`);
    }),

    // ============================================================
    // UTILITY STATISTICS
    // ============================================================

    /**
     * GET /api/utilities/stats
     * Get comprehensive utility statistics
     */
    getUtilityStats: asyncHandler(async (_req: Request, res: Response) => {
        const stats = await UtilitiesService.getUtilityStats();
        return sendSuccess(res, stats, 'Utility statistics retrieved');
    }),

    // ============================================================
    // APPROVAL STATUS ENUMS
    // ============================================================

    /**
     * GET /api/utilities/enums
     * Get all utility-related enums for frontend use
     */
    getUtilityEnums: asyncHandler(async (_req: Request, res: Response) => {
        const enums = {
            utilityTypes: ['Electricity', 'Water', 'Internet', 'Fuel', 'Other'],
            utilityStatuses: ['Awaiting', 'Awaiting Documentation', 'Awaiting Funding', 'In Process', 'Approved', 'Paid', 'Payment NA'],
            approvalStatuses: ['pending', 'in_memo', 'sent', 'approved', 'rejected'],
            memoStatuses: ['draft', 'sent', 'approved', 'rejected', 'cancelled'],
            memoTypes: ['all', 'fuel'],
            documentSyncStatuses: ['pending', 'synced', 'failed', 'not_applicable'],
            documentStatuses: ['draft', 'pending_approval', 'approved', 'rejected', 'returned'],
        };
        return sendSuccess(res, enums, 'Utility enums retrieved');
    }),

}; // end utilitiesController