// src/features/registry/registry.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { RegistryService } from './registry.service';
import {
  routeFileSchema,
  receiveFileSchema,
  returnFileSchema,
  registryFiltersSchema,
  registryIdSchema,
  documentIdParamSchema,
  // Folder schemas
  createFolderSchema,
  updateFolderSchema,
  folderIdParamSchema,
  moveFolderSchema,
  addDocumentToFolderSchema,
  removeDocumentFromFolderSchema,
  bulkAddDocumentsSchema,
  folderFiltersSchema,
  searchQuerySchema,
} from './registry.validator';
import type { 
  CreateFolderInput, 
  UpdateFolderInput,
  MoveFolderInput,
  AddDocumentToFolderInput,
  BulkAddDocumentsInput,
} from './registry.validator';

export const registryController = {

  // ═══════════════════════════════════════════════════════════════════════════
  //  REGISTRY ENTRY CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

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

  // ── REMOVED: markFiled ──────────────────────────────────────────────────────
  // No longer needed since we only have 'active' and 'returned' statuses

  returnFile: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = registryIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = returnFileSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    const entry = await RegistryService.returnFile(paramsResult.data.params.id, bodyResult.data.body);
    return sendSuccess(res, entry, 'File returned to registry');
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  FOLDER/COURT RECORD CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Create ────────────────────────────────────────────────────────────────────

  createFolder: asyncHandler(async (req: Request, res: Response) => {
    const result = createFolderSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid folder data');
    const folder = await RegistryService.createFolder(result.data.body);
    return sendSuccess(res, folder, 'Folder created successfully', 201);
  }),

  // ── Read ──────────────────────────────────────────────────────────────────────

  getAllFolders: asyncHandler(async (req: Request, res: Response) => {
    const result = folderFiltersSchema.safeParse({ query: req.query });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    const folders = await RegistryService.getAllFolders({
      category: result.data.query.category,
      status: result.data.query.status,
      search: result.data.query.search,
      include_sub_folders: result.data.query.include_sub_folders,
    });
    return sendSuccess(res, folders, 'Folders retrieved successfully');
  }),

  getRootFolders: asyncHandler(async (_req: Request, res: Response) => {
    const folders = await RegistryService.getRootFolders();
    return sendSuccess(res, folders, 'Root folders retrieved successfully');
  }),

  getActiveFolders: asyncHandler(async (_req: Request, res: Response) => {
    const folders = await RegistryService.getActiveFolders();
    return sendSuccess(res, folders, 'Active folders retrieved successfully');
  }),

  getFolderById: asyncHandler(async (req: Request, res: Response) => {
    const result = folderIdParamSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid folder ID');
    const folder = await RegistryService.getFolderById(result.data.params.id);
    if (!folder) throw new AppError(404, 'Folder not found');
    return sendSuccess(res, folder, 'Folder retrieved successfully');
  }),

  getFolderChildren: asyncHandler(async (req: Request, res: Response) => {
    const result = folderIdParamSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid folder ID');
    const children = await RegistryService.getFolderChildren(result.data.params.id);
    return sendSuccess(res, children, 'Folder children retrieved successfully');
  }),

  getFolderHierarchy: asyncHandler(async (req: Request, res: Response) => {
    const result = folderIdParamSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid folder ID');
    const hierarchy = await RegistryService.getFolderHierarchy(result.data.params.id);
    return sendSuccess(res, hierarchy, 'Folder hierarchy retrieved successfully');
  }),

  getFolderCategories: asyncHandler(async (_req: Request, res: Response) => {
    const categories = await RegistryService.getFolderCategories();
    return sendSuccess(res, categories, 'Folder categories retrieved successfully');
  }),

  getFolderStatistics: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await RegistryService.getFolderStatistics();
    return sendSuccess(res, stats, 'Folder statistics retrieved successfully');
  }),

  searchFolders: asyncHandler(async (req: Request, res: Response) => {
    const result = searchQuerySchema.safeParse({ query: req.query });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid search query');
    const results = await RegistryService.searchFolders(result.data.query.q);
    return sendSuccess(res, results, 'Search results retrieved successfully');
  }),

  // ── Update ────────────────────────────────────────────────────────────────────

  updateFolder: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = folderIdParamSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid folder ID');
    const bodyResult = updateFolderSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid update data');
    const folder = await RegistryService.updateFolder(
      paramsResult.data.params.id,
      bodyResult.data.body as UpdateFolderInput
    );
    return sendSuccess(res, folder, 'Folder updated successfully');
  }),

  // ── Delete ────────────────────────────────────────────────────────────────────

  deleteFolder: asyncHandler(async (req: Request, res: Response) => {
    const result = folderIdParamSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid folder ID');
    await RegistryService.deleteFolder(result.data.params.id);
    return sendSuccess(res, null, 'Folder deleted successfully');
  }),

  // ── Move Folder ──────────────────────────────────────────────────────────────

  moveFolder: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = folderIdParamSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid folder ID');
    const bodyResult = moveFolderSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid move data');
    const folder = await RegistryService.moveFolder(
      paramsResult.data.params.id,
      bodyResult.data.body.parent_folder_id ?? null
    );
    return sendSuccess(res, folder, 'Folder moved successfully');
  }),

  // ── Folder Documents ─────────────────────────────────────────────────────────

  getFolderDocuments: asyncHandler(async (req: Request, res: Response) => {
    const result = folderIdParamSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid folder ID');
    const documents = await RegistryService.getFolderDocuments(result.data.params.id);
    return sendSuccess(res, documents, 'Folder documents retrieved successfully');
  }),

  addDocumentToFolder: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = folderIdParamSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid folder ID');
    const bodyResult = addDocumentToFolderSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid document data');
    await RegistryService.addDocumentToFolder(
      paramsResult.data.params.id,
      bodyResult.data.body.document_id
    );
    return sendSuccess(res, null, 'Document added to folder successfully');
  }),

  removeDocumentFromFolder: asyncHandler(async (req: Request, res: Response) => {
    const result = removeDocumentFromFolderSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid parameters');
    await RegistryService.removeDocumentFromFolder(
      result.data.params.id,
      result.data.params.documentId
    );
    return sendSuccess(res, null, 'Document removed from folder successfully');
  }),

  bulkAddDocumentsToFolder: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = folderIdParamSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid folder ID');
    const bodyResult = bulkAddDocumentsSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid documents data');
    const result = await RegistryService.bulkAddDocumentsToFolder(
      paramsResult.data.params.id,
      bodyResult.data.body.document_ids
    );
    return sendSuccess(res, result, 'Documents added to folder');
  }),
};