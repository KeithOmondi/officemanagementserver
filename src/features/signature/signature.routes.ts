// src/features/users/signature.routes.ts
import { Router } from 'express';
import { protect, requireRole } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload';
import { signatureController } from './signature.controller';

const router = Router();
router.use(protect);
// src/features/users/signature.routes.ts
router.post('/me/signature', requireRole('super_admin'), upload.single('signature'), signatureController.uploadSignature);
router.delete('/me/signature', requireRole('super_admin'), signatureController.deleteSignature);
export default router;