// src/features/projects/projects.routes.ts
import { Router } from 'express';
import { projectController } from './projects.controller';
import { protect } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// ─── Task Routes ─────────────────────────────────────────────────────────────
// IMPORTANT: these must be declared before any `/:id` project routes below,
// otherwise Express matches literal segments like "tasks" or "tasks/stats"
// as the `:id` param on GET /:id, and the ID validation rejects them
// (this was causing "Invalid ID" / 400 on GET /projects/tasks).

// Read
router.get('/tasks', projectController.getAllTasks);
router.get('/tasks/stats', projectController.getTaskStats);
router.get('/tasks/:id', projectController.getTaskById);

// Create
router.post('/tasks', projectController.createTask);

// Update
router.put('/tasks/:id', projectController.updateTask);
router.patch('/tasks/:id', projectController.updateTask);

// Delete
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

// ─── Project Routes ───────────────────────────────────────────────────────────

// Read
router.get('/', projectController.getAllProjects);
router.get('/:id', projectController.getProjectById);
router.get('/:id/members', projectController.getProjectMembers);

// Create
router.post('/', projectController.createProject);

// Update
router.put('/:id', projectController.updateProject);
router.patch('/:id', projectController.updateProject);

// Delete
router.delete('/:id', projectController.deleteProject);

// Members
router.post('/:id/members', projectController.addProjectMember);
router.delete('/:id/members/:userId', projectController.removeProjectMember);

export default router;