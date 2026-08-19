import { Router } from 'express';
import { joController } from './jo.controller';
import { upload } from '../../middleware/upload';
import { protect } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect); // any authenticated user; role-specific checks happen in the controller/service

/**
 * @route   GET /api/jo
 * @desc    List documents. Non-super-admins see only their own uploads.
 *          Super admins see the review queue (drafts excluded) unless ?mine=true.
 * @query   status, department_id, mine, assigned_to_me, search, page, limit, sort_by, sort_order
 */
router.get('/', joController.getAll);

/**
 * @route   POST /api/jo
 * @desc    Upload a new document (draft or sent immediately)
 * @body    multipart/form-data: file + { title, department_id?, is_draft? }
 */
router.post('/', upload.single('file'), joController.create);

/**
 * @route   GET /api/jo/:id
 * @desc    Get a document with its full response thread
 */
router.get('/:id', joController.getById);

/**
 * @route   GET /api/jo/:id/flow
 * @desc    Get the audit trail (sent, approved, rejected, resubmitted)
 */
router.get('/:id/flow', joController.getFlowHistory);

/**
 * @route   PATCH /api/jo/:id
 * @desc    Edit a draft's title (owner only, draft-only)
 */
router.patch('/:id', joController.updateDraft);

/**
 * @route   PUT /api/jo/:id/file
 * @desc    Replace the file (owner only, draft or rejected only)
 */
router.put('/:id/file', upload.single('file'), joController.replaceFile);

/**
 * @route   POST /api/jo/:id/send
 * @desc    Send a draft to the super admin queue
 * @body    { assigned_to?, note? }
 */
router.post('/:id/send', joController.sendToSuperAdmin);

/**
 * @route   POST /api/jo/:id/respond
 * @desc    Add a message to the chat thread (owner or super admin)
 * @body    { note }
 */
router.post('/:id/respond', joController.respond);

/**
 * @route   POST /api/jo/:id/approve
 * @desc    Approve the document
 * @access  Super admin only
 */
router.post('/:id/approve', joController.approve);

/**
 * @route   POST /api/jo/:id/reject
 * @desc    Reject the document with a required reason
 * @access  Super admin only
 * @body    { reason }
 */
router.post('/:id/reject', joController.reject);

/**
 * @route   POST /api/jo/:id/resubmit
 * @desc    Resubmit a rejected document (owner only)
 * @body    { note? }
 */
router.post('/:id/resubmit', joController.resubmit);

/**
 * @route   DELETE /api/jo/:id
 * @desc    Delete a draft (owner only, draft-only)
 */
router.delete('/:id', joController.deleteDraft);

export default router;