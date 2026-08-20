// src/features/surveys/surveys.controller.ts

import type { Request, Response, NextFunction } from 'express';
import { SurveyService } from './surveys.service';
import { SurveyExportService } from './surveys.export.service';
import { 
  createSurveySchema, 
  updateSurveySchema, 
  submitResponseSchema, 
  saveDraftSchema,
  validateBody 
} from './surveys.validator';
import { AppError } from '../../utils/response';

// Adjust to match the shape your actual auth middleware attaches to req.user.
type AuthedRequest = Request & { user: { id: string; role?: string } };

// If OFFICE_SYSTEM already has a shared asyncHandler/express-async-errors setup,
// swap this out for that instead — this is a drop-in local equivalent so thrown
// AppErrors reach your existing centralized error-handling middleware.
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

// Mirrors the helper in tasks.controller.ts — Express params can type as
// string | string[] depending on route pattern / @types version, so every
// raw req.params access gets narrowed through here before hitting a service.
const getParamAsString = (param: string | string[] | undefined): string | undefined => {
  if (!param) return undefined;
  return Array.isArray(param) ? param[0] : param;
};

const requireParam = (param: string | string[] | undefined, name: string): string => {
  const value = getParamAsString(param);
  if (!value) throw new AppError(400, `${name} is required`);
  return value;
};

// Helper to get client IP from request
const getClientIp = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
         req.socket?.remoteAddress || 
         req.ip || 
         'unknown';
};

export class SurveyController {
  // ---- ADMIN (mount behind requireAuth/requireRole in surveys.routes.ts) ----

  static create = asyncHandler(async (req, res) => {
    const input = validateBody(createSurveySchema, req.body);
    const survey = await SurveyService.create(input, (req as AuthedRequest).user.id);
    res.status(201).json(survey);
  });

  static list = asyncHandler(async (_req, res) => {
    const surveys = await SurveyService.findAll();
    res.json(surveys);
  });

  static getById = asyncHandler(async (req, res) => {
    const id = requireParam(req.params.id, 'Survey ID');
    const survey = await SurveyService.getForAdmin(id, (req as AuthedRequest).user);
    res.json(survey);
  });

  static update = asyncHandler(async (req, res) => {
    const id = requireParam(req.params.id, 'Survey ID');
    const input = validateBody(updateSurveySchema, req.body);
    const survey = await SurveyService.update(id, input, (req as AuthedRequest).user);
    res.json(survey);
  });

  static remove = asyncHandler(async (req, res) => {
    const id = requireParam(req.params.id, 'Survey ID');
    await SurveyService.delete(id, (req as AuthedRequest).user);
    res.status(204).send();
  });

  static responses = asyncHandler(async (req, res) => {
    const id = requireParam(req.params.id, 'Survey ID');
    const responses = await SurveyService.getResponses(id, (req as AuthedRequest).user);
    res.json(responses);
  });

  static exportExcel = asyncHandler(async (req, res) => {
    const id = requireParam(req.params.id, 'Survey ID');
    const survey = await SurveyService.getForAdmin(id, (req as AuthedRequest).user);
    const responses = await SurveyService.getResponses(survey.id, (req as AuthedRequest).user);
    const buffer = await SurveyExportService.toExcelBuffer(survey, responses);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${survey.permanent_slug}-responses.xlsx"`);
    res.send(buffer);
  });

  static exportWord = asyncHandler(async (req, res) => {
    const id = requireParam(req.params.id, 'Survey ID');
    const survey = await SurveyService.getForAdmin(id, (req as AuthedRequest).user);
    const responses = await SurveyService.getResponses(survey.id, (req as AuthedRequest).user);
    const buffer = await SurveyExportService.toWordBuffer(survey, responses);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${survey.permanent_slug}-responses.docx"`);
    res.send(buffer);
  });

  // ---- PUBLIC (no auth, no session) ----

  static getPublicSurvey = asyncHandler(async (req, res) => {
    const permanentSlug = requireParam(req.params.permanentSlug, 'Survey permanent slug');
    const survey = await SurveyService.getPublicView(permanentSlug);
    res.json(survey);
  });

  static submitPublicResponse = asyncHandler(async (req, res) => {
    const permanentSlug = requireParam(req.params.permanentSlug, 'Survey permanent slug');
    const input = validateBody(submitResponseSchema, req.body);
    const ip = getClientIp(req);
    const response = await SurveyService.submitResponse(permanentSlug, input.response_data, ip);
    res.status(201).json({ message: 'Response submitted', id: response.id });
  });

  // ---- Draft Endpoints (no auth, no session) ----

static getDraft = asyncHandler(async (req, res) => {
  const permanentSlug = requireParam(req.params.permanentSlug, 'Survey permanent slug');
  const ip = getClientIp(req);
  const draft = await SurveyService.getDraft(permanentSlug, ip);
  
  // Don't return early - just send the response and return undefined
  if (!draft) {
    res.status(200).json({ draft_data: null });
    return;
  }
  res.json(draft);
});

  static saveDraft = asyncHandler(async (req, res) => {
    const permanentSlug = requireParam(req.params.permanentSlug, 'Survey permanent slug');
    const input = validateBody(saveDraftSchema, req.body);
    const ip = getClientIp(req);
    const draft = await SurveyService.saveDraft(permanentSlug, input.draft_data, ip);
    res.status(200).json({ message: 'Draft saved', id: draft.id });
  });

  static deleteDraft = asyncHandler(async (req, res) => {
    const permanentSlug = requireParam(req.params.permanentSlug, 'Survey permanent slug');
    const ip = getClientIp(req);
    await SurveyService.deleteDraft(permanentSlug, ip);
    res.status(204).send();
  });
}