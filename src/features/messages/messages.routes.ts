import { Router } from 'express';
import { messagesController } from './messages.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ─── Groups ──────────────────────────────────────────────────────────────────
router.get('/groups',        messagesController.getAllGroups);
router.get('/groups/:id',    messagesController.getGroupById);
router.post('/groups',       requireRole(['dept_head', 'super_admin']), messagesController.createGroup);
router.put('/groups/:id',    requireRole(['dept_head', 'super_admin']), messagesController.updateGroup);
router.delete('/groups/:id', requireRole(['super_admin']),              messagesController.deleteGroup);

// ─── Group Members ────────────────────────────────────────────────────────────
router.get('/groups/:id/members',             messagesController.getGroupMembers);
router.post('/groups/:id/members',            requireRole(['dept_head', 'super_admin']), messagesController.addGroupMembers);
router.delete('/groups/:id/members/:userId',  requireRole(['dept_head', 'super_admin']), messagesController.removeGroupMember);

// ─── Message Status (must come BEFORE /:id to avoid param conflicts) ─────────
router.get('/unread',      messagesController.getUnreadCount);
router.put('/read/all',    messagesController.markAllRead);

// ─── NEW: Bidirectional DM conversation ──────────────────────────────────────
// GET /messages/conversation/:userId  → returns all DMs between current user and :userId
router.get('/conversation/:userId', messagesController.getConversation);

// ─── Messages ─────────────────────────────────────────────────────────────────
router.get('/',  messagesController.getMessages);
router.post('/', messagesController.sendMessage);

// ─── Per-message actions ──────────────────────────────────────────────────────
router.put('/:id/read',    messagesController.markAsRead);
router.put('/:id/archive', messagesController.archiveMessage);

export default router;