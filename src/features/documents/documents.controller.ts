// src/features/documents/documents.controller.ts

import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { DocumentService } from './documents.service';
import {
  createComposedDocumentSchema,
  createUploadDocumentSchema,
  updateDocumentSchema,
  documentFiltersSchema,
  documentIdSchema,
  annotationIdSchema,
  createAnnotationSchema,
  markDocumentSchema,
  finalizeDraftSchema,
  returnDocumentSchema,
  respondToDocumentSchema,
  sendToUserSchema,
  composeMemoSchema,
  composeLetterSchema,
  updateMarkSchema,   // ✅ new import
} from './documents.validator';

export const documentController = {

  // ── Create ────────────────────────────────────────────────────────────────────

  createComposed: asyncHandler(async (req: Request, res: Response) => {
    const result = createComposedDocumentSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
    const doc = await DocumentService.createComposed(result.data.body, req.user!.id);
    return sendSuccess(res, doc, 'Document created successfully', 201);
  }),

  createUpload: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw new AppError(400, 'A file is required for this document type');
    const result = createUploadDocumentSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
    const io = req.app.get('io');
    const doc = await DocumentService.createUpload(
      result.data.body,
      file,
      req.user!.id,
      req.user!.role,
      io
    );
    return sendSuccess(res, doc, 'Document uploaded successfully', 201);
  }),

  // ── Compose Memo & Letter ──────────────────────────────────────────────────

  composeMemo: asyncHandler(async (req: Request, res: Response) => {
    const result = composeMemoSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid memo data');
    const doc = await DocumentService.generateMemo(result.data.body, req.user!.id);
    return sendSuccess(res, doc, 'Memo generated successfully', 201);
  }),

  composeLetter: asyncHandler(async (req: Request, res: Response) => {
    const result = composeLetterSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid letter data');
    const doc = await DocumentService.generateLetter(result.data.body, req.user!.id);
    return sendSuccess(res, doc, 'Letter generated successfully', 201);
  }),

  // ── Send to User ─────────────────────────────────────────────────────────────

  sendToUser: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = documentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = sendToUserSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid request');
    const doc = await DocumentService.sendToUser(
      paramsResult.data.params.id,
      bodyResult.data.body.recipient_id,
      req.user!.id,
      bodyResult.data.body.note
    );
    return sendSuccess(res, doc, 'Document sent successfully');
  }),

  // ── Get Received Documents ──────────────────────────────────────────────────

  getReceivedDocuments: asyncHandler(async (req: Request, res: Response) => {
    const docs = await DocumentService.getReceivedDocuments(req.user!.id);
    return sendSuccess(res, docs, 'Received documents retrieved');
  }),

  // ── Read ──────────────────────────────────────────────────────────────────────

  getAll: asyncHandler(async (req: Request, res: Response) => {
    const result = documentFiltersSchema.safeParse({ query: req.query });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    const docs = await DocumentService.findAll(result.data.query, req.user!.id);
    return sendSuccess(res, docs, 'Documents retrieved successfully');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const doc = await DocumentService.findByIdWithAnnotations(result.data.params.id);
    if (!doc) throw new AppError(404, 'Document not found');
    return sendSuccess(res, doc, 'Document retrieved successfully');
  }),

  getMyMarked: asyncHandler(async (req: Request, res: Response) => {
    const docs = await DocumentService.getMyMarked(req.user!.id);
    return sendSuccess(res, docs, 'Marked documents retrieved');
  }),

  getMarkHistory: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const history = await DocumentService.getMarkHistory(result.data.params.id);
    return sendSuccess(res, history, 'Mark history retrieved');
  }),

  // ── Update ────────────────────────────────────────────────────────────────────

  update: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = documentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = updateDocumentSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    const doc = await DocumentService.update(paramsResult.data.params.id, bodyResult.data.body);
    return sendSuccess(res, doc, 'Document updated successfully');
  }),

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  send: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const doc = await DocumentService.send(result.data.params.id);
    return sendSuccess(res, doc, 'Document sent and filed successfully');
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    await DocumentService.softDelete(result.data.params.id);
    return sendSuccess(res, null, 'Document deleted successfully');
  }),

  // ── Draft lifecycle ───────────────────────────────────────────────────────────

  finalizeDraft: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = documentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = finalizeDraftSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    const io = req.app.get('io');
    const doc = await DocumentService.finalizeDraft(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id,
      io
    );
    return sendSuccess(res, doc, 'Draft finalized successfully');
  }),

  // ── Document flow ──────────────────────────────────────────────────────────────

  returnDocument: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = documentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = returnDocumentSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    const doc = await DocumentService.returnDocument(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );
    return sendSuccess(res, doc, 'Document returned for action');
  }),

  getFlowHistory: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const flow = await DocumentService.getFlowHistory(result.data.params.id);
    return sendSuccess(res, flow, 'Document flow retrieved');
  }),

  // ── Response thread ───────────────────────────────────────────────────────

  respond: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = documentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = respondToDocumentSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid response');
    const response = await DocumentService.addResponse(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id,
      req.file
    );
    return sendSuccess(res, response, 'Response added successfully', 201);
  }),

  getResponses: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const responses = await DocumentService.getResponses(result.data.params.id);
    return sendSuccess(res, responses, 'Responses retrieved');
  }),

  // ── Marking to Departments ─────────────────────────────────────────────────

  markDocument: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = documentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = markDocumentSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid mark data');
    const doc = await DocumentService.markDocument(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );
    return sendSuccess(res, doc, 'Document marked successfully');
  }),

  acknowledgeMark: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const doc = await DocumentService.acknowledgeMark(result.data.params.id, req.user!.id);
    return sendSuccess(res, doc, 'Document acknowledged');
  }),

  completeMark: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const doc = await DocumentService.completeMark(result.data.params.id, req.user!.id);
    return sendSuccess(res, doc, 'Document marked as completed');
  }),

  // ── Annotations ───────────────────────────────────────────────────────────────

  addAnnotation: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = documentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = createAnnotationSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid annotation');
    const annotation = await DocumentService.addAnnotation(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );
    return sendSuccess(res, annotation, 'Annotation added successfully', 201);
  }),

  deleteAnnotation: asyncHandler(async (req: Request, res: Response) => {
    const result = annotationIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    await DocumentService.deleteAnnotation(
      result.data.params.id,
      result.data.params.annotationId,
      req.user!.id
    );
    return sendSuccess(res, null, 'Annotation deleted successfully');
  }),

  // ── E-Sign ────────────────────────────────────────────────────────────────────

  requestSignOtp: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    await DocumentService.requestSignOtp(result.data.params.id);
    return sendSuccess(res, null, 'OTP sent to your email');
  }),

  sign: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = documentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const otp = req.body?.otp as string | undefined;
    if (!otp) throw new AppError(400, 'OTP is required');
    const doc = await DocumentService.sign(paramsResult.data.params.id, req.user!.id, otp);
    return sendSuccess(res, doc, 'Document signed successfully');
  }),

  // ── NEW: Update Mark ─────────────────────────────────────────────────────────

  updateMark: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = updateMarkSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid mark ID');
    }
    const bodyResult = updateMarkSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    }
    const updatedMark = await DocumentService.updateMark(
      paramsResult.data.markId,
      bodyResult.data
    );
    return sendSuccess(res, updatedMark, 'Mark updated successfully');
  }),
};