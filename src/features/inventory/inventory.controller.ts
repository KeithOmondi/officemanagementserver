import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { InventoryService } from './inventory.service';
import {
    createInventoryItemSchema,
    updateInventoryItemSchema,
    createStoreRequestSchema,
    updateStoreRequestSchema,
    createProcurementRequestSchema,
    updateProcurementRequestSchema,
    createApprovedProcurementSchema,
    itemIdSchema,
    storeRequestIdSchema,
    procurementRequestIdSchema,
    approvedProcurementIdSchema,
} from './inventory.validator';

export const inventoryController = {

    // ── Stats ──────────────────────────────────────────────────────────────────
    getStats: asyncHandler(async (_req: Request, res: Response) => {
        const stats = await InventoryService.getStats();
        return sendSuccess(res, stats, 'Inventory statistics retrieved');
    }),

    // ── Inventory Items ────────────────────────────────────────────────────────
    getAllItems: asyncHandler(async (req: Request, res: Response) => {
        const { category } = req.query;
        const items = await InventoryService.findAllItems(category as string);
        return sendSuccess(res, items, 'Inventory items retrieved');
    }),

    getItemById: asyncHandler(async (req: Request, res: Response) => {
        const result = itemIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const item = await InventoryService.findItemById(result.data.params.id);
        if (!item) {
            throw new AppError(404, 'Inventory item not found');
        }
        return sendSuccess(res, item, 'Inventory item retrieved');
    }),

    createItem: asyncHandler(async (req: Request, res: Response) => {
        const result = createInventoryItemSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const item = await InventoryService.createItem(result.data.body, req.user!.id);
        return sendSuccess(res, item, 'Inventory item created', 201);
    }),

    updateItem: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = itemIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateInventoryItemSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const item = await InventoryService.updateItem(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        return sendSuccess(res, item, 'Inventory item updated');
    }),

    deleteItem: asyncHandler(async (req: Request, res: Response) => {
        const result = itemIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await InventoryService.deleteItem(result.data.params.id);
        return sendSuccess(res, null, 'Inventory item deleted');
    }),

    // ── Store Requests ────────────────────────────────────────────────────────
    getMyStoreRequests: asyncHandler(async (req: Request, res: Response) => {
        const requests = await InventoryService.findUserStoreRequests(req.user!.id);
        return sendSuccess(res, requests, 'Your store requests retrieved');
    }),

    getAllStoreRequests: asyncHandler(async (_req: Request, res: Response) => {
        const requests = await InventoryService.findAllStoreRequests();
        return sendSuccess(res, requests, 'All store requests retrieved');
    }),

    getStoreRequestById: asyncHandler(async (req: Request, res: Response) => {
        const result = storeRequestIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const request = await InventoryService.findStoreRequestById(result.data.params.id);
        if (!request) {
            throw new AppError(404, 'Store request not found');
        }
        return sendSuccess(res, request, 'Store request retrieved');
    }),

    createStoreRequest: asyncHandler(async (req: Request, res: Response) => {
        const result = createStoreRequestSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const request = await InventoryService.createStoreRequest(result.data.body, req.user!.id);
        return sendSuccess(res, request, 'Store request created', 201);
    }),

    updateStoreRequest: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = storeRequestIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateStoreRequestSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const request = await InventoryService.updateStoreRequest(
            paramsResult.data.params.id,
            bodyResult.data.body,
            req.user!.id
        );
        return sendSuccess(res, request, 'Store request updated');
    }),

    deleteStoreRequest: asyncHandler(async (req: Request, res: Response) => {
        const result = storeRequestIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await InventoryService.deleteStoreRequest(result.data.params.id);
        return sendSuccess(res, null, 'Store request deleted');
    }),

    // ── Procurement Requests ──────────────────────────────────────────────────
    getMyProcurementRequests: asyncHandler(async (req: Request, res: Response) => {
        const requests = await InventoryService.findUserProcurementRequests(req.user!.id);
        return sendSuccess(res, requests, 'Your procurement requests retrieved');
    }),

    getAllProcurementRequests: asyncHandler(async (_req: Request, res: Response) => {
        const requests = await InventoryService.findAllProcurementRequests();
        return sendSuccess(res, requests, 'All procurement requests retrieved');
    }),

    getProcurementRequestById: asyncHandler(async (req: Request, res: Response) => {
        const result = procurementRequestIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const request = await InventoryService.findProcurementRequestById(result.data.params.id);
        if (!request) {
            throw new AppError(404, 'Procurement request not found');
        }
        return sendSuccess(res, request, 'Procurement request retrieved');
    }),

    createProcurementRequest: asyncHandler(async (req: Request, res: Response) => {
        const result = createProcurementRequestSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const request = await InventoryService.createProcurementRequest(result.data.body, req.user!.id);
        return sendSuccess(res, request, 'Procurement request created', 201);
    }),

    updateProcurementRequest: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = procurementRequestIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateProcurementRequestSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const request = await InventoryService.updateProcurementRequest(
            paramsResult.data.params.id,
            bodyResult.data.body,
            req.user!.id
        );
        return sendSuccess(res, request, 'Procurement request updated');
    }),

    deleteProcurementRequest: asyncHandler(async (req: Request, res: Response) => {
        const result = procurementRequestIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await InventoryService.deleteProcurementRequest(result.data.params.id);
        return sendSuccess(res, null, 'Procurement request deleted');
    }),

    // ── Approved Procurement ──────────────────────────────────────────────────
    getAllApprovedProcurement: asyncHandler(async (_req: Request, res: Response) => {
        const items = await InventoryService.findAllApprovedProcurement();
        return sendSuccess(res, items, 'Approved procurement items retrieved');
    }),

    getApprovedProcurementById: asyncHandler(async (req: Request, res: Response) => {
        const result = approvedProcurementIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const item = await InventoryService.findApprovedProcurementById(result.data.params.id);
        if (!item) {
            throw new AppError(404, 'Approved procurement item not found');
        }
        return sendSuccess(res, item, 'Approved procurement item retrieved');
    }),

    createApprovedProcurement: asyncHandler(async (req: Request, res: Response) => {
        const result = createApprovedProcurementSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const item = await InventoryService.createApprovedProcurement(result.data.body, req.user!.id);
        return sendSuccess(res, item, 'Added to procurement list', 201);
    }),

    markProcurementPurchased: asyncHandler(async (req: Request, res: Response) => {
        const result = approvedProcurementIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const item = await InventoryService.markProcurementPurchased(
            result.data.params.id,
            req.body.purchase_reference
        );
        return sendSuccess(res, item, 'Procurement item marked as purchased');
    }),

    // ── Activity Log ──────────────────────────────────────────────────────────
    getActivityLog: asyncHandler(async (req: Request, res: Response) => {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const logs = await InventoryService.getActivityLog(limit);
        return sendSuccess(res, logs, 'Activity log retrieved');
    }),
};