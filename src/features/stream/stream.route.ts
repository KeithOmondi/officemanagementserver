// src/features/stream/stream.route.ts
import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware';
import { streamFile } from './streamFile';

const router = Router();

/**
 * GET /api/stream?url=<encoded_cloudinary_url>
 * Protected — any authenticated role can attempt; authorization is
 * enforced inside the controller against the documents table.
 */
router.get('/', protect, streamFile);

export default router;