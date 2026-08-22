// src/features/projects/projects.routes.ts
import { Router } from 'express';
import { projectController } from './projects.controller';
import { protect } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload';

const router = Router();

router.use(protect);

// ═══════════════════════════════════════════════════════════════════════════
//  TASK ROUTES - Must be before /:id project routes
// ═══════════════════════════════════════════════════════════════════════════

// ─── Read ────────────────────────────────────────────────────────────────────
router.get('/tasks', projectController.getAllTasks);
router.get('/tasks/stats', projectController.getTaskStats);
router.get('/tasks/overdue', projectController.getOverdueTasks);
router.get('/tasks/assigned/:assigneeId', projectController.getTasksByAssignee);
router.get('/tasks/by-status', projectController.getTasksByStatus);
router.get('/tasks/:id', projectController.getTaskById);

// ─── Create ──────────────────────────────────────────────────────────────────
router.post('/tasks', projectController.createTask);

// ─── Update ──────────────────────────────────────────────────────────────────
router.put('/tasks/:id', projectController.updateTask);
router.patch('/tasks/:id', projectController.updateTask);

// ─── Bulk Update ─────────────────────────────────────────────────────────────
router.patch('/tasks/bulk', projectController.bulkUpdateTasks);

// ─── Delete ──────────────────────────────────────────────────────────────────
router.delete('/tasks/:id', projectController.deleteTask);

// ─── Subtask Routes ──────────────────────────────────────────────────────────

router.post('/tasks/:taskId/subtasks', projectController.createSubtask);
router.put('/tasks/:taskId/subtasks/:subtaskId', projectController.updateSubtask);
router.patch('/tasks/:taskId/subtasks/:subtaskId', projectController.updateSubtask);
router.delete('/tasks/:taskId/subtasks/:subtaskId', projectController.deleteSubtask);

// ─── Comment Routes ──────────────────────────────────────────────────────────

router.post('/tasks/:taskId/comments', projectController.createComment);
router.put('/tasks/:taskId/comments/:commentId', projectController.updateComment);
router.patch('/tasks/:taskId/comments/:commentId', projectController.updateComment);
router.delete('/tasks/:taskId/comments/:commentId', projectController.deleteComment);

// ─── File Upload Routes ──────────────────────────────────────────────────────

// Upload file to a task
router.post(
    '/tasks/:taskId/files',
    upload.single('file'),
    projectController.uploadFile
);

// Delete file
router.delete('/files/:fileId', projectController.deleteFile);

// ═══════════════════════════════════════════════════════════════════════════
//  PROJECT ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ─── Read ────────────────────────────────────────────────────────────────────
router.get('/', projectController.getAllProjects);
router.get('/:id', projectController.getProjectById);
router.get('/:id/members', projectController.getProjectMembers);

// ─── Create ──────────────────────────────────────────────────────────────────
router.post('/', projectController.createProject);

// ─── Update ──────────────────────────────────────────────────────────────────
router.put('/:id', projectController.updateProject);
router.patch('/:id', projectController.updateProject);

// ─── Delete ──────────────────────────────────────────────────────────────────
router.delete('/:id', projectController.deleteProject);

// ─── Members ──────────────────────────────────────────────────────────────────
router.post('/:id/members', projectController.addProjectMember);
router.delete('/:id/members/:userId', projectController.removeProjectMember);

export default router;