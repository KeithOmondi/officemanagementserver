// src/features/messages/messages.routes.ts

import { Router } from 'express';
import { messagesController } from './messages.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ─── Groups ──────────────────────────────────────────────────────────────────
router.get('/groups',        messagesController.getAllGroups);
router.get('/groups/:id',    messagesController.getGroupById);
router.post('/groups',       requireRole('dept_head', 'super_admin'), messagesController.createGroup);
router.put('/groups/:id',    requireRole('dept_head', 'super_admin'), messagesController.updateGroup);
router.delete('/groups/:id', requireRole('super_admin'),              messagesController.deleteGroup);

// ─── Group Members ────────────────────────────────────────────────────────────
router.get('/groups/:id/members',             messagesController.getGroupMembers);
router.post('/groups/:id/members',            requireRole('dept_head', 'super_admin'), messagesController.addGroupMembers);
router.delete('/groups/:id/members/:userId',  requireRole('dept_head', 'super_admin'), messagesController.removeGroupMember);

// ─── Message Status (must come BEFORE /:id to avoid param conflicts) ─────────
router.get('/unread',          messagesController.getUnreadCount);
router.put('/read/all',        messagesController.markAllRead);
router.put('/read/multiple',   messagesController.markMultipleAsRead); // Bulk mark as read

// ─── Conversations ────────────────────────────────────────────────────────────
router.get('/conversations',       messagesController.getConversationsList); // Get all conversations
router.get('/conversation/:userId', messagesController.getConversation); // Get DM conversation

// ─── Messages ─────────────────────────────────────────────────────────────────
router.get('/',  messagesController.getMessages);
router.post('/', messagesController.sendMessage);

// ─── Per-message actions ──────────────────────────────────────────────────────
router.put('/:id/edit',    messagesController.editMessage); // Edit message
router.delete('/:id',      messagesController.deleteMessage); // Delete message
router.put('/:id/read',    messagesController.markAsRead);
router.put('/:id/archive', messagesController.archiveMessage);

export default router;