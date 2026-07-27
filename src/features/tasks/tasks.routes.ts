// src/features/tasks/tasks.routes.ts
import { Router } from 'express';
import { taskController } from './tasks.controller';
import { protect } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// ─── STATIC ROUTES FIRST (no dynamic :id parameters) ──────────────────────
router.get('/summary', taskController.getTaskSummary);           // GET /api/v1/tasks/summary

// ─── Task List Routes ──────────────────────────────────────────────────────
router.get('/lists', taskController.getAllTaskLists);            // GET /api/v1/tasks/lists
router.get('/lists/:id', taskController.getTaskListById);        // GET /api/v1/tasks/lists/:id
router.get('/lists/:id/members', taskController.getListMembers); // GET /api/v1/tasks/lists/:id/members
router.post('/lists', taskController.createTaskList);            // POST /api/v1/tasks/lists
router.put('/lists/:id', taskController.updateTaskList);         // PUT /api/v1/tasks/lists/:id
router.patch('/lists/:id', taskController.updateTaskList);       // PATCH /api/v1/tasks/lists/:id
router.delete('/lists/:id', taskController.deleteTaskList);      // DELETE /api/v1/tasks/lists/:id
router.post('/lists/:id/members', taskController.addMemberToList);        // POST /api/v1/tasks/lists/:id/members
router.delete('/lists/:id/members/:userId', taskController.removeMemberFromList); // DELETE /api/v1/tasks/lists/:id/members/:userId

// ─── Subtask Routes (more specific than plain /:id) ──────────────────────
router.post('/:taskId/subtasks', taskController.createSubtask);           // POST /api/v1/tasks/:taskId/subtasks
router.put('/:taskId/subtasks/:subtaskId', taskController.updateSubtask); // PUT /api/v1/tasks/:taskId/subtasks/:subtaskId
router.patch('/:taskId/subtasks/:subtaskId', taskController.updateSubtask); // PATCH /api/v1/tasks/:taskId/subtasks/:subtaskId
router.delete('/:taskId/subtasks/:subtaskId', taskController.deleteSubtask); // DELETE /api/v1/tasks/:taskId/subtasks/:subtaskId

// ─── Toggle Status (specific route – must come BEFORE /:id) ──────────────
router.patch('/:id/status', taskController.toggleTaskStatus);   // PATCH /api/v1/tasks/:id/status

// ─── Dynamic Task Routes (must come LAST) ──────────────────────────────────
router.get('/', taskController.getAllTasks);               // GET /api/v1/tasks
router.get('/:id', taskController.getTaskById);            // GET /api/v1/tasks/:id
router.post('/', taskController.createTask);               // POST /api/v1/tasks
router.put('/:id', taskController.updateTask);             // PUT /api/v1/tasks/:id
router.patch('/:id', taskController.updateTask);           // PATCH /api/v1/tasks/:id
router.delete('/:id', taskController.deleteTask);          // DELETE /api/v1/tasks/:id

export default router;