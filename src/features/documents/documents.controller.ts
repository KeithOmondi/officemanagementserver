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
    // signature_placement is no longer used – signature placement is auto-detected
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

    // Check if document is memo or letter and user is super admin for editing extra fields
    const doc = await DocumentService.findById(paramsResult.data.params.id);
    if (!doc) throw new AppError(404, 'Document not found');
    
    // Check if the update contains memo/letter specific fields (excluding signature placement)
    const hasMemoFields = 
      bodyResult.data.body.to_recipient !== undefined ||
      bodyResult.data.body.from_sender !== undefined ||
      bodyResult.data.body.document_date !== undefined ||
      bodyResult.data.body.subject !== undefined ||
      bodyResult.data.body.cc !== undefined ||
      bodyResult.data.body.enclosures !== undefined ||
      bodyResult.data.body.signature_name !== undefined ||
      bodyResult.data.body.signature_title !== undefined;
    
    // If editing memo/letter specific fields, only super admin can do it
    if (hasMemoFields && (doc.type === 'memo' || doc.type === 'letter')) {
      if (req.user!.role !== 'super_admin') {
        throw new AppError(403, 'Only super administrators can edit memo and letter fields (TO, FROM, DATE, SUBJECT, CC, ENCLOSURES, SIGNATURE, SIGNATURE PLACEMENT)');
      }
    }

    const updated = await DocumentService.update(paramsResult.data.params.id, bodyResult.data.body);
    return sendSuccess(res, updated, 'Document updated successfully');
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
    await DocumentService.requestSignOtp(result.data.params.id, req.user!.id);
    return sendSuccess(res, null, 'OTP sent to your email');
  }),

  sign: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = documentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');

    // Validate OTP
    const otp = req.body?.otp as string | undefined;
    if (!otp) throw new AppError(400, 'OTP is required');
    if (!/^\d{6}$/.test(otp)) throw new AppError(400, 'OTP must be exactly 6 digits');

    // We need to know the document TYPE before deciding whether to honor a
    // frontend-supplied position. Memo/letter documents are always PDFs
    // generated server-side from LetterTemplate.ts/MemoTemplate.ts, which
    // embed an invisible SIGNATURE_ANCHOR_TEXT marker immediately above the
    // real signatory block. That anchor is measured directly against the
    // ACTUAL rendered PDF (via pdfjs text extraction in embedSignature.ts),
    // so it is always more accurate than a client-side guess.
    //
    // The frontend's signature box position, by contrast, is measured
    // against a separate React/Tailwind preview component (LetterDisplay/
    // MemoDisplay) that uses different padding, font sizes, and a
    // non-fixed footer compared to the real PDF layout (which has a
    // `position: fixed` footer pinned near the bottom). That mismatch is
    // what was causing signatures to land near/inside the footer instead
    // of above the signatory name — the custom-position branch in
    // DocumentService.sign() was always winning because the frontend
    // ALWAYS sends position_x/position_y (auto-computed the moment the
    // signature box appears, not just when the user manually drags it),
    // so the anchor-based auto-detection never got a chance to run.
    //
    // Fix: only trust a frontend-supplied position for document types that
    // don't have a reliable server-rendered anchor to fall back on (i.e.
    // genuinely uploaded PDFs). For memo/letter, always ignore any position
    // sent from the client and let DocumentService.sign() use anchor-based
    // auto-detection instead.
    const doc = await DocumentService.findById(paramsResult.data.params.id);
    if (!doc) throw new AppError(404, 'Document not found');

    const isTemplatedDocument = doc.type === 'memo' || doc.type === 'letter';

    // Get position data from request body (sent from frontend)
    const positionX = req.body?.position_x as number | undefined;
    const positionY = req.body?.position_y as number | undefined;
    const positionWidth = req.body?.position_width as number | undefined;
    const positionHeight = req.body?.position_height as number | undefined;

    // Only persist/honor a custom position for non-templated (i.e. uploaded)
    // documents. Templated memo/letter PDFs always rely on the more
    // accurate anchor-based auto-detection in DocumentService.sign().
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

    // Sign the document (the service will use the position from the document,
    // or fall back to anchor-based auto-detection if none was persisted above)
    const signedDoc = await DocumentService.sign(paramsResult.data.params.id, req.user!.id, otp);
    return sendSuccess(res, signedDoc, 'Document signed successfully. Ready for release.');
  }),

  // ── Release Document (Super Admin only) ──────────────────────────────────────

  releaseDocument: asyncHandler(async (req: Request, res: Response) => {
    // Only Super Admin can release documents
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
    return sendSuccess(res, doc, 'Document PDF regenerated successfully');
  }),
};