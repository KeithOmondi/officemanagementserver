// src/features/registry/registry.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { RegistryService } from './registry.service';
import {
  routeFileSchema,
  receiveFileSchema,
  markFiledSchema,
  returnFileSchema,
  registryFiltersSchema,
  registryIdSchema,
  documentIdParamSchema,
} from './registry.validator';

export const registryController = {

  // ── Route a document to a station ───────────────────────────────────────────

  routeFile: asyncHandler(async (req: Request, res: Response) => {
    const result = routeFileSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid routing data');
    const entry = await RegistryService.routeFile(result.data.body, req.user!.id);
    return sendSuccess(res, entry, 'Document routed to station successfully', 201);
  }),

  // ── Read ──────────────────────────────────────────────────────────────────────

  getAll: asyncHandler(async (req: Request, res: Response) => {
    const result = registryFiltersSchema.safeParse({ query: req.query });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    const entries = await RegistryService.findAll(result.data.query);
    return sendSuccess(res, entries, 'Registry entries retrieved successfully');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const result = registryIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const entry = await RegistryService.findById(result.data.params.id);
    if (!entry) throw new AppError(404, 'Registry entry not found');
    return sendSuccess(res, entry, 'Registry entry retrieved successfully');
  }),

  getHistory: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdParamSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid document ID');
    const history = await RegistryService.getHistoryForDocument(result.data.params.documentId);
    return sendSuccess(res, history, 'Document registry history retrieved');
  }),

  getStationCounts: asyncHandler(async (_req: Request, res: Response) => {
    const counts = await RegistryService.getStationFileCounts();
    return sendSuccess(res, counts, 'Station file counts retrieved');
  }),

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  receiveFile: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = registryIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    receiveFileSchema.parse({ body: req.body ?? {} });
    const entry = await RegistryService.receiveFile(paramsResult.data.params.id, req.user!.id);
    return sendSuccess(res, entry, 'File receipt acknowledged');
  }),

  markFiled: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = registryIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    markFiledSchema.parse({ body: req.body ?? {} });
    const entry = await RegistryService.markFiled(paramsResult.data.params.id);
    return sendSuccess(res, entry, 'File marked as filed');
  }),

  returnFile: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = registryIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = returnFileSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    const entry = await RegistryService.returnFile(paramsResult.data.params.id, bodyResult.data.body);
    return sendSuccess(res, entry, 'File returned to registry');
  }),
};