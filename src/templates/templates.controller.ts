// src/modules/templates/templates.controller.ts
import { Request, Response } from 'express';
import { TemplatesService } from './templates.service';
import { uploadTemplateSchema, templateFiltersSchema, templateIdSchema } from './templates.validator';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';

export const templatesController = {

  upload: asyncHandler(async (req: Request, res: Response) => {
    console.log(`[TemplatesController] upload started`);
    console.log(`[TemplatesController] Body:`, req.body);
    console.log(`[TemplatesController] File:`, req.file?.originalname);

    const file = req.file;
    if (!file) {
      throw new AppError(400, 'A .docx file is required');
    }

    const result = uploadTemplateSchema.safeParse({ body: req.body });
    if (!result.success) {
      console.error(`[TemplatesController] Validation error:`, result.error.issues);
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
    }

    const template = await TemplatesService.uploadTemplate(
      file, 
      result.data.body, 
      req.user!.id
    );
    
    console.log(`[TemplatesController] Upload successful: ${template.id}`);
    return sendSuccess(res, template, 'Template uploaded and activated', 201);
  }),

  getAll: asyncHandler(async (req: Request, res: Response) => {
    console.log(`[TemplatesController] getAll started`);
    console.log(`[TemplatesController] Query:`, req.query);

    const result = templateFiltersSchema.safeParse({ query: req.query });
    if (!result.success) {
      console.error(`[TemplatesController] Validation error:`, result.error.issues);
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    }
    
    const templates = await TemplatesService.findAll(result.data.query);
    console.log(`[TemplatesController] Found ${templates.length} templates`);
    
    // Log each template for debugging
    templates.forEach(t => {
      console.log(`  Template: ${t.id} | ${t.type} | dept: ${t.department_id || 'global'} | active: ${t.is_active}`);
    });

    return sendSuccess(res, templates, 'Templates retrieved');
  }),

  getActive: asyncHandler(async (req: Request, res: Response) => {
    console.log(`[TemplatesController] getActive started`);
    console.log(`[TemplatesController] Query:`, req.query);

    const type = req.query.type as 'memo' | 'letter';
    if (!type) {
      throw new AppError(400, 'type is required');
    }
    
    const departmentId = (req.query.department_id as string) || null;
    console.log(`[TemplatesController] Looking for: type=${type}, department=${departmentId || 'global'}`);

    const template = await TemplatesService.getActive(type, departmentId);
    
    if (template) {
      console.log(`[TemplatesController] Found template: ${template.id}`);
    } else {
      console.log(`[TemplatesController] No template found`);
    }

    return sendSuccess(res, { template }, 'Active template retrieved');
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    console.log(`[TemplatesController] delete started`);
    console.log(`[TemplatesController] Params:`, req.params);

    const result = templateIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      console.error(`[TemplatesController] Validation error:`, result.error.issues);
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }
    
    await TemplatesService.delete(result.data.params.id);
    console.log(`[TemplatesController] Template ${result.data.params.id} deleted`);
    
    return sendSuccess(res, null, 'Template deleted');
  }),
};