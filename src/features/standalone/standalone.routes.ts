// src/features/standalone/standalone.routes.ts
import { Router } from 'express';
import { standaloneTaskController } from './standalone.controller';
import { protect, requireSuperAdmin } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload';

const router = Router();

// ─── All routes require authentication ───────────────────────────────────────
router.use(protect);

// ═══════════════════════════════════════════════════════════════════════════════
//  TASK ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router
    .route('/tasks')
    // GET /api/standalone/tasks - Get all tasks with filters
    // All authenticated users can view tasks (filtered by permissions in service)
    .get(standaloneTaskController.getAllTasks)
    // POST /api/standalone/tasks - Create a new task
    // Only super_admin can create standalone tasks
    .post(requireSuperAdmin, standaloneTaskController.createTask);

// GET /api/standalone/tasks/stats - Get task statistics
// All authenticated users can view stats (filtered by permissions in service)
router.get('/tasks/stats', standaloneTaskController.getTaskStats);

router
    .route('/tasks/:id')
    // GET /api/standalone/tasks/:id - Get a single task
    // All authenticated users can view if they have permission (checked in controller)
    .get(standaloneTaskController.getTaskById)
    // PATCH /api/standalone/tasks/:id - Update a task
    // Super_admin or creator can update (checked in controller)
    .patch(standaloneTaskController.updateTask)
    // DELETE /api/standalone/tasks/:id - Delete a task (soft delete)
    // Only super_admin can delete
    .delete(requireSuperAdmin, standaloneTaskController.deleteTask);

// PATCH /api/standalone/tasks/:id/status - Update task status
// Assignee, creator, or super_admin can update status (checked in controller)
router.patch('/tasks/:id/status', standaloneTaskController.updateTaskStatus);

// POST /api/standalone/tasks/:id/archive - Archive a task
// Assignee or super_admin can archive (checked in controller)
router.post('/tasks/:id/archive', standaloneTaskController.archiveTask);

// POST /api/standalone/tasks/:id/unarchive - Unarchive a task
// Only super_admin can unarchive
router.post('/tasks/:id/unarchive', requireSuperAdmin, standaloneTaskController.unarchiveTask);

// GET /api/standalone/tasks/:id/history - Get task history
// All authenticated users can view if they have permission (checked in controller)
router.get('/tasks/:id/history', standaloneTaskController.getTaskHistory);

// POST /api/standalone/tasks/:id/recurring - Generate recurring tasks
// Only super_admin can generate recurring tasks
router.post('/tasks/:id/recurring', requireSuperAdmin, standaloneTaskController.generateRecurringTasks);

// GET /api/standalone/tasks/:id/permissions - Check user permissions for a task
// All authenticated users can check their own permissions
router.get('/tasks/:id/permissions', standaloneTaskController.checkPermissions);

// ═══════════════════════════════════════════════════════════════════════════════
//  SUBTASK ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router
    .route('/tasks/:taskId/subtasks')
    // POST /api/standalone/tasks/:taskId/subtasks - Create a subtask
    // Super_admin or creator can add subtasks (checked in controller)
    .post(standaloneTaskController.createSubtask);

router
    .route('/tasks/:taskId/subtasks/:subtaskId')
    // PATCH /api/standalone/tasks/:taskId/subtasks/:subtaskId - Update a subtask
    // Super_admin or creator can update subtasks (checked in controller)
    .patch(standaloneTaskController.updateSubtask)
    // DELETE /api/standalone/tasks/:taskId/subtasks/:subtaskId - Delete a subtask
    // Super_admin or creator can delete subtasks (checked in controller)
    .delete(standaloneTaskController.deleteSubtask);

// ═══════════════════════════════════════════════════════════════════════════════
//  COMMENT ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router
    .route('/tasks/:taskId/comments')
    // POST /api/standalone/tasks/:taskId/comments - Create a comment
    // Anyone who can view the task can comment (checked in controller)
    .post(standaloneTaskController.createComment);

router
    .route('/tasks/:taskId/comments/:commentId')
    // PATCH /api/standalone/tasks/:taskId/comments/:commentId - Update a comment
    // Only the comment author can update (checked in controller)
    .patch(standaloneTaskController.updateComment)
    // DELETE /api/standalone/tasks/:taskId/comments/:commentId - Delete a comment
    // Comment author or super_admin can delete (checked in controller)
    .delete(standaloneTaskController.deleteComment);

// ═══════════════════════════════════════════════════════════════════════════════
//  ATTACHMENT ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/standalone/tasks/:taskId/attachments - Upload an attachment
// Super_admin or creator can upload attachments (checked in controller)
router.post(
    '/tasks/:taskId/attachments',
    upload.single('file'),
    standaloneTaskController.createAttachment
);

// DELETE /api/standalone/tasks/:taskId/attachments/:attachmentId - Delete an attachment
// Super_admin or creator can delete attachments (checked in controller)
router.delete(
    '/tasks/:taskId/attachments/:attachmentId',
    standaloneTaskController.deleteAttachment
);

export default router;