import { Router } from 'express';
import { aiReportsController } from './ai-reports.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/', aiReportsController.getAllReports);
router.get('/:id', aiReportsController.getReportById);
router.post('/generate', requireRole('dept_head', 'super_admin'), aiReportsController.generateMonthly);
router.put('/:id/approve', requireRole('super_admin'), aiReportsController.approveReport);

export default router;