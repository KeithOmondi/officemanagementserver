import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
  Project,
  Task,
  TaskAttachment,
  ProjectMember,
  TaskStats,
  ProjectStats,
} from './task.types';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
  AddProjectMemberInput,
  AddAttachmentInput,
} from './task.validator';

// ── Constants ────────────────────────────────────────────────────────────

const PROJECT_SELECT = `
    p.id,
    p.name,
    p.description,
    p.status,
    p.priority,
    p.deadline,
    p.progress,
    p.created_by,
    p.is_active,
    p.created_at,
    p.updated_at,
    COUNT(DISTINCT t.id)::int AS task_count,
    COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END)::int AS completed_tasks
`;

const PROJECT_JOIN = `
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id AND t.is_active = true
`;

const TASK_SELECT = `
    t.id,
    t.project_id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.assignee_id,
    u.full_name AS assignee_name,
    t.due_date,
    t.start_date,
    t.remind_at,
    t.reminder_sent,
    t.completed_at,
    t.is_active,
    t.created_by,
    t.created_at,
    t.updated_at,
    p.name AS project_name,
    (t.status != 'completed' AND t.due_date < NOW()) AS is_overdue
`;

const TASK_JOIN = `
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id AND p.is_active = true
    LEFT JOIN users u ON u.id = t.assignee_id AND u.is_active = true
`;

// ── Service Class ────────────────────────────────────────────────────────

export class TaskService {

  // ── Statistics ──────────────────────────────────────────────────────────

  static async getTaskStats(userId: string): Promise<TaskStats> {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS pending,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed,
        COUNT(CASE WHEN status != 'completed' AND due_date < NOW() THEN 1 END)::int AS overdue
      FROM tasks
      WHERE is_active = true
        AND (created_by = $1 OR assignee_id = $1)
    `, [userId]);
    return rows[0];
  }

  static async getProjectStats(userId: string): Promise<ProjectStats> {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(CASE WHEN p.status = 'active' THEN 1 END)::int AS active,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END)::int AS completed,
        COUNT(CASE WHEN p.status = 'archived' THEN 1 END)::int AS archived
      FROM projects p
      WHERE p.is_active = true
        AND (p.created_by = $1 OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = $1 AND pm.is_active = true
        ))
    `, [userId]);
    return rows[0];
  }

  // ── Projects ────────────────────────────────────────────────────────────

  static async findAllProjects(userId: string): Promise<Project[]> {
    const { rows } = await pool.query(
      `SELECT ${PROJECT_SELECT} ${PROJECT_JOIN}
       WHERE p.is_active = true
         AND (p.created_by = $1 OR EXISTS (
           SELECT 1 FROM project_members pm
           WHERE pm.project_id = p.id AND pm.user_id = $1 AND pm.is_active = true
         ))
       GROUP BY p.id ORDER BY p.created_at DESC`,
      [userId]
    );
    return rows;
  }

  static async findProjectById(id: string, userId?: string): Promise<Project | null> {
    const params: unknown[] = [id];
    let accessClause = '';
    if (userId) {
      accessClause = `
        AND (p.created_by = $2 OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = $2 AND pm.is_active = true
        ))`;
      params.push(userId);
    }
    const { rows } = await pool.query(
      `SELECT ${PROJECT_SELECT} ${PROJECT_JOIN}
       WHERE p.id = $1 AND p.is_active = true ${accessClause}
       GROUP BY p.id`,
      params
    );
    return rows[0] || null;
  }

  static async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const { rows } = await pool.query(`
      SELECT pm.id, pm.project_id, pm.user_id, u.full_name AS user_name, pm.role,
             pm.is_active, pm.created_at, pm.updated_at
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id AND u.is_active = true
      WHERE pm.project_id = $1 AND pm.is_active = true
      ORDER BY u.full_name ASC
    `, [projectId]);
    return rows;
  }

  static async createProject(input: CreateProjectInput, createdBy: string): Promise<Project> {
    const { rows } = await pool.query(
      `INSERT INTO projects (name, description, priority, deadline, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [input.name.trim(), input.description || null, input.priority || 'medium', input.deadline, createdBy]
    );
    const projectId = rows[0].id;
    await pool.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
      [projectId, createdBy]
    );
    if (input.member_ids?.length) {
      const others = input.member_ids.filter(id => id !== createdBy);
      if (others.length) {
        const values = others.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(', ');
        await pool.query(
          `INSERT INTO project_members (project_id, user_id) VALUES ${values} ON CONFLICT DO NOTHING`,
          others.flatMap(id => [projectId, id])
        );
      }
    }
    const project = await this.findProjectById(projectId);
    if (!project) throw new AppError(500, 'Failed to create project');
    return project;
  }

  static async updateProject(id: string, input: UpdateProjectInput, userId: string): Promise<Project> {
    const existing = await this.findProjectById(id, userId);
    if (!existing) throw new AppError(404, 'Project not found');
    if (existing.created_by !== userId) throw new AppError(403, 'Only creator can update');

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;
    if (input.name !== undefined) { updates.push(`name = $${p++}`); values.push(input.name.trim()); }
    if (input.description !== undefined) { updates.push(`description = $${p++}`); values.push(input.description || null); }
    if (input.status !== undefined) { updates.push(`status = $${p++}`); values.push(input.status); }
    if (input.priority !== undefined) { updates.push(`priority = $${p++}`); values.push(input.priority); }
    if (input.deadline !== undefined) { updates.push(`deadline = $${p++}`); values.push(input.deadline); }
    if (input.is_active !== undefined) { updates.push(`is_active = $${p++}`); values.push(input.is_active); }
    if (!updates.length) return existing;
    updates.push(`updated_at = NOW()`);
    values.push(id);
    await pool.query(`UPDATE projects SET ${updates.join(', ')} WHERE id = $${p}`, values);
    const updated = await this.findProjectById(id);
    if (!updated) throw new AppError(500, 'Failed to update project');
    return updated;
  }

  static async deleteProject(id: string, userId: string): Promise<void> {
    const existing = await this.findProjectById(id, userId);
    if (!existing) throw new AppError(404, 'Project not found');
    if (existing.created_by !== userId) throw new AppError(403, 'Only creator can delete');
    await pool.query(`UPDATE projects SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
    await pool.query(`UPDATE tasks SET is_active = false, updated_at = NOW() WHERE project_id = $1`, [id]);
  }

  // ── Project Members ─────────────────────────────────────────────────────

  static async addProjectMember(projectId: string, input: AddProjectMemberInput, userId: string): Promise<ProjectMember> {
    const project = await this.findProjectById(projectId, userId);
    if (!project) throw new AppError(404, 'Project not found');
    if (project.created_by !== userId) throw new AppError(403, 'Only creator can manage members');

    const { rows: userCheck } = await pool.query(`SELECT id FROM users WHERE id = $1 AND is_active = true`, [input.user_id]);
    if (!userCheck.length) throw new AppError(404, 'User not found');

    const { rows } = await pool.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`,
      [projectId, input.user_id, input.role || null]
    );
    if (!rows.length) throw new AppError(409, 'Already a member');
    const members = await this.getProjectMembers(projectId);
    return members.find(m => m.user_id === input.user_id)!;
  }

  static async removeProjectMember(projectId: string, memberId: string, userId: string): Promise<void> {
    const project = await this.findProjectById(projectId, userId);
    if (!project) throw new AppError(404, 'Project not found');
    if (project.created_by !== userId) throw new AppError(403, 'Only creator can remove members');
    const { rows } = await pool.query(
      `UPDATE project_members SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND project_id = $2 AND is_active = true RETURNING id`,
      [memberId, projectId]
    );
    if (!rows.length) throw new AppError(404, 'Member not found');
  }

  // ── Tasks ──────────────────────────────────────────────────────────────

  static async findAllTasks(userId: string, projectId?: string): Promise<Task[]> {
    const params: unknown[] = [userId];
    let projectClause = '';
    if (projectId) {
      projectClause = ` AND t.project_id = $2`;
      params.push(projectId);
    }
    const { rows } = await pool.query(
      `SELECT ${TASK_SELECT} ${TASK_JOIN}
       WHERE t.is_active = true
         AND (t.created_by = $1 OR t.assignee_id = $1 OR EXISTS (
           SELECT 1 FROM project_members pm
           WHERE pm.project_id = t.project_id AND pm.user_id = $1 AND pm.is_active = true
         )) ${projectClause}
       ORDER BY t.due_date ASC, t.created_at DESC`,
      params
    );
    return rows;
  }

  static async findTaskById(id: string, userId?: string): Promise<Task | null> {
    const params: unknown[] = [id];
    let accessClause = '';
    if (userId) {
      accessClause = `
        AND (t.created_by = $2 OR t.assignee_id = $2 OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = t.project_id AND pm.user_id = $2 AND pm.is_active = true
        ))`;
      params.push(userId);
    }
    const { rows } = await pool.query(
      `SELECT ${TASK_SELECT} ${TASK_JOIN}
       WHERE t.id = $1 AND t.is_active = true ${accessClause}`,
      params
    );
    return rows[0] || null;
  }

  static async createTask(input: CreateTaskInput, createdBy: string): Promise<Task> {
    if (input.project_id) {
      const project = await this.findProjectById(input.project_id, createdBy);
      if (!project) throw new AppError(404, 'Project not found');
      if (new Date(input.due_date) > new Date(project.deadline))
        throw new AppError(400, 'Task deadline cannot exceed project deadline');
    }
    if (input.assignee_id) {
      const { rows } = await pool.query(`SELECT id FROM users WHERE id = $1 AND is_active = true`, [input.assignee_id]);
      if (!rows.length) throw new AppError(404, 'Assignee not found');
    }

    const { rows } = await pool.query(
      `INSERT INTO tasks (project_id, title, description, priority, assignee_id,
                          due_date, start_date, remind_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        input.project_id || null,
        input.title.trim(),
        input.description || null,
        input.priority || 'medium',
        input.assignee_id || null,
        input.due_date,
        input.start_date || null,
        input.remind_at || null,
        createdBy,
      ]
    );
    const task = await this.findTaskById(rows[0].id);
    if (!task) throw new AppError(500, 'Failed to create task');
    return task;
  }

  static async updateTask(id: string, input: UpdateTaskInput, userId: string): Promise<Task> {
    const existing = await this.findTaskById(id, userId);
    if (!existing) throw new AppError(404, 'Task not found');
    const canUpdate = existing.created_by === userId || existing.assignee_id === userId;
    if (!canUpdate) throw new AppError(403, 'Not allowed to update this task');

    if (input.assignee_id !== undefined && input.assignee_id !== null) {
      const { rows } = await pool.query(`SELECT id FROM users WHERE id = $1 AND is_active = true`, [input.assignee_id]);
      if (!rows.length) throw new AppError(404, 'Assignee not found');
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;
    if (input.title !== undefined) { updates.push(`title = $${p++}`); values.push(input.title.trim()); }
    if (input.description !== undefined) { updates.push(`description = $${p++}`); values.push(input.description || null); }
    if (input.status !== undefined) {
      updates.push(`status = $${p++}`);
      values.push(input.status);
      updates.push(input.status === 'completed' ? `completed_at = NOW()` : `completed_at = NULL`);
    }
    if (input.priority !== undefined) { updates.push(`priority = $${p++}`); values.push(input.priority); }
    if (input.assignee_id !== undefined) { updates.push(`assignee_id = $${p++}`); values.push(input.assignee_id); }
    if (input.due_date !== undefined) { updates.push(`due_date = $${p++}`); values.push(input.due_date); }
    if (input.start_date !== undefined) { updates.push(`start_date = $${p++}`); values.push(input.start_date); }
    if (input.remind_at !== undefined) { updates.push(`remind_at = $${p++}`); values.push(input.remind_at); }
    if (input.is_active !== undefined) { updates.push(`is_active = $${p++}`); values.push(input.is_active); }
    if (!updates.length) return existing;
    updates.push(`updated_at = NOW()`);
    values.push(id);
    await pool.query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = $${p}`, values);
    const updated = await this.findTaskById(id);
    if (!updated) throw new AppError(500, 'Failed to update task');
    return updated;
  }

  static async deleteTask(id: string, userId: string): Promise<void> {
    const existing = await this.findTaskById(id, userId);
    if (!existing) throw new AppError(404, 'Task not found');
    if (existing.created_by !== userId) throw new AppError(403, 'Only creator can delete');
    const { rows } = await pool.query(
      `UPDATE tasks SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!rows.length) throw new AppError(404, 'Task not found');
  }

  // ── Standalone Tasks ────────────────────────────────────────────────────

  static async findStandaloneTasks(userId: string): Promise<Task[]> {
    const { rows } = await pool.query(
      `SELECT ${TASK_SELECT} ${TASK_JOIN}
       WHERE t.is_active = true
         AND t.project_id IS NULL
         AND (t.created_by = $1 OR t.assignee_id = $1)
       ORDER BY t.due_date ASC, t.created_at DESC`,
      [userId]
    );
    return rows;
  }

  // ── Attachments ─────────────────────────────────────────────────────────

  static async getAttachments(taskId: string, userId: string): Promise<TaskAttachment[]> {
    // verify user can access the task
    const task = await this.findTaskById(taskId, userId);
    if (!task) throw new AppError(404, 'Task not found or access denied');
    const { rows } = await pool.query(`
      SELECT a.id, a.task_id, a.file_name, a.file_url, a.uploaded_by,
             u.full_name AS uploader_name, a.created_at
      FROM task_attachments a
      JOIN users u ON u.id = a.uploaded_by
      WHERE a.task_id = $1
      ORDER BY a.created_at DESC
    `, [taskId]);
    return rows;
  }

  static async addAttachment(taskId: string, input: AddAttachmentInput, userId: string): Promise<TaskAttachment> {
    const task = await this.findTaskById(taskId, userId);
    if (!task) throw new AppError(404, 'Task not found or access denied');

    const { rows } = await pool.query(
      `INSERT INTO task_attachments (task_id, file_name, file_url, uploaded_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [taskId, input.file_name.trim(), input.file_url, userId]
    );
    const attachments = await this.getAttachments(taskId, userId);
    return attachments.find(a => a.id === rows[0].id)!;
  }

  static async removeAttachment(attachmentId: string, userId: string): Promise<void> {
    // verify user owns the attachment or is task creator/assignee
    const { rows: att } = await pool.query(
      `SELECT a.task_id, a.uploaded_by, t.created_by, t.assignee_id
       FROM task_attachments a
       JOIN tasks t ON t.id = a.task_id
       WHERE a.id = $1 AND t.is_active = true`,
      [attachmentId]
    );
    if (!att.length) throw new AppError(404, 'Attachment not found');
    const { task_id, uploaded_by, created_by, assignee_id } = att[0];
    if (uploaded_by !== userId && created_by !== userId && assignee_id !== userId)
      throw new AppError(403, 'You do not have permission to delete this attachment');

    const { rows } = await pool.query(
      `DELETE FROM task_attachments WHERE id = $1 RETURNING id`,
      [attachmentId]
    );
    if (!rows.length) throw new AppError(404, 'Attachment not found');
  }
}