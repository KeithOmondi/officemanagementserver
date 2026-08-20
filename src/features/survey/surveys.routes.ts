// src/features/surveys/surveys.routes.ts

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { SurveyController } from './surveys.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// Anonymous public submissions are the abuse surface here — throttle per IP.
// Tune window/max to expected ServiceWeek traffic; consider adding a honeypot
// field check in the controller/service too.
const publicSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many submissions from this address, please try again later' },
});

// ---- PUBLIC (no auth, no session) — mount these BEFORE any router-level requireAuth ----

// Public routes use permanent_slug - this NEVER changes
router.get('/public/:permanentSlug', SurveyController.getPublicSurvey);
router.post('/public/:permanentSlug/responses', publicSubmitLimiter, SurveyController.submitPublicResponse);

// Draft endpoints - also public (no auth)
router.get('/public/:permanentSlug/draft', SurveyController.getDraft);
router.post('/public/:permanentSlug/draft', SurveyController.saveDraft);
router.delete('/public/:permanentSlug/draft', SurveyController.deleteDraft);

// ---- ADMIN — everything below requires auth ----

router.use(protect);

router.post('/', requireRole('staff', 'super_admin'), SurveyController.create);
router.get('/', requireRole('staff', 'super_admin'), SurveyController.list);
router.get('/:id', requireRole('staff', 'super_admin'), SurveyController.getById);
router.patch('/:id', requireRole('staff', 'super_admin'), SurveyController.update);
router.delete('/:id', requireRole('staff', 'super_admin'), SurveyController.remove);

router.get('/:id/responses', requireRole('staff', 'super_admin'), SurveyController.responses);
router.get('/:id/export/excel', requireRole('staff', 'super_admin'), SurveyController.exportExcel);
router.get('/:id/export/word', requireRole('staff', 'super_admin'), SurveyController.exportWord);

export default router;