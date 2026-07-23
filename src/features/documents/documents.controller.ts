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
  updateMarkSchema,
  redirectToFolderSchema,
  removeFromFolderSchema,
  getFolderDocumentsSchema,
  // ── Follow-up schemas ──────────────────────────────────────────────
  createFollowUpSchema,
  fileAwayFollowUpSchema,
  updateFollowUpSchema,
  completeFollowUpSchema,
  cancelFollowUpSchema,
  addFollowUpCommentSchema,
  followUpFiltersSchema,
  followUpIdSchema,
} from './documents.validator';
import { getRealtimeService } from '../../middleware/realtime.middleware';

// ─── Helper: Safe realtime broadcast ─────────────────────────────────────────

const safeBroadcast = (req: Request, event: string, data: unknown) => {
  const realtime = getRealtimeService(req);
  if (realtime) {
    realtime.broadcast(event, data);
  } else {
    console.warn(`⚠️ Realtime service not available, skipping broadcast for event: ${event}`);
  }
};

const safeEmitToRoom = (req: Request, room: string, event: string, data: unknown) => {
  const realtime = getRealtimeService(req);
  if (realtime) {
    realtime.emitToRoom(room, event, data);
  } else {
    console.warn(`⚠️ Realtime service not available, skipping emit to room ${room} for event: ${event}`);
  }
};

const safeEmitToUser = (req: Request, userId: string, event: string, data: unknown) => {
  const realtime = getRealtimeService(req);
  if (realtime) {
    realtime.emitToUser(userId, event, data);
  } else {
    console.warn(`⚠️ Realtime service not available, skipping emit to user ${userId} for event: ${event}`);
  }
};

// ─── Helper: Safe document methods ──────────────────────────────────────────

const safeDocumentCreated = (req: Request, doc: unknown) => {
  const realtime = getRealtimeService(req);
  if (realtime && realtime.documentCreated) {
    realtime.documentCreated(doc);
  } else if (realtime) {
    realtime.broadcast('document_created', doc);
  }
};

const safeDocumentUpdated = (req: Request, doc: unknown, targetUserId?: string) => {
  const realtime = getRealtimeService(req);
  if (realtime && realtime.documentUpdated) {
    realtime.documentUpdated(doc, targetUserId);
  } else if (realtime) {
    realtime.broadcast('document_updated', doc);
  }
};

const safeDocumentDeleted = (req: Request, documentId: string) => {
  const realtime = getRealtimeService(req);
  if (realtime && realtime.documentDeleted) {
    realtime.documentDeleted(documentId);
  } else if (realtime) {
    realtime.broadcast('document_deleted', { id: documentId });
  }
};

const safeMarkUpdated = (req: Request, data: unknown, targetUserId: string) => {
  const realtime = getRealtimeService(req);
  if (realtime && realtime.markUpdated) {
    realtime.markUpdated(data, targetUserId);
  } else if (realtime) {
    realtime.broadcast('mark_updated', data);
  }
};

export const documentController = {

  // ── Create ────────────────────────────────────────────────────────────────────

  createComposed: asyncHandler(async (req: Request, res: Response) => {
    const result = createComposedDocumentSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
    const doc = await DocumentService.createComposed(result.data.body, req.user!.id);
    
    safeDocumentCreated(req, doc);
    
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
    
    safeDocumentCreated(req, doc);
    
    return sendSuccess(res, doc, 'Document uploaded successfully', 201);
  }),

  // ── Compose Memo & Letter ──────────────────────────────────────────────────

  composeMemo: asyncHandler(async (req: Request, res: Response) => {
    const result = composeMemoSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid memo data');
    const doc = await DocumentService.generateMemo(result.data.body, req.user!.id);
    
    safeDocumentCreated(req, doc);
    
    return sendSuccess(res, doc, 'Memo generated successfully', 201);
  }),

  composeLetter: asyncHandler(async (req: Request, res: Response) => {
    const result = composeLetterSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid letter data');
    const doc = await DocumentService.generateLetter(result.data.body, req.user!.id);
    
    safeDocumentCreated(req, doc);
    
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
    
    safeDocumentUpdated(req, doc, bodyResult.data.body.recipient_id);
    
    return sendSuccess(res, doc, 'Document sent successfully');
  }),

  // ── Get Received Documents ──────────────────────────────────────────────────

  getReceivedDocuments: asyncHandler(async (req: Request, res: Response) => {
    const docs = await DocumentService.getReceivedDocuments(req.user!.id);
    return sendSuccess(res, docs, 'Received documents retrieved');
  }),

  // ── Read ──────────────────────────────────────────────────────────────────────

  getAll: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const parsed = documentFiltersSchema.safeParse({ query: req.query });
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid filters');

    const filters = parsed.data.query;
    const docs = await DocumentService.findAll(filters, req.user.id, req.user.role);

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

    const doc = await DocumentService.findById(paramsResult.data.params.id);
    if (!doc) throw new AppError(404, 'Document not found');

    const hasMemoFields =
      bodyResult.data.body.to_recipient !== undefined ||
      bodyResult.data.body.from_sender !== undefined ||
      bodyResult.data.body.document_date !== undefined ||
      bodyResult.data.body.subject !== undefined ||
      bodyResult.data.body.cc !== undefined ||
      bodyResult.data.body.enclosures !== undefined ||
      bodyResult.data.body.signature_name !== undefined ||
      bodyResult.data.body.signature_title !== undefined ||
      bodyResult.data.body.from_first !== undefined;

    if (hasMemoFields && (doc.type === 'memo' || doc.type === 'letter')) {
      if (req.user!.role !== 'super_admin') {
        throw new AppError(403, 'Only super administrators can edit memo and letter fields (TO, FROM, DATE, SUBJECT, CC, ENCLOSURES, SIGNATURE, SIGNATURE ORDER, SIGNATURE PLACEMENT)');
      }
    }

    const updated = await DocumentService.update(paramsResult.data.params.id, bodyResult.data.body);
    
    safeDocumentUpdated(req, updated, req.user!.id);
    
    return sendSuccess(res, updated, 'Document updated successfully');
  }),

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  send: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const doc = await DocumentService.send(result.data.params.id);
    
    safeDocumentUpdated(req, doc);
    
    return sendSuccess(res, doc, 'Document sent and filed successfully');
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    await DocumentService.softDelete(result.data.params.id);
    
    safeDocumentDeleted(req, result.data.params.id);
    
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
    
    safeDocumentUpdated(req, doc);
    if (bodyResult.data.body.assigned_to) {
      safeEmitToUser(req, bodyResult.data.body.assigned_to, 'document_assigned', {
        document_id: doc.id,
        title: doc.title,
        message: `Document "${doc.title}" has been assigned to you`
      });
    }
    
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
    
    safeDocumentUpdated(req, doc);
    
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
    
    safeEmitToRoom(req, `document:${paramsResult.data.params.id}`, 'new_response', response);
    
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
    
    if (bodyResult.data.body.assigned_to) {
      safeMarkUpdated(req, 
        { 
          document_id: doc.id, 
          status: doc.status, 
          assigned_to: bodyResult.data.body.assigned_to,
          assigned_to_name: doc.assigned_to_name,
          document_title: doc.title,
          marked_by: req.user!.full_name,
          marked_at: new Date().toISOString(),
        }, 
        bodyResult.data.body.assigned_to
      );
    }
    
    safeDocumentUpdated(req, doc);
    
    return sendSuccess(res, doc, 'Document marked successfully');
  }),

  acknowledgeMark: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const doc = await DocumentService.acknowledgeMark(result.data.params.id, req.user!.id);
    
    safeMarkUpdated(req,
      { 
        document_id: doc.id, 
        status: doc.status, 
        acknowledged_by: req.user!.id,
        acknowledged_by_name: req.user!.full_name,
        document_title: doc.title,
        acknowledged_at: new Date().toISOString(),
      }, 
      doc.created_by
    );
    safeDocumentUpdated(req, doc);
    
    return sendSuccess(res, doc, 'Document acknowledged');
  }),

  completeMark: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const doc = await DocumentService.completeMark(result.data.params.id, req.user!.id);
    
    safeMarkUpdated(req,
      { 
        document_id: doc.id, 
        status: doc.status, 
        completed_by: req.user!.id,
        completed_by_name: req.user!.full_name,
        document_title: doc.title,
        completed_at: new Date().toISOString(),
      }, 
      doc.created_by
    );
    safeDocumentUpdated(req, doc);
    
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
    
    safeEmitToRoom(req, `document:${paramsResult.data.params.id}`, 'annotation_added', annotation);
    
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
    
    safeEmitToRoom(req, `document:${result.data.params.id}`, 'annotation_deleted', {
      annotationId: result.data.params.annotationId
    });
    
    return sendSuccess(res, null, 'Annotation deleted successfully');
  }),

  // ── E-Sign ────────────────────────────────────────────────────────────────────

  requestSignOtp: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    await DocumentService.requestSignOtp(result.data.params.id, req.user!.id);
    return sendSuccess(res, null, 'OTP sent to your email');
  }),

  sign: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = documentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');

    const otp = req.body?.otp as string | undefined;
    if (!otp) throw new AppError(400, 'OTP is required');
    if (!/^\d{6}$/.test(otp)) throw new AppError(400, 'OTP must be exactly 6 digits');

    const doc = await DocumentService.findById(paramsResult.data.params.id);
    if (!doc) throw new AppError(404, 'Document not found');

    const isTemplatedDocument = doc.type === 'memo' || doc.type === 'letter';

    const positionX = req.body?.position_x as number | undefined;
    const positionY = req.body?.position_y as number | undefined;
    const positionWidth = req.body?.position_width as number | undefined;
    const positionHeight = req.body?.position_height as number | undefined;

    if (!isTemplatedDocument && positionX !== undefined && positionY !== undefined) {
      console.log(`[Sign] Saving custom signature position: x=${positionX}, y=${positionY}, w=${positionWidth || 200}, h=${positionHeight || 80}`);

      await DocumentService.update(paramsResult.data.params.id, {
        signature_position_x: positionX,
        signature_position_y: positionY,
        signature_position_width: positionWidth || 200,
        signature_position_height: positionHeight || 80,
      });
    } else if (isTemplatedDocument && positionX !== undefined) {
      console.log(
        `[Sign] Ignoring frontend-supplied position for templated ${doc.type} document ${paramsResult.data.params.id} — using anchor-based auto-detection instead.`
      );
    }

    const signedDoc = await DocumentService.sign(paramsResult.data.params.id, req.user!.id, otp);
    
    safeDocumentUpdated(req, signedDoc);
    safeEmitToRoom(req, `document:${paramsResult.data.params.id}`, 'document_signed', {
      document_id: signedDoc.id,
      signed_by: req.user!.full_name,
      signed_at: new Date().toISOString(),
    });
    
    return sendSuccess(res, signedDoc, 'Document signed successfully. Ready for release.');
  }),

  // ── Release Document (Super Admin only) ──────────────────────────────────────

  releaseDocument: asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role !== 'super_admin') {
      throw new AppError(403, 'Only Super Administrators can release documents.');
    }

    const paramsResult = documentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    
    const note = req.body?.note;
    const recipientId = req.body?.recipient_id;
    
    console.log(`[Release] Document ${paramsResult.data.params.id} being released by user ${req.user!.id} (${req.user!.role})${note ? ` — note: "${note}"` : ''}${recipientId ? ` — assigned to: ${recipientId}` : ''}`);
    
    const doc = await DocumentService.releaseDocument(
      paramsResult.data.params.id,
      req.user!.id,
      note,
      recipientId
    );
    
    safeDocumentUpdated(req, doc);
    if (recipientId) {
      safeEmitToUser(req, recipientId, 'document_released', {
        document_id: doc.id,
        title: doc.title,
        message: `Document "${doc.title}" has been released to you`
      });
    }
    
    return sendSuccess(res, doc, 'Document released to admin side successfully.');
  }),

  // ── Update Mark ─────────────────────────────────────────────────────────

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
    
    safeEmitToRoom(req, `document:${updatedMark.document_id}`, 'mark_updated', updatedMark);
    if (updatedMark.assigned_to) {
      safeEmitToUser(req, updatedMark.assigned_to, 'mark_updated', updatedMark);
    }
    
    return sendSuccess(res, updatedMark, 'Mark updated successfully');
  }),

  // ── Folder Operations ────────────────────────────────────────────────────────

  redirectToFolder: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = documentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    
    const bodyResult = redirectToFolderSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    
    const doc = await DocumentService.redirectToFolder(
      paramsResult.data.params.id,
      bodyResult.data.body.folder_id,
      req.user!.id,
      bodyResult.data.body.note
    );
    
    safeDocumentUpdated(req, doc);
    safeEmitToRoom(req, `folder:${bodyResult.data.body.folder_id}`, 'document_added_to_folder', doc);
    
    return sendSuccess(res, doc, 'Document redirected to folder successfully');
  }),

  removeFromFolder: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = documentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    
    const bodyResult = removeFromFolderSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    
    const doc = await DocumentService.removeFromFolder(
      paramsResult.data.params.id,
      req.user!.id,
      bodyResult.data.body?.note
    );
    
    safeDocumentUpdated(req, doc);
    
    return sendSuccess(res, doc, 'Document removed from folder successfully');
  }),

  getDocumentsByFolder: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = getFolderDocumentsSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid folder ID');
    
    const queryResult = getFolderDocumentsSchema.safeParse({ query: req.query });
    if (!queryResult.success) throw new AppError(400, queryResult.error.issues[0]?.message ?? 'Invalid query parameters');
    
    const folderId = paramsResult.data.params.folderId;
    const { page, limit, search, type, status } = queryResult.data.query;
    
    const result = await DocumentService.getDocumentsByFolder(
      folderId,
      page || 1,
      limit || 20,
      search,
      type,
      status
    );
    return sendSuccess(res, result, 'Folder documents retrieved successfully');
  }),

  // ── Regenerate PDF ──────────────────────────────────────────────────────────

  regeneratePdf: asyncHandler(async (req: Request, res: Response) => {
    const result = documentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const doc = await DocumentService.regeneratePdf(result.data.params.id);
    
    safeDocumentUpdated(req, doc);
    
    return sendSuccess(res, doc, 'Document PDF regenerated successfully');
  }),

  // ════════════════════════════════════════════════════════════════════════════
  //  FOLLOW-UP CONTROLLER METHODS (UPDATED - SIMPLIFIED)
  // ════════════════════════════════════════════════════════════════════════════

  // ── Create Follow-Up (Simplified) ──────────────────────────────────────────

  createFollowUp: asyncHandler(async (req: Request, res: Response) => {
    const result = createFollowUpSchema.safeParse({ body: req.body });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid follow-up data');
    }

    const followUp = await DocumentService.createFollowUp(
      result.data.body,
      req.user!.id
    );

    safeBroadcast(req, 'follow_up_created', followUp);
    if (followUp.assigned_to) {
      safeEmitToUser(req, followUp.assigned_to, 'follow_up_created', followUp);
    }
    if (followUp.document_id) {
      safeEmitToRoom(req, `document:${followUp.document_id}`, 'follow_up_created', followUp);
    }

    return sendSuccess(res, followUp, 'Follow-up created successfully', 201);
  }),

  // ── File Away Follow-Up (New) ─────────────────────────────────────────────

  fileAwayFollowUp: asyncHandler(async (req: Request, res: Response) => {
    const result = fileAwayFollowUpSchema.safeParse({ body: req.body });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid file away data');
    }

    const followUp = await DocumentService.fileAwayFollowUp(
      result.data.body,
      req.user!.id
    );

    safeBroadcast(req, 'follow_up_filed_away', followUp);
    if (followUp.document_id) {
      safeEmitToRoom(req, `document:${followUp.document_id}`, 'follow_up_filed_away', followUp);
    }

    return sendSuccess(res, followUp, 'Follow-up filed away successfully', 201);
  }),

  // ── Get Follow-Up Summary (New) ────────────────────────────────────────────

  getFollowUpSummary: asyncHandler(async (req: Request, res: Response) => {
    const summary = await DocumentService.getFollowUpSummary(req.user!.id);
    return sendSuccess(res, summary, 'Follow-up summary retrieved successfully');
  }),

  // ── Get Follow-Ups ──────────────────────────────────────────────────────────

  getFollowUps: asyncHandler(async (req: Request, res: Response) => {
    const parsed = followUpFiltersSchema.safeParse({ query: req.query });
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid filters');
    }

    const result = await DocumentService.getFollowUps(parsed.data.query);
    return sendSuccess(res, result, 'Follow-ups retrieved successfully');
  }),

  // ── Get Follow-Ups by Document ─────────────────────────────────────────────

  getFollowUpsByDocument: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = documentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid document ID');
    }

    const parsed = followUpFiltersSchema.safeParse({ query: req.query });
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid filters');
    }

    const result = await DocumentService.getFollowUpsByDocument(
      paramsResult.data.params.id,
      parsed.data.query
    );

    return sendSuccess(res, result, 'Document follow-ups retrieved successfully');
  }),

  // ── Get My Follow-Ups ──────────────────────────────────────────────────────

  getMyFollowUps: asyncHandler(async (req: Request, res: Response) => {
    const parsed = followUpFiltersSchema.safeParse({ query: req.query });
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid filters');
    }

    const result = await DocumentService.getFollowUpsByUser(
      req.user!.id,
      parsed.data.query
    );

    return sendSuccess(res, result, 'Your follow-ups retrieved successfully');
  }),

  // ── Get Follow-Up by ID ──────────────────────────────────────────────────────

  getFollowUpById: asyncHandler(async (req: Request, res: Response) => {
    const result = followUpIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid follow-up ID');
    }

    const followUp = await DocumentService.getFollowUpById(result.data.params.followUpId);
    if (!followUp) {
      throw new AppError(404, 'Follow-up not found');
    }

    return sendSuccess(res, followUp, 'Follow-up retrieved successfully');
  }),

  // ── Get Follow-Up Thread ─────────────────────────────────────────────────────

  getFollowUpThread: asyncHandler(async (req: Request, res: Response) => {
    const result = followUpIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid follow-up ID');
    }

    const thread = await DocumentService.getFollowUpThread(result.data.params.followUpId);
    if (!thread) {
      throw new AppError(404, 'Follow-up not found');
    }

    return sendSuccess(res, thread, 'Follow-up thread retrieved successfully');
  }),

  // ── Update Follow-Up ─────────────────────────────────────────────────────────

  updateFollowUp: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = updateFollowUpSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid follow-up ID');
    }

    const bodyResult = updateFollowUpSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    }

    const updated = await DocumentService.updateFollowUp(
      paramsResult.data.followUpId,
      bodyResult.data,
      req.user!.id
    );

    safeBroadcast(req, 'follow_up_updated', updated);
    if (updated.assigned_to) {
      safeEmitToUser(req, updated.assigned_to, 'follow_up_updated', updated);
    }
    if (updated.document_id) {
      safeEmitToRoom(req, `document:${updated.document_id}`, 'follow_up_updated', updated);
    }

    return sendSuccess(res, updated, 'Follow-up updated successfully');
  }),

  // ── Complete Follow-Up ───────────────────────────────────────────────────────

  completeFollowUp: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = followUpIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid follow-up ID');
    }

    const bodyResult = completeFollowUpSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid completion data');
    }

    const completed = await DocumentService.completeFollowUp(
      paramsResult.data.params.followUpId,
      req.user!.id,
      bodyResult.data.body
    );

    safeBroadcast(req, 'follow_up_completed', completed);
    if (completed.assigned_to) {
      safeEmitToUser(req, completed.assigned_to, 'follow_up_completed', completed);
    }
    if (completed.document_id) {
      safeEmitToRoom(req, `document:${completed.document_id}`, 'follow_up_completed', completed);
    }

    return sendSuccess(res, completed, 'Follow-up completed successfully');
  }),

  // ── Cancel Follow-Up ─────────────────────────────────────────────────────────

  cancelFollowUp: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = followUpIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid follow-up ID');
    }

    const bodyResult = cancelFollowUpSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid cancellation data');
    }

    const cancelled = await DocumentService.cancelFollowUp(
      paramsResult.data.params.followUpId,
      req.user!.id,
      bodyResult.data.body
    );

    safeBroadcast(req, 'follow_up_cancelled', cancelled);
    if (cancelled.assigned_to) {
      safeEmitToUser(req, cancelled.assigned_to, 'follow_up_cancelled', cancelled);
    }
    if (cancelled.document_id) {
      safeEmitToRoom(req, `document:${cancelled.document_id}`, 'follow_up_cancelled', cancelled);
    }

    return sendSuccess(res, cancelled, 'Follow-up cancelled successfully');
  }),

  // ── Add Follow-Up Comment ───────────────────────────────────────────────────

  addFollowUpComment: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = addFollowUpCommentSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid follow-up ID');
    }

    const bodyResult = addFollowUpCommentSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid comment data');
    }

    const comment = await DocumentService.addFollowUpComment(
      paramsResult.data.followUpId,
      bodyResult.data,
      req.user!.id,
      req.file
    );

    safeBroadcast(req, 'follow_up_comment_added', comment);
    if (comment.follow_up_id) {
      const followUp = await DocumentService.getFollowUpById(comment.follow_up_id);
      if (followUp?.assigned_to) {
        safeEmitToUser(req, followUp.assigned_to, 'follow_up_comment_added', comment);
      }
    }

    return sendSuccess(res, comment, 'Comment added successfully', 201);
  }),

  // ── Get Follow-Up Comments ──────────────────────────────────────────────────

  getFollowUpComments: asyncHandler(async (req: Request, res: Response) => {
    const result = followUpIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid follow-up ID');
    }

    const comments = await DocumentService.getFollowUpComments(result.data.params.followUpId);
    return sendSuccess(res, comments, 'Comments retrieved successfully');
  }),
};