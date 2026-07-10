import { Router } from 'express';
import * as TaskController from './tasks.controller';

const router = Router();

// Projects
router.post('/projects', TaskController.createProject);
router.get('/projects', TaskController.listProjects);
router.get('/projects/:id', TaskController.getProject);
router.put('/projects/:id', TaskController.updateProject);
router.delete('/projects/:id', TaskController.deleteProject);

// Tasks
router.post('/tasks', TaskController.createTask);
router.get('/tasks', TaskController.listTasks);
router.get('/tasks/:id', TaskController.getTask);
router.put('/tasks/:id', TaskController.updateTask);
router.delete('/tasks/:id', TaskController.deleteTask);

// Subtasks
router.post('/subtasks', TaskController.createSubtask);
router.get('/subtasks/task/:taskId', TaskController.listSubtasks);
router.put('/subtasks/:id', TaskController.updateSubtask);
router.delete('/subtasks/:id', TaskController.deleteSubtask);

// Task Notes
router.post('/task-notes', TaskController.createTaskNote);
router.get('/task-notes/task/:taskId', TaskController.listTaskNotes);
router.delete('/task-notes/:id', TaskController.deleteTaskNote);

// Reminders
router.post('/reminders', TaskController.createReminder);
router.get('/reminders/task/:taskId', TaskController.listReminders);
router.delete('/reminders/:id', TaskController.deleteReminder);

export default router;