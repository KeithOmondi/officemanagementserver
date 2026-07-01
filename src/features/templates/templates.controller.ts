// src/features/templates/templates.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { TemplateService } from './templates.service';
import {
  uploadTemplateSchema,
  getTemplateSchema,
  listForDepartmentSchema,
  globalTemplateSchema,
  templateIdSchema,
} from './templates.validator';

export const templateController = {

  upload: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw new AppError(400, 'A .docx file is required');

    const result = uploadTemplateSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');

    const tpl = await TemplateService.upload(
      result.data.params.departmentId,
      result.data.params.type,
      file,
      req.user!.id
    );
    return sendSuccess(res, tpl, 'Template uploaded successfully', 201);
  }),

  getActive: asyncHandler(async (req: Request, res: Response) => {
    const result = getTemplateSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid params');

    const tpl = await TemplateService.getActive(
      result.data.params.departmentId,
      result.data.params.type
    );
    return sendSuccess(res, tpl, 'Template retrieved successfully');
  }),

  listForDepartment: asyncHandler(async (req: Request, res: Response) => {
    const result = listForDepartmentSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid params');

    const templates = await TemplateService.listForDepartment(result.data.params.departmentId);
    return sendSuccess(res, templates, 'Templates retrieved successfully');
  }),

  listAllGrouped: asyncHandler(async (_req: Request, res: Response) => {
    const grouped = await TemplateService.listAllGrouped();
    return sendSuccess(res, grouped, 'Templates retrieved successfully');
  }),

  getHistory: asyncHandler(async (req: Request, res: Response) => {
    const result = getTemplateSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid params');

    const history = await TemplateService.getHistory(
      result.data.params.departmentId,
      result.data.params.type
    );
    return sendSuccess(res, history, 'Template history retrieved');
  }),

  deactivate: asyncHandler(async (req: Request, res: Response) => {
    const result = templateIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');

    await TemplateService.deactivate(result.data.params.id);
    return sendSuccess(res, null, 'Template deactivated successfully');
  }),

  // ── Global / default templates ──────────────────────────────────────────

  uploadGlobal: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw new AppError(400, 'A .docx file is required');

    const result = globalTemplateSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');

    const tpl = await TemplateService.upload(null, result.data.params.type, file, req.user!.id);
    return sendSuccess(res, tpl, 'Global template uploaded successfully', 201);
  }),

  getGlobalActive: asyncHandler(async (req: Request, res: Response) => {
    const result = globalTemplateSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid params');

    const tpl = await TemplateService.getActive(null, result.data.params.type);
    return sendSuccess(res, tpl, 'Global template retrieved successfully');
  }),

  getGlobalHistory: asyncHandler(async (req: Request, res: Response) => {
    const result = globalTemplateSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid params');

    const history = await TemplateService.getHistory(null, result.data.params.type);
    return sendSuccess(res, history, 'Global template history retrieved');
  }),
};