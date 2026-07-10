import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import { sendMail } from '../../utils/sendMail';
import {
  Project,
  Task,
  Subtask,
  TaskNote,
  Reminder,
  CreateProjectInput,
  UpdateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateSubtaskInput,
  UpdateSubtaskInput,
  CreateTaskNoteInput,
  CreateReminderInput,
  TaskFilters,
} from './tasks.types';
import { v4 as uuidv4 } from 'uuid';

export class TaskService {
  // ─── Projects ──────────────────────────────────────────────
  async createProject(data: CreateProjectInput): Promise<Project> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const projectId = uuidv4();
      const now = new Date();

      const insertProject = `
        INSERT INTO projects (id, title, description, deadline, priority, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const res = await client.query(insertProject, [
        projectId,
        data.title,
        data.description || null,
        data.deadline,
        data.priority,
        now,
        now,
      ]);

      if (data.members && data.members.length > 0) {
        const values = data.members.map((userId) => `('${projectId}', '${userId}')`).join(',');
        await client.query(`INSERT INTO project_members (project_id, user_id) VALUES ${values};`);
      }

      await client.query('COMMIT');

      const project = res.rows[0];
      project.members = data.members || [];
      project.tasks = [];
      return project;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getProjectById(id: string): Promise<Project | null> {
    const client = await pool.connect();
    try {
      const projectRes = await client.query('SELECT * FROM projects WHERE id = $1', [id]);
      if (projectRes.rows.length === 0) return null;
      const project = projectRes.rows[0];

      const membersRes = await client.query(
        'SELECT user_id FROM project_members WHERE project_id = $1',
        [id]
      );
      project.members = membersRes.rows.map((r) => r.user_id);

      const tasksRes = await client.query('SELECT * FROM tasks WHERE project_id = $1', [id]);
      project.tasks = tasksRes.rows;

      return project;
    } finally {
      client.release();
    }
  }

  async listProjects(): Promise<Project[]> {
    const client = await pool.connect();
    try {
      const projectsRes = await client.query('SELECT * FROM projects ORDER BY created_at DESC');
      const projects = projectsRes.rows;

      for (const project of projects) {
        const membersRes = await client.query(
          'SELECT user_id FROM project_members WHERE project_id = $1',
          [project.id]
        );
        project.members = membersRes.rows.map((r) => r.user_id);

        const tasksRes = await client.query(
          'SELECT COUNT(*) as count FROM tasks WHERE project_id = $1',
          [project.id]
        );
        project.taskCount = parseInt(tasksRes.rows[0].count);
        project.tasks = [];
      }

      return projects;
    } finally {
      client.release();
    }
  }

  async updateProject(id: string, data: UpdateProjectInput): Promise<Project> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (data.title !== undefined) {
        fields.push(`title = $${idx++}`);
        values.push(data.title);
      }
      if (data.description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(data.description);
      }
      if (data.deadline !== undefined) {
        fields.push(`deadline = $${idx++}`);
        values.push(data.deadline);
      }
      if (data.priority !== undefined) {
        fields.push(`priority = $${idx++}`);
        values.push(data.priority);
      }
      fields.push(`updated_at = $${idx++}`);
      values.push(new Date());

      if (fields.length === 0) {
        throw new AppError(400, 'No fields to update');
      }

      values.push(id);
      const query = `UPDATE projects SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *;`;
      const res = await client.query(query, values);
      if (res.rows.length === 0) {
        throw new AppError(404, 'Project not found');
      }
      const project = res.rows[0];

      if (data.members) {
        await client.query('DELETE FROM project_members WHERE project_id = $1', [id]);
        if (data.members.length > 0) {
          const values = data.members.map((userId) => `('${id}', '${userId}')`).join(',');
          await client.query(`INSERT INTO project_members (project_id, user_id) VALUES ${values};`);
        }
        project.members = data.members;
      } else {
        const membersRes = await client.query(
          'SELECT user_id FROM project_members WHERE project_id = $1',
          [id]
        );
        project.members = membersRes.rows.map((r) => r.user_id);
      }

      await client.query('COMMIT');
      return project;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteProject(id: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM tasks WHERE project_id = $1', [id]);
      await client.query('DELETE FROM project_members WHERE project_id = $1', [id]);
      await client.query('DELETE FROM projects WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ─── Tasks ──────────────────────────────────────────────────
  async createTask(data: CreateTaskInput): Promise<Task> {
    const client = await pool.connect();
    try {
      const taskId = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO tasks (id, project_id, title, description, assignee, priority, deadline, start_date, status, progress, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
      `;
      const values = [
        taskId,
        data.project_id || null,
        data.title,
        data.description || null,
        data.assignee, // ✅ No fallback – must be provided
        data.priority || 'normal',
        data.deadline,
        data.start_date || null,
        'todo',
        0,
        now,
        now,
      ];
      const res = await client.query(query, values);
      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async getTaskById(id: string): Promise<Task | null> {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT * FROM tasks WHERE id = $1', [id]);
      return res.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async listTasks(filters: TaskFilters = {}): Promise<Task[]> {
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM tasks WHERE 1=1';
      const values: any[] = [];
      let idx = 1;

      if (filters.project_id) {
        query += ` AND project_id = $${idx++}`;
        values.push(filters.project_id);
      }
      if (filters.assignee) {
        query += ` AND assignee = $${idx++}`;
        values.push(filters.assignee);
      }
      if (filters.status) {
        query += ` AND status = $${idx++}`;
        values.push(filters.status);
      }

      query += ' ORDER BY deadline ASC, created_at DESC;';
      const res = await client.query(query, values);
      return res.rows;
    } finally {
      client.release();
    }
  }

  async updateTask(id: string, data: UpdateTaskInput): Promise<Task> {
    const client = await pool.connect();
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (data.title !== undefined) {
        fields.push(`title = $${idx++}`);
        values.push(data.title);
      }
      if (data.description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(data.description);
      }
      if (data.assignee !== undefined) {
        fields.push(`assignee = $${idx++}`);
        values.push(data.assignee);
      }
      if (data.priority !== undefined) {
        fields.push(`priority = $${idx++}`);
        values.push(data.priority);
      }
      if (data.deadline !== undefined) {
        fields.push(`deadline = $${idx++}`);
        values.push(data.deadline);
      }
      if (data.start_date !== undefined) {
        fields.push(`start_date = $${idx++}`);
        values.push(data.start_date);
      }
      if (data.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(data.status);
      }
      if (data.progress !== undefined) {
        fields.push(`progress = $${idx++}`);
        values.push(data.progress);
      }
      fields.push(`updated_at = $${idx++}`);
      values.push(new Date());

      if (fields.length === 0) {
        throw new AppError(400, 'No fields to update');
      }

      values.push(id);
      const query = `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *;`;
      const res = await client.query(query, values);
      if (res.rows.length === 0) {
        throw new AppError(404, 'Task not found');
      }
      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async deleteTask(id: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM tasks WHERE id = $1', [id]);
    } finally {
      client.release();
    }
  }

  // ─── Subtasks ──────────────────────────────────────────────
  async createSubtask(data: CreateSubtaskInput): Promise<Subtask> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();
      const query = `
        INSERT INTO subtasks (id, task_id, title, completed, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const res = await client.query(query, [id, data.task_id, data.title, false, now, now]);
      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async listSubtasksByTask(taskId: string): Promise<Subtask[]> {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT * FROM subtasks WHERE task_id = $1 ORDER BY created_at ASC', [taskId]);
      return res.rows;
    } finally {
      client.release();
    }
  }

  async updateSubtask(id: string, data: UpdateSubtaskInput): Promise<Subtask> {
    const client = await pool.connect();
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (data.title !== undefined) {
        fields.push(`title = $${idx++}`);
        values.push(data.title);
      }
      if (data.completed !== undefined) {
        fields.push(`completed = $${idx++}`);
        values.push(data.completed);
      }
      fields.push(`updated_at = $${idx++}`);
      values.push(new Date());

      if (fields.length === 0) {
        throw new AppError(400, 'No fields to update');
      }

      values.push(id);
      const query = `UPDATE subtasks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *;`;
      const res = await client.query(query, values);
      if (res.rows.length === 0) {
        throw new AppError(404, 'Subtask not found');
      }
      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async deleteSubtask(id: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM subtasks WHERE id = $1', [id]);
    } finally {
      client.release();
    }
  }

  // ─── Task Notes ────────────────────────────────────────────
  async createTaskNote(data: CreateTaskNoteInput): Promise<TaskNote> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();
      const query = `
        INSERT INTO task_notes (id, task_id, content, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const res = await client.query(query, [id, data.task_id, data.content, now, now]);
      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async listTaskNotes(taskId: string): Promise<TaskNote[]> {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT * FROM task_notes WHERE task_id = $1 ORDER BY created_at DESC', [taskId]);
      return res.rows;
    } finally {
      client.release();
    }
  }

  async deleteTaskNote(id: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM task_notes WHERE id = $1', [id]);
    } finally {
      client.release();
    }
  }

  // ─── Reminders ──────────────────────────────────────────────
  async createReminder(data: CreateReminderInput): Promise<Reminder> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();
      const query = `
        INSERT INTO reminders (id, task_id, remind_at, sent, created_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const res = await client.query(query, [id, data.task_id, data.remind_at, false, now]);
      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async listRemindersForTask(taskId: string): Promise<Reminder[]> {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT * FROM reminders WHERE task_id = $1 ORDER BY remind_at ASC', [taskId]);
      return res.rows;
    } finally {
      client.release();
    }
  }

  async deleteReminder(id: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM reminders WHERE id = $1', [id]);
    } finally {
      client.release();
    }
  }

  // ─── Helper: get full task ────────────────────────────────
  async getFullTask(taskId: string): Promise<{
    task: Task;
    subtasks: Subtask[];
    notes: TaskNote[];
    reminders: Reminder[];
  } | null> {
    const task = await this.getTaskById(taskId);
    if (!task) return null;

    const [subtasks, notes, reminders] = await Promise.all([
      this.listSubtasksByTask(taskId),
      this.listTaskNotes(taskId),
      this.listRemindersForTask(taskId),
    ]);

    return { task, subtasks, notes, reminders };
  }

  // ─── Reminder Scheduler ──────────────────────────────────
  async processPendingReminders(): Promise<void> {
    const client = await pool.connect();
    try {
      const now = new Date();
      const res = await client.query(
        `SELECT r.*, t.title as task_title, t.assignee
         FROM reminders r
         JOIN tasks t ON r.task_id = t.id
         WHERE r.remind_at <= $1 AND r.sent = false`,
        [now]
      );

      for (const reminder of res.rows) {
        if (reminder.assignee !== 'GROUP') {
          const userRes = await client.query(
            'SELECT email FROM users WHERE id = $1',
            [reminder.assignee]
          );
          if (userRes.rows.length > 0) {
            const email = userRes.rows[0].email;
            const html = `
              <h1>Task Reminder</h1>
              <p><strong>Task:</strong> ${reminder.task_title}</p>
              <p><strong>Reminder set for:</strong> ${new Date(reminder.remind_at).toLocaleString()}</p>
              <p>Please take the necessary action.</p>
            `;
            await sendMail({
              to: email,
              subject: `Reminder: ${reminder.task_title}`,
              html,
            });
          }
        }
        await client.query('UPDATE reminders SET sent = true WHERE id = $1', [reminder.id]);
      }
    } finally {
      client.release();
    }
  }
}