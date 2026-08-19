import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { JoService } from './jo.service';
import {
  createJoDocumentSchema,
  updateJoDocumentSchema,
  sendToSuperAdminSchema,
  respondToJoDocumentSchema,
  approveJoDocumentSchema,
  rejectJoDocumentSchema,
  resubmitJoDocumentSchema,
  joDocumentIdSchema,
  joDocumentFiltersSchema,
} from './jo.validator';

export const joController = {

  create: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw new AppError(400, 'A file is required to upload a document');
    const result = createJoDocumentSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');

    const doc = await JoService.create(result.data.body, file, req.user!.id, req.user!.full_name);
    return sendSuccess(res, doc, 'Document uploaded successfully', 201);
  }),

  updateDraft: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = updateJoDocumentSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = updateJoDocumentSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');

    const doc = await JoService.updateDraft(paramsResult.data.id, bodyResult.data, req.user!.id);
    return sendSuccess(res, doc, 'Draft updated successfully');
  }),

  replaceFile: asyncHandler(async (req: Request, res: Response) => {
    const result = joDocumentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const file = req.file;
    if (!file) throw new AppError(400, 'A file is required');

    const doc = await JoService.replaceFile(result.data.params.id, file, req.user!.id);
    return sendSuccess(res, doc, 'File replaced successfully');
  }),

  sendToSuperAdmin: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = sendToSuperAdminSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = sendToSuperAdminSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');

    const doc = await JoService.sendToSuperAdmin(paramsResult.data.id, bodyResult.data, req.user!.id);
    return sendSuccess(res, doc, 'Document sent to super admin');
  }),

  getAll: asyncHandler(async (req: Request, res: Response) => {
    const parsed = joDocumentFiltersSchema.safeParse({ query: req.query });
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid filters');

    const result = await JoService.findAll(parsed.data.query, req.user!.id, req.user!.role);
    return sendSuccess(res, result, 'Documents retrieved successfully');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const result = joDocumentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');

    const doc = await JoService.findByIdWithResponses(result.data.params.id);
    if (!doc) throw new AppError(404, 'Document not found');

    if (req.user!.role !== 'super_admin' && doc.uploaded_by !== req.user!.id) {
      throw new AppError(403, 'You do not have access to this document');
    }

    return sendSuccess(res, doc, 'Document retrieved successfully');
  }),

  getFlowHistory: asyncHandler(async (req: Request, res: Response) => {
    const result = joDocumentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const history = await JoService.getFlowHistory(result.data.params.id);
    return sendSuccess(res, history, 'Flow history retrieved');
  }),

  respond: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = respondToJoDocumentSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = respondToJoDocumentSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid response');

    const response = await JoService.addResponse(paramsResult.data.id, bodyResult.data, req.user!.id, req.user!.role);
    return sendSuccess(res, response, 'Response added successfully', 201);
  }),

  approve: asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role !== 'super_admin') throw new AppError(403, 'Only super admins can approve documents');
    const paramsResult = approveJoDocumentSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = approveJoDocumentSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');

    const doc = await JoService.approve(paramsResult.data.id, bodyResult.data, req.user!.id, req.user!.full_name);
    return sendSuccess(res, doc, 'Document approved');
  }),

  reject: asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role !== 'super_admin') throw new AppError(403, 'Only super admins can reject documents');
    const paramsResult = rejectJoDocumentSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = rejectJoDocumentSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'A rejection reason is required');

    const doc = await JoService.reject(paramsResult.data.id, bodyResult.data, req.user!.id, req.user!.full_name);
    return sendSuccess(res, doc, 'Document rejected');
  }),

  resubmit: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = resubmitJoDocumentSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = resubmitJoDocumentSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');

    const doc = await JoService.resubmit(paramsResult.data.id, bodyResult.data, req.user!.id);
    return sendSuccess(res, doc, 'Document resubmitted for review');
  }),

  deleteDraft: asyncHandler(async (req: Request, res: Response) => {
    const result = joDocumentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    await JoService.deleteDraft(result.data.params.id, req.user!.id);
    return sendSuccess(res, null, 'Draft deleted successfully');
  }),
};