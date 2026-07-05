// src/modules/templates/templates.routes.ts
import { Router } from 'express';
import { templatesController } from './templates.controller';
import { protect, requireRole } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload';

const router = Router();

// All routes require authentication
router.use(protect);

// Get active template - department heads can access
router.get('/active', requireRole('dept_head'), templatesController.getActive);

// Get all templates - super admins and department heads can access
router.get('/', requireRole('super_admin', 'dept_head'), templatesController.getAll);

// Upload template - only super admins can upload
router.post('/', requireRole('super_admin'), upload.single('file'), templatesController.upload);

// Delete template - only super admins can delete
router.delete('/:id', requireRole('super_admin'), templatesController.delete);

export default router;