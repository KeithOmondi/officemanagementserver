// src/features/tasks/tasks.routes.ts
import { Router } from 'express';
import { taskController } from './tasks.controller';
import { protect } from '../../middleware/auth.middleware';
import { uploadBulkEvidence } from '../../middleware/upload';

const router = Router();

router.use(protect);

// ─── STATIC ROUTES FIRST (no dynamic :id parameters) ──────────────────────
router.get('/summary', taskController.getTaskSummary);                    // GET /api/v1/tasks/summary
router.get('/timeline', taskController.getTaskTimeline);                  // GET /api/v1/tasks/timeline
router.get('/analytics', taskController.getTaskAnalytics);                // GET /api/v1/tasks/analytics

// ─── Search, Export, Import ────────────────────────────────────────────────
router.post('/search', taskController.searchTasks);                       // POST /api/v1/tasks/search
router.post('/export', taskController.exportTasks);                       // POST /api/v1/tasks/export
router.post('/import', taskController.importTasks);                       // POST /api/v1/tasks/import

// ─── Bulk Operations ──────────────────────────────────────────────────────
router.post('/bulk/update', taskController.bulkUpdateTasks);              // POST /api/v1/tasks/bulk/update
router.post('/bulk/action', taskController.bulkAction);                   // POST /api/v1/tasks/bulk/action
router.post('/bulk/subtasks', taskController.bulkUpdateSubtasks);         // POST /api/v1/tasks/bulk/subtasks

// ─── Task List Routes ──────────────────────────────────────────────────────
router.get('/lists', taskController.getAllTaskLists);                     // GET /api/v1/tasks/lists
router.get('/lists/:id', taskController.getTaskListById);                 // GET /api/v1/tasks/lists/:id
router.get('/lists/:id/members', taskController.getListMembers);          // GET /api/v1/tasks/lists/:id/members
router.post('/lists', taskController.createTaskList);                     // POST /api/v1/tasks/lists
router.put('/lists/:id', taskController.updateTaskList);                  // PUT /api/v1/tasks/lists/:id
router.patch('/lists/:id', taskController.updateTaskList);                // PATCH /api/v1/tasks/lists/:id
router.delete('/lists/:id', taskController.deleteTaskList);               // DELETE /api/v1/tasks/lists/:id
router.post('/lists/:id/members', taskController.addMembersToList);       // POST /api/v1/tasks/lists/:id/members
router.put('/lists/:id/members/:userId', taskController.updateListMember); // PUT /api/v1/tasks/lists/:id/members/:userId
router.delete('/lists/:id/members/:userId', taskController.removeMemberFromList); // DELETE /api/v1/tasks/lists/:id/members/:userId

// ─── Subtask Routes (more specific than plain /:id) ──────────────────────
router.post('/:taskId/subtasks', taskController.createSubtask);           // POST /api/v1/tasks/:taskId/subtasks
router.put('/:taskId/subtasks/:subtaskId', taskController.updateSubtask); // PUT /api/v1/tasks/:taskId/subtasks/:subtaskId
router.patch('/:taskId/subtasks/:subtaskId', taskController.updateSubtask); // PATCH /api/v1/tasks/:taskId/subtasks/:subtaskId
router.delete('/:taskId/subtasks/:subtaskId', taskController.deleteSubtask); // DELETE /api/v1/tasks/:taskId/subtasks/:subtaskId
router.post('/:taskId/subtasks/bulk', taskController.bulkUpdateSubtasks); // POST /api/v1/tasks/:taskId/subtasks/bulk

// ─── Comment Routes ──────────────────────────────────────────────────────
router.get('/:taskId/comments', taskController.getTaskComments);          // GET /api/v1/tasks/:taskId/comments
router.post('/:taskId/comments', taskController.createComment);           // POST /api/v1/tasks/:taskId/comments
router.put('/comments/:id', taskController.updateComment);                // PUT /api/v1/tasks/comments/:id
router.patch('/comments/:id', taskController.updateComment);              // PATCH /api/v1/tasks/comments/:id
router.delete('/comments/:id', taskController.deleteComment);             // DELETE /api/v1/tasks/comments/:id

// ─── Reminder Routes ──────────────────────────────────────────────────────
router.get('/:taskId/reminders', taskController.getTaskReminders);        // GET /api/v1/tasks/:taskId/reminders
router.post('/reminders', taskController.createReminder);                 // POST /api/v1/tasks/reminders
router.put('/reminders/:id', taskController.updateReminder);              // PUT /api/v1/tasks/reminders/:id
router.patch('/reminders/:id', taskController.updateReminder);            // PATCH /api/v1/tasks/reminders/:id
router.delete('/reminders/:id', taskController.deleteReminder);           // DELETE /api/v1/tasks/reminders/:id

// ─── Tag Routes ──────────────────────────────────────────────────────────
router.get('/tags', taskController.getAllTags);                           // GET /api/v1/tasks/tags
router.get('/tags/:id', taskController.getTagById);                       // GET /api/v1/tasks/tags/:id
router.post('/tags', taskController.createTag);                           // POST /api/v1/tasks/tags
router.put('/tags/:id', taskController.updateTag);                        // PUT /api/v1/tasks/tags/:id
router.patch('/tags/:id', taskController.updateTag);                      // PATCH /api/v1/tasks/tags/:id
router.delete('/tags/:id', taskController.deleteTag);                     // DELETE /api/v1/tasks/tags/:id

// ─── Dependency Routes ──────────────────────────────────────────────────
router.get('/:taskId/dependencies', taskController.getTaskDependencies);  // GET /api/v1/tasks/:taskId/dependencies
router.post('/dependencies', taskController.createDependency);            // POST /api/v1/tasks/dependencies
router.delete('/dependencies/:id', taskController.deleteDependency);      // DELETE /api/v1/tasks/dependencies/:id

// ─── Recurrence Routes ──────────────────────────────────────────────────
router.put('/:taskId/recurrence', taskController.updateRecurrence);       // PUT /api/v1/tasks/:taskId/recurrence
router.patch('/:taskId/recurrence', taskController.updateRecurrence);     // PATCH /api/v1/tasks/:taskId/recurrence
router.delete('/:taskId/recurrence', taskController.deleteRecurrence);    // DELETE /api/v1/tasks/:taskId/recurrence

// ─── Move & Copy Routes ──────────────────────────────────────────────────
router.patch('/:id/move', taskController.moveTask);                       // PATCH /api/v1/tasks/:id/move
router.post('/:id/copy', taskController.copyTask);                        // POST /api/v1/tasks/:id/copy

// ─── Attachment Routes ──────────────────────────────────────────────────
router.get('/:taskId/attachments', taskController.getTaskAttachments);    // GET /api/v1/tasks/:taskId/attachments
router.post('/:taskId/attachments', 
  uploadBulkEvidence, 
  taskController.uploadAttachments
);                                                                        // POST /api/v1/tasks/:taskId/attachments
router.delete('/attachments/:attachmentId', taskController.deleteAttachment); // DELETE /api/v1/tasks/attachments/:attachmentId

// ─── Toggle Status (specific route – must come BEFORE /:id) ──────────────
router.patch('/:id/status', taskController.toggleTaskStatus);             // PATCH /api/v1/tasks/:id/status

// ─── Notification Routes ──────────────────────────────────────────────────
router.get('/notifications', taskController.getNotifications);            // GET /api/v1/tasks/notifications
router.patch('/notifications/read-all', taskController.markAllNotificationsRead); // PATCH /api/v1/tasks/notifications/read-all
router.patch('/notifications/:id/read', taskController.markNotificationRead); // PATCH /api/v1/tasks/notifications/:id/read
router.delete('/notifications/:id', taskController.deleteNotification);   // DELETE /api/v1/tasks/notifications/:id

// ─── Activity Events ──────────────────────────────────────────────────────
router.get('/events', taskController.getTaskEvents);                      // GET /api/v1/tasks/events

// ─── Dynamic Task Routes (must come LAST) ──────────────────────────────────
router.get('/', taskController.getAllTasks);                              // GET /api/v1/tasks
router.get('/:id', taskController.getTaskById);                           // GET /api/v1/tasks/:id
router.post('/', taskController.createTask);                              // POST /api/v1/tasks
router.put('/:id', taskController.updateTask);                            // PUT /api/v1/tasks/:id
router.patch('/:id', taskController.updateTask);                          // PATCH /api/v1/tasks/:id
router.delete('/:id', taskController.deleteTask);                         // DELETE /api/v1/tasks/:id

export default router;