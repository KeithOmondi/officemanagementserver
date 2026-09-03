// src/features/registry/registry.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { RegistryService } from './registry.service';
import { uploadMultipleToCloudinary } from '../../config/cloudinary';
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
  getStationFolderDocumentsSchema,
  // NEW: Direct upload schemas
  directUploadSchema,
  bulkDirectUploadSchema,
  uploadDocumentToFolderSchema,
  updateDocumentMetadataSchema,
  deleteDocumentSchema,
  getDocumentDetailsSchema,
} from './registry.validator';
import type { 
  CreateFolderInput, 
  UpdateFolderInput,
  MoveFolderInput,
  AddDocumentToFolderInput,
  BulkAddDocumentsInput,
  GetStationFolderDocumentsQuery,
  DirectUploadInput,
  BulkDirectUploadInput,
  UploadDocumentToFolderInput,
  UpdateDocumentMetadataInput,
  DeleteDocumentInput,
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

  // ── NEW: Direct Upload Document to Station ──────────────────────────────────

  directUpload: asyncHandler(async (req: Request, res: Response) => {
    // Validate body
    const result = directUploadSchema.safeParse({ body: req.body });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid upload data');
    }

    // Check if file was uploaded
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      throw new AppError(400, 'File is required for upload');
    }

    // Upload to Cloudinary first
    const cloudinaryResults = await uploadMultipleToCloudinary(
      [file],
      `registry/documents/${result.data.body.station_id}`
    );

    if (!cloudinaryResults || cloudinaryResults.length === 0) {
      throw new AppError(500, 'Failed to upload file to Cloudinary');
    }

    const cloudinaryResult = cloudinaryResults[0];

    const result_data = await RegistryService.directUpload(
      result.data.body as DirectUploadInput,
      req.user!.id,
      cloudinaryResult
    );

    return sendSuccess(res, result_data, 'Document uploaded successfully', 201);
  }),

  // ── NEW: Bulk Direct Upload ─────────────────────────────────────────────────

  bulkDirectUpload: asyncHandler(async (req: Request, res: Response) => {
    // Validate body
    const result = bulkDirectUploadSchema.safeParse({ body: req.body });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid upload data');
    }

    // Check if files were uploaded
    const files = (req as any).files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      throw new AppError(400, 'At least one file is required for upload');
    }

    // Upload to Cloudinary
    const cloudinaryResults = await uploadMultipleToCloudinary(
      files,
      `registry/documents/${result.data.body.station_id}`
    );

    if (!cloudinaryResults || cloudinaryResults.length === 0) {
      throw new AppError(500, 'Failed to upload files to Cloudinary');
    }

    const results = await RegistryService.bulkDirectUpload(
      result.data.body as BulkDirectUploadInput,
      req.user!.id,
      cloudinaryResults
    );

    return sendSuccess(res, results, `${results.data?.totalSuccess || 0} documents uploaded successfully`, 201);
  }),

  // ── NEW: Upload Document to Folder ──────────────────────────────────────────

  uploadDocumentToFolder: asyncHandler(async (req: Request, res: Response) => {
    // Validate params and body
    const result = uploadDocumentToFolderSchema.safeParse({ 
      params: req.params, 
      body: req.body 
    });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
    }

    // Check if file was uploaded
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      throw new AppError(400, 'File is required for upload');
    }

    // Upload to Cloudinary
    const cloudinaryResults = await uploadMultipleToCloudinary(
      [file],
      `registry/folders/${result.data.params.id}`
    );

    if (!cloudinaryResults || cloudinaryResults.length === 0) {
      throw new AppError(500, 'Failed to upload file to Cloudinary');
    }

    const cloudinaryResult = cloudinaryResults[0];

    const result_data = await RegistryService.uploadDocumentToFolder(
      result.data.params.id,
      {
        title: result.data.body.title,
        ref_no: result.data.body.ref_no,
        priority: result.data.body.priority,
        note: result.data.body.note,
      },
      req.user!.id,
      cloudinaryResult
    );

    return sendSuccess(res, result_data, 'Document uploaded to folder successfully', 201);
  }),

  // ── NEW: Get Document Details ───────────────────────────────────────────────

  getDocumentDetails: asyncHandler(async (req: Request, res: Response) => {
    const result = getDocumentDetailsSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid document ID');
    }

    const { documentId } = result.data.params;
    const activeEntry = await RegistryService.getActiveForDocument(documentId);
    if (!activeEntry) {
      throw new AppError(404, 'Document not found or not active');
    }

    const history = await RegistryService.getHistoryForDocument(documentId);
    
    return sendSuccess(res, {
      current: activeEntry,
      history,
    }, 'Document details retrieved successfully');
  }),

  // ── NEW: Update Document Metadata ───────────────────────────────────────────

  updateDocumentMetadata: asyncHandler(async (req: Request, res: Response) => {
    const result = updateDocumentMetadataSchema.safeParse({ 
      params: req.params, 
      body: req.body 
    });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid update data');
    }

    const { documentId } = result.data.params;
    const entry = await RegistryService.updateDocumentMetadata(
      documentId,
      result.data.body as UpdateDocumentMetadataInput,
      req.user!.id
    );

    return sendSuccess(res, entry, 'Document metadata updated successfully');
  }),

  // ── NEW: Delete Document ────────────────────────────────────────────────────

  deleteDocument: asyncHandler(async (req: Request, res: Response) => {
    const result = deleteDocumentSchema.safeParse({ 
      params: req.params, 
      body: req.body 
    });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid delete data');
    }

    const { documentId } = result.data.params;
    const { delete_from_storage } = result.data.body as DeleteDocumentInput;

    const result_data = await RegistryService.deleteDocument(
      documentId,
      delete_from_storage ?? false
    );

    let message = 'Document deleted successfully';
    if (result_data.filePublicIds && result_data.filePublicIds.length > 0) {
      message += ` (${result_data.filePublicIds.length} file(s) removed from storage)`;
    }

    return sendSuccess(res, result_data, message);
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

  // ── NEW: Get Documents by Source ────────────────────────────────────────────

  getDocumentsBySource: asyncHandler(async (req: Request, res: Response) => {
    const { source, stationId } = req.query;
    
    if (!source || (source !== 'routed' && source !== 'direct')) {
      throw new AppError(400, 'Source must be "routed" or "direct"');
    }

    const entries = await RegistryService.getDocumentsBySource(
      source as 'routed' | 'direct',
      stationId as string | undefined
    );

    const label = source === 'routed' ? 'Routed' : 'Direct Upload';
    return sendSuccess(res, entries, `${label} documents retrieved successfully`);
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

  // ── Get Folder Documents by Station ─────────────────────────────────────────

  getStationFolderDocuments: asyncHandler(async (req: Request, res: Response) => {
    const result = getStationFolderDocumentsSchema.safeParse({ 
      params: req.params, 
      query: req.query 
    });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid parameters');
    }

    const { stationId } = result.data.params;
    const { page, limit, source } = result.data.query;

    const documents = await RegistryService.getStationFolderDocuments(stationId, {
      page,
      limit,
      source,
    });

    return sendSuccess(res, documents, 'Folder documents for station retrieved successfully');
  }),
};