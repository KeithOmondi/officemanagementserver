// src/features/tasks/tasks.service.ts

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
  Priority,
  ProjectStatus,
  TaskActivity,
  TaskActivityAction,
  TaskActivityChange,
  TaskAttachment,
  TaskTimeEntry,
  TaskDependency,
  TaskTemplate,
  TaskDashboardStats,
  UserTaskStats,
  TaskSearchResult,
  TaskSearchAggregations,
  TaskExportOptions,
  TaskExportResult,
  ProjectAttachment,
} from './tasks.types';
import { v4 as uuidv4 } from 'uuid';
import { CreateTaskTemplateInput } from './tasks.validator';

export class TaskService {
  // ─── Projects ──────────────────────────────────────────────────────────────────

  async createProject(data: CreateProjectInput, userId: string): Promise<Project> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const projectId = uuidv4();
      const now = new Date();
      const status: ProjectStatus = data.status || 'active';

      const userRes = await client.query(
        'SELECT full_name FROM users WHERE id = $1',
        [userId]
      );
      const userName = userRes.rows[0]?.full_name || 'Unknown User';

      const insertProject = `
        INSERT INTO projects (
          id, title, description, deadline, priority, status, 
          owner_id, department_id, tags, start_date, 
          created_by, created_by_name, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *;
      `;

      const res = await client.query(insertProject, [
        projectId,
        data.title,
        data.description || null,
        data.deadline,
        data.priority || 'normal',
        status,
        data.owner_id || userId,
        data.department_id || null,
        data.tags || [],
        data.start_date || null,
        userId,
        userName,
        now,
        now,
      ]);

      if (data.members && data.members.length > 0) {
        const memberValues: string[] = [];
        const memberParams: any[] = [];
        let idx = 1;
        for (const memberId of data.members) {
          memberValues.push(`($${idx}, $${idx + 1})`);
          memberParams.push(projectId, memberId);
          idx += 2;
        }
        await client.query(
          `INSERT INTO project_members (project_id, user_id) VALUES ${memberValues.join(', ')}`,
          memberParams
        );
      }

      await client.query('COMMIT');

      const project = res.rows[0];
      project.members = data.members || [];
      project.tasks = [];
      project.progress = 0;
      project.attachments = [];
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

      const attachmentsRes = await client.query(
        'SELECT * FROM project_attachments WHERE project_id = $1 ORDER BY uploaded_at DESC',
        [id]
      );
      project.attachments = attachmentsRes.rows;

      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter((t: Task) => t.status === 'done').length;
      project.progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return project;
    } finally {
      client.release();
    }
  }

  async listProjects(userId?: string): Promise<Project[]> {
    const client = await pool.connect();
    try {
      let query = `
        SELECT p.*, 
          COUNT(DISTINCT pm.user_id) as member_count,
          COUNT(DISTINCT t.id) as task_count
        FROM projects p
        LEFT JOIN project_members pm ON pm.project_id = p.id
        LEFT JOIN tasks t ON t.project_id = p.id
      `;
      const values: any[] = [];
      const conditions: string[] = [];

      if (userId) {
        conditions.push(`p.id IN (SELECT project_id FROM project_members WHERE user_id = $${values.length + 1})`);
        values.push(userId);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' GROUP BY p.id ORDER BY p.created_at DESC';

      const projectsRes = await client.query(query, values);
      const projects = projectsRes.rows;

      for (const project of projects) {
        const membersRes = await client.query(
          'SELECT user_id FROM project_members WHERE project_id = $1',
          [project.id]
        );
        project.members = membersRes.rows.map((r) => r.user_id);

        const tasksRes = await client.query(
          'SELECT * FROM tasks WHERE project_id = $1',
          [project.id]
        );
        project.tasks = tasksRes.rows;

        const totalTasks = project.tasks.length;
        const completedTasks = project.tasks.filter((t: Task) => t.status === 'done').length;
        project.progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        const attachmentsRes = await client.query(
          'SELECT * FROM project_attachments WHERE project_id = $1 ORDER BY uploaded_at DESC',
          [project.id]
        );
        project.attachments = attachmentsRes.rows;
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
      if (data.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(data.status);
      }
      if (data.owner_id !== undefined) {
        fields.push(`owner_id = $${idx++}`);
        values.push(data.owner_id);
      }
      if (data.department_id !== undefined) {
        fields.push(`department_id = $${idx++}`);
        values.push(data.department_id);
      }
      if (data.tags !== undefined) {
        fields.push(`tags = $${idx++}`);
        values.push(data.tags);
      }
      if (data.start_date !== undefined) {
        fields.push(`start_date = $${idx++}`);
        values.push(data.start_date);
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
          const memberValues: string[] = [];
          const memberParams: any[] = [];
          let p = 1;
          for (const memberId of data.members) {
            memberValues.push(`($${p}, $${p + 1})`);
            memberParams.push(id, memberId);
            p += 2;
          }
          await client.query(
            `INSERT INTO project_members (project_id, user_id) VALUES ${memberValues.join(', ')}`,
            memberParams
          );
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
      await client.query('DELETE FROM project_attachments WHERE project_id = $1', [id]);
      await client.query('DELETE FROM projects WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ─── Project Attachments ──────────────────────────────────────────────────────

  async addProjectAttachment(
    projectId: string,
    file: Express.Multer.File,
    userId: string
  ): Promise<ProjectAttachment> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();

      const userRes = await client.query(
        'SELECT full_name FROM users WHERE id = $1',
        [userId]
      );
      const userName = userRes.rows[0]?.full_name || 'Unknown User';

      const query = `
        INSERT INTO project_attachments (
          id, project_id, file_name, file_url, file_size, mime_type,
          uploaded_by, uploaded_by_name, uploaded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;

      const res = await client.query(query, [
        id,
        projectId,
        file.originalname,
        file.path || file.filename,
        file.size,
        file.mimetype,
        userId,
        userName,
        now,
      ]);

      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async deleteProjectAttachment(id: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM project_attachments WHERE id = $1', [id]);
    } finally {
      client.release();
    }
  }

  // ─── Tasks ────────────────────────────────────────────────────────────────────

  async createTask(data: CreateTaskInput, userId: string): Promise<Task> {
    const client = await pool.connect();
    try {
      const taskId = uuidv4();
      const now = new Date();

      const userRes = await client.query(
        'SELECT full_name FROM users WHERE id = $1',
        [userId]
      );
      const userName = userRes.rows[0]?.full_name || 'Unknown User';

      const query = `
        INSERT INTO tasks (
          id, project_id, title, description, assignee, priority, deadline, 
          start_date, status, progress, type, visibility, tags, estimated_hours,
          due_date, created_by, created_by_name, assigned_by, assigned_by_name,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING *;
      `;

      const status: string = 'todo';
      const type: string = data.type || 'task';
      const visibility: string = data.visibility || 'team';
      const due_date = data.deadline;

      const values = [
        taskId,
        data.project_id || null,
        data.title,
        data.description || null,
        data.assignee || null,
        data.priority || 'normal',
        data.deadline,
        data.start_date || null,
        status,
        0,
        type,
        visibility,
        data.tags || [],
        data.estimated_hours || null,
        due_date,
        userId,
        userName,
        data.assignee || null,
        null,
        now,
        now,
      ];

      const res = await client.query(query, values);

      if (data.assignee && data.assignee !== 'GROUP') {
        const assigneeRes = await client.query(
          'SELECT full_name FROM users WHERE id = $1',
          [data.assignee]
        );
        if (assigneeRes.rows.length > 0) {
          await client.query(
            'UPDATE tasks SET assigned_by_name = $1 WHERE id = $2',
            [assigneeRes.rows[0].full_name, taskId]
          );
        }
      }

      await this.logActivity(client, taskId, userId, 'created', {
        changes: [{ field: 'task', from: null, to: data.title }],
        metadata: { data },
      });

      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async getTaskById(id: string): Promise<Task | null> {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT * FROM tasks WHERE id = $1', [id]);
      const task = res.rows[0];
      if (!task) return null;

      const blockingRes = await client.query(
        `SELECT depends_on FROM task_dependencies WHERE task_id = $1 AND dependency_type = 'blocked_by'`,
        [id]
      );
      task.blocked_by = blockingRes.rows.map((r) => r.depends_on);

      const blockedRes = await client.query(
        `SELECT task_id FROM task_dependencies WHERE depends_on = $1 AND dependency_type = 'blocks'`,
        [id]
      );
      task.blocking = blockedRes.rows.map((r) => r.task_id);

      const childRes = await client.query(
        'SELECT id FROM tasks WHERE parent_task_id = $1',
        [id]
      );
      task.child_task_ids = childRes.rows.map((r) => r.id);

      const attachRes = await client.query(
        'SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY uploaded_at DESC',
        [id]
      );
      task.attachments = attachRes.rows;

      const watcherRes = await client.query(
        'SELECT user_id FROM task_watchers WHERE task_id = $1',
        [id]
      );
      task.watchers = watcherRes.rows.map((r) => r.user_id);

      return task;
    } finally {
      client.release();
    }
  }

 // In tasks.service.ts, replace the entire listTasks method with this:

async listTasks(filters: Partial<TaskFilters> = {}, userId?: string): Promise<TaskSearchResult> {
  const client = await pool.connect();
  try {
    // Build query parts
    const whereClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Helper to add a filter
    const addFilter = (condition: string, value: any) => {
      whereClauses.push(condition);
      values.push(value);
    };

    // Helper to add an array filter
    const addArrayFilter = (field: string, arr: any[]) => {
      if (arr.length === 0) return;
      const placeholders = arr.map((_, i) => `$${idx + i}`).join(',');
      whereClauses.push(`${field} IN (${placeholders})`);
      values.push(...arr);
      idx += arr.length;
    };

    // Helper to add a single filter
    const addSingleFilter = (field: string, value: any, operator: string = '=') => {
      whereClauses.push(`${field} ${operator} $${idx}`);
      values.push(value);
      idx++;
    };

    // Apply filters
    if (filters.project_id) {
      if (Array.isArray(filters.project_id)) {
        addArrayFilter('project_id', filters.project_id);
      } else {
        addSingleFilter('project_id', filters.project_id);
      }
    }

    if (filters.assignee) {
      addSingleFilter('assignee', filters.assignee);
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        addArrayFilter('status', filters.status);
      } else {
        addSingleFilter('status', filters.status);
      }
    }

    if (filters.priority) {
      if (Array.isArray(filters.priority)) {
        addArrayFilter('priority', filters.priority);
      } else {
        addSingleFilter('priority', filters.priority);
      }
    }

    if (filters.type) {
      if (Array.isArray(filters.type)) {
        addArrayFilter('type', filters.type);
      } else {
        addSingleFilter('type', filters.type);
      }
    }

    if (filters.search) {
      whereClauses.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
      values.push(`%${filters.search}%`);
      idx++;
    }

    if (filters.tags && filters.tags.length > 0) {
      const placeholders = filters.tags.map((_, i) => `$${idx + i}`).join(',');
      whereClauses.push(`tags && ARRAY[${placeholders}]`);
      values.push(...filters.tags);
      idx += filters.tags.length;
    }

    if (filters.due_from) {
      addSingleFilter('due_date', filters.due_from, '>=');
    }
    if (filters.due_to) {
      addSingleFilter('due_date', filters.due_to, '<=');
    }

    if (filters.created_from) {
      addSingleFilter('created_at', filters.created_from, '>=');
    }
    if (filters.created_to) {
      addSingleFilter('created_at', filters.created_to, '<=');
    }

    if (filters.updated_from) {
      addSingleFilter('updated_at', filters.updated_from, '>=');
    }
    if (filters.updated_to) {
      addSingleFilter('updated_at', filters.updated_to, '<=');
    }

    if (filters.assigned_by) {
      addSingleFilter('assigned_by', filters.assigned_by);
    }
    if (filters.created_by) {
      addSingleFilter('created_by', filters.created_by);
    }

    if (filters.has_attachments) {
      whereClauses.push(`EXISTS (SELECT 1 FROM task_attachments WHERE task_id = tasks.id)`);
    }

    if (filters.has_notes) {
      whereClauses.push(`EXISTS (SELECT 1 FROM task_notes WHERE task_id = tasks.id)`);
    }

    if (filters.is_blocked) {
      whereClauses.push(`EXISTS (SELECT 1 FROM task_dependencies WHERE task_id = tasks.id AND dependency_type = 'blocked_by')`);
    }

    if (filters.is_blocking) {
      whereClauses.push(`EXISTS (SELECT 1 FROM task_dependencies WHERE depends_on = tasks.id AND dependency_type = 'blocks')`);
    }

    if (filters.parent_task_id !== undefined) {
      if (filters.parent_task_id === null) {
        whereClauses.push(`parent_task_id IS NULL`);
      } else {
        addSingleFilter('parent_task_id', filters.parent_task_id);
      }
    }

    if (!filters.include_archived) {
      whereClauses.push(`status != 'archived'`);
    }

    // Build the WHERE clause
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Build the count query
    const countQuery = `SELECT COUNT(*) as total FROM tasks ${whereClause}`;
    
    // Execute count query
    let total = 0;
    if (values.length > 0) {
      const countRes = await client.query(countQuery, values);
      total = parseInt(countRes.rows[0]?.total || '0', 10);
    } else {
      const countRes = await client.query(countQuery);
      total = parseInt(countRes.rows[0]?.total || '0', 10);
    }

    // Build the main query with sorting and pagination
    const sortBy = filters.sort_by || 'created_at';
    const sortOrder = filters.sort_order || 'DESC';
    const allowedSort = ['created_at', 'updated_at', 'deadline', 'priority', 'status', 'title', 'progress'];
    const sortCol = allowedSort.includes(sortBy) ? sortBy : 'created_at';

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const mainQuery = `
      SELECT * FROM tasks 
      ${whereClause}
      ORDER BY ${sortCol} ${sortOrder} 
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    // Execute main query
    let result;
    if (values.length > 0) {
      result = await client.query(mainQuery, [...values, limit, offset]);
    } else {
      result = await client.query(mainQuery, [limit, offset]);
    }

    // ── Aggregations ──────────────────────────────────────────────────────
    // For aggregations, we need to run separate queries with the same WHERE clause
    // but without the sorting and pagination

    const statusAgg: Record<string, number> = {};
    const statusQuery = `SELECT status, COUNT(*) as count FROM tasks ${whereClause} GROUP BY status`;
    let statusResult;
    if (values.length > 0) {
      statusResult = await client.query(statusQuery, values);
    } else {
      statusResult = await client.query(statusQuery);
    }
    statusResult.rows.forEach((r: any) => {
      statusAgg[r.status] = parseInt(r.count, 10);
    });

    const priorityAgg: Record<Priority, number> = {
      low: 0,
      normal: 0,
      high: 0,
      urgent: 0,
      critical: 0,
    };
    const priorityQuery = `SELECT priority, COUNT(*) as count FROM tasks ${whereClause} GROUP BY priority`;
    let priorityResult;
    if (values.length > 0) {
      priorityResult = await client.query(priorityQuery, values);
    } else {
      priorityResult = await client.query(priorityQuery);
    }
    priorityResult.rows.forEach((r: any) => {
      if (r.priority in priorityAgg) {
        priorityAgg[r.priority as Priority] = parseInt(r.count, 10);
      }
    });

    const typeAgg: Record<string, number> = {};
    const typeQuery = `SELECT type, COUNT(*) as count FROM tasks ${whereClause} GROUP BY type`;
    let typeResult;
    if (values.length > 0) {
      typeResult = await client.query(typeQuery, values);
    } else {
      typeResult = await client.query(typeQuery);
    }
    typeResult.rows.forEach((r: any) => {
      typeAgg[r.type] = parseInt(r.count, 10);
    });

    const assigneeAgg: Record<string, number> = {};
    const assigneeQuery = `SELECT assignee, COUNT(*) as count FROM tasks ${whereClause} GROUP BY assignee`;
    let assigneeResult;
    if (values.length > 0) {
      assigneeResult = await client.query(assigneeQuery, values);
    } else {
      assigneeResult = await client.query(assigneeQuery);
    }
    assigneeResult.rows.forEach((r: any) => {
      assigneeAgg[r.assignee] = parseInt(r.count, 10);
    });

    const aggregations: TaskSearchAggregations = {
      by_status: statusAgg,
      by_priority: priorityAgg,
      by_type: typeAgg,
      by_assignee: assigneeAgg,
    };

    return {
      tasks: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      aggregations,
    };
  } finally {
    client.release();
  }
}

  async updateTask(id: string, data: Partial<UpdateTaskInput>, userId: string): Promise<Task> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await this.getTaskById(id);
      if (!existing) {
        throw new AppError(404, 'Task not found');
      }

      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;
      const changes: TaskActivityChange[] = [];

      const addField = (field: string, value: any, oldValue: any) => {
        fields.push(`${field} = $${idx++}`);
        values.push(value);
        if (oldValue !== value) {
          changes.push({ field, from: oldValue, to: value });
        }
      };

      if (data.title !== undefined) addField('title', data.title, existing.title);
      if (data.description !== undefined) addField('description', data.description, existing.description);
      if (data.assignee !== undefined) addField('assignee', data.assignee, existing.assignee);
      if (data.priority !== undefined) addField('priority', data.priority, existing.priority);
      if (data.deadline !== undefined) {
        addField('deadline', data.deadline, existing.deadline);
        addField('due_date', data.deadline, existing.due_date);
      }
      if (data.start_date !== undefined) addField('start_date', data.start_date, existing.start_date);
      if (data.status !== undefined) addField('status', data.status, existing.status);
      if (data.progress !== undefined) addField('progress', data.progress, existing.progress);
      if (data.type !== undefined) addField('type', data.type, existing.type);
      if (data.visibility !== undefined) addField('visibility', data.visibility, existing.visibility);
      if (data.tags !== undefined) addField('tags', data.tags, existing.tags);
      if (data.estimated_hours !== undefined) addField('estimated_hours', data.estimated_hours, existing.estimated_hours);
      if (data.actual_hours !== undefined) addField('actual_hours', data.actual_hours, existing.actual_hours);
      if (data.parent_task_id !== undefined) addField('parent_task_id', data.parent_task_id, existing.parent_task_id);

      if (data.blocked_by !== undefined) {
        await client.query(
          'DELETE FROM task_dependencies WHERE task_id = $1 AND dependency_type = $2',
          [id, 'blocked_by']
        );
        for (const dependsOn of data.blocked_by) {
          await client.query(
            'INSERT INTO task_dependencies (task_id, depends_on, dependency_type, created_at) VALUES ($1, $2, $3, $4)',
            [id, dependsOn, 'blocked_by', new Date()]
          );
        }
        changes.push({ field: 'blocked_by', from: existing.blocked_by, to: data.blocked_by });
      }

      if (data.status === 'done' && existing.status !== 'done') {
        addField('completed_at', new Date(), null);
      }

      if (data.status === 'inprogress' && existing.status !== 'inprogress') {
        addField('started_at', new Date(), null);
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

      if (changes.length > 0) {
        const action = this.determineAction(changes);
        await this.logActivity(client, id, userId, action, { changes, metadata: data });
      }

      await client.query('COMMIT');
      return res.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private determineAction(changes: TaskActivityChange[]): TaskActivityAction {
    for (const change of changes) {
      if (change.field === 'status') {
        if (change.to === 'done') return 'completed';
        if (change.to === 'blocked') return 'blocked_by';
        return 'status_changed';
      }
      if (change.field === 'priority') return 'priority_changed';
      if (change.field === 'deadline' || change.field === 'due_date') return 'deadline_changed';
      if (change.field === 'assignee') return 'assigned';
    }
    return 'updated';
  }

  async deleteTask(id: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM task_dependencies WHERE task_id = $1 OR depends_on = $1', [id]);
      await client.query('DELETE FROM task_watchers WHERE task_id = $1', [id]);
      await client.query('DELETE FROM task_attachments WHERE task_id = $1', [id]);
      await client.query('DELETE FROM subtasks WHERE task_id = $1', [id]);
      await client.query('DELETE FROM task_notes WHERE task_id = $1', [id]);
      await client.query('DELETE FROM reminders WHERE task_id = $1', [id]);
      await client.query('DELETE FROM task_time_entries WHERE task_id = $1', [id]);
      await client.query('DELETE FROM tasks WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ─── Task Attachments ────────────────────────────────────────────────────────

  async addTaskAttachment(
    taskId: string,
    file: Express.Multer.File,
    userId: string
  ): Promise<TaskAttachment> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();

      const userRes = await client.query(
        'SELECT full_name FROM users WHERE id = $1',
        [userId]
      );
      const userName = userRes.rows[0]?.full_name || 'Unknown User';

      const query = `
        INSERT INTO task_attachments (
          id, task_id, file_name, file_url, file_size, mime_type,
          uploaded_by, uploaded_by_name, uploaded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;

      const res = await client.query(query, [
        id,
        taskId,
        file.originalname,
        file.path || file.filename,
        file.size,
        file.mimetype,
        userId,
        userName,
        now,
      ]);

      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async deleteTaskAttachment(id: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM task_attachments WHERE id = $1', [id]);
    } finally {
      client.release();
    }
  }

  // ─── Task Activity ──────────────────────────────────────────────────────────

  private async logActivity(
    client: any,
    taskId: string,
    userId: string,
    action: TaskActivityAction,
    data: { changes: TaskActivityChange[]; metadata: Record<string, unknown> }
  ): Promise<void> {
    const id = uuidv4();
    const now = new Date();

    const userRes = await client.query(
      'SELECT full_name FROM users WHERE id = $1',
      [userId]
    );
    const userName = userRes.rows[0]?.full_name || 'Unknown User';

    await client.query(
      `INSERT INTO task_activities (
        id, task_id, user_id, user_name, action, changes, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        taskId,
        userId,
        userName,
        action,
        JSON.stringify(data.changes),
        JSON.stringify(data.metadata),
        now,
      ]
    );
  }

  async getTaskActivities(
    taskId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ activities: TaskActivity[]; total: number }> {
    const client = await pool.connect();
    try {
      const offset = (page - 1) * limit;

      const countRes = await client.query(
        'SELECT COUNT(*) as total FROM task_activities WHERE task_id = $1',
        [taskId]
      );
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const res = await client.query(
        `SELECT * FROM task_activities WHERE task_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [taskId, limit, offset]
      );

      return { activities: res.rows, total };
    } finally {
      client.release();
    }
  }

  // ─── Subtasks ──────────────────────────────────────────────────────────────

  async createSubtask(data: CreateSubtaskInput, userId: string): Promise<Subtask> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();

      const userRes = await client.query(
        'SELECT full_name FROM users WHERE id = $1',
        [userId]
      );
      const userName = userRes.rows[0]?.full_name || 'Unknown User';

      const orderRes = await client.query(
        'SELECT MAX("order") as max_order FROM subtasks WHERE task_id = $1',
        [data.task_id]
      );
      const order = (orderRes.rows[0]?.max_order || 0) + 1;

      const query = `
        INSERT INTO subtasks (
          id, task_id, title, description, completed, assigned_to,
          due_date, priority, "order", created_by, created_by_name, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *;
      `;

      const res = await client.query(query, [
        id,
        data.task_id,
        data.title,
        data.description || null,
        false,
        data.assigned_to || null,
        data.due_date || null,
        data.priority || 'normal',
        order,
        userId,
        userName,
        now,
        now,
      ]);

      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async listSubtasksByTask(taskId: string): Promise<Subtask[]> {
    const client = await pool.connect();
    try {
      const res = await client.query(
        'SELECT * FROM subtasks WHERE task_id = $1 ORDER BY "order" ASC, created_at ASC',
        [taskId]
      );
      return res.rows;
    } finally {
      client.release();
    }
  }

  async updateSubtask(id: string, data: Partial<UpdateSubtaskInput>): Promise<Subtask> {
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
      if (data.completed !== undefined) {
        fields.push(`completed = $${idx++}`);
        values.push(data.completed);
        if (data.completed) {
          fields.push(`completed_at = $${idx++}`);
          values.push(new Date());
        } else {
          fields.push(`completed_at = $${idx++}`);
          values.push(null);
        }
      }
      if (data.assigned_to !== undefined) {
        fields.push(`assigned_to = $${idx++}`);
        values.push(data.assigned_to);
      }
      if (data.due_date !== undefined) {
        fields.push(`due_date = $${idx++}`);
        values.push(data.due_date);
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

  // ─── Task Notes ────────────────────────────────────────────────────────────

  async createTaskNote(data: CreateTaskNoteInput, userId: string): Promise<TaskNote> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();

      const userRes = await client.query(
        'SELECT full_name FROM users WHERE id = $1',
        [userId]
      );
      const userName = userRes.rows[0]?.full_name || 'Unknown User';

      const query = `
        INSERT INTO task_notes (
          id, task_id, content, is_internal, author_id, author_name,
          parent_note_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;

      const res = await client.query(query, [
        id,
        data.task_id,
        data.content,
        data.is_internal || false,
        userId,
        userName,
        data.parent_note_id || null,
        now,
        now,
      ]);

      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async listTaskNotes(taskId: string, includeInternal: boolean = false): Promise<TaskNote[]> {
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM task_notes WHERE task_id = $1';
      const values: any[] = [taskId];

      if (!includeInternal) {
        query += ' AND is_internal = false';
      }

      query += ' ORDER BY parent_note_id ASC, created_at ASC';

      const res = await client.query(query, values);
      return res.rows;
    } finally {
      client.release();
    }
  }

  async updateTaskNote(id: string, data: Partial<Pick<TaskNote, 'content' | 'is_internal'>>): Promise<TaskNote> {
    const client = await pool.connect();
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (data.content !== undefined) {
        fields.push(`content = $${idx++}`);
        values.push(data.content);
      }
      if (data.is_internal !== undefined) {
        fields.push(`is_internal = $${idx++}`);
        values.push(data.is_internal);
      }

      fields.push(`updated_at = $${idx++}`);
      values.push(new Date());

      if (fields.length === 0) {
        throw new AppError(400, 'No fields to update');
      }

      values.push(id);
      const query = `UPDATE task_notes SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *;`;
      const res = await client.query(query, values);
      if (res.rows.length === 0) {
        throw new AppError(404, 'Task note not found');
      }
      return res.rows[0];
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

  // ─── Reminders ──────────────────────────────────────────────────────────────

  async createReminder(data: CreateReminderInput, userId: string): Promise<Reminder> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();

      const userRes = await client.query(
        'SELECT full_name FROM users WHERE id = $1',
        [userId]
      );
      const userName = userRes.rows[0]?.full_name || 'Unknown User';

      const query = `
        INSERT INTO reminders (
          id, task_id, remind_at, sent, repeat, message,
          created_by, created_by_name, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `;

      const res = await client.query(query, [
        id,
        data.task_id,
        data.remind_at,
        false,
        data.repeat || 'none',
        data.message || null,
        userId,
        userName,
        now,
        now,
      ]);

      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async listRemindersForTask(taskId: string): Promise<Reminder[]> {
    const client = await pool.connect();
    try {
      const res = await client.query(
        'SELECT * FROM reminders WHERE task_id = $1 ORDER BY remind_at ASC',
        [taskId]
      );
      return res.rows;
    } finally {
      client.release();
    }
  }

  async updateReminder(id: string, data: Partial<Pick<Reminder, 'remind_at' | 'repeat' | 'message'>>): Promise<Reminder> {
    const client = await pool.connect();
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (data.remind_at !== undefined) {
        fields.push(`remind_at = $${idx++}`);
        values.push(data.remind_at);
      }
      if (data.repeat !== undefined) {
        fields.push(`repeat = $${idx++}`);
        values.push(data.repeat);
      }
      if (data.message !== undefined) {
        fields.push(`message = $${idx++}`);
        values.push(data.message);
      }

      fields.push(`updated_at = $${idx++}`);
      values.push(new Date());

      if (fields.length === 0) {
        throw new AppError(400, 'No fields to update');
      }

      values.push(id);
      const query = `UPDATE reminders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *;`;
      const res = await client.query(query, values);
      if (res.rows.length === 0) {
        throw new AppError(404, 'Reminder not found');
      }
      return res.rows[0];
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

  // ─── Task Watchers ──────────────────────────────────────────────────────────

  async addWatcher(taskId: string, userId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        'INSERT INTO task_watchers (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [taskId, userId]
      );
    } finally {
      client.release();
    }
  }

  async removeWatcher(taskId: string, userId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        'DELETE FROM task_watchers WHERE task_id = $1 AND user_id = $2',
        [taskId, userId]
      );
    } finally {
      client.release();
    }
  }

  // ─── Task Dependencies ──────────────────────────────────────────────────────

  async addDependency(taskId: string, dependsOn: string, type: 'blocks' | 'blocked_by' | 'relates_to'): Promise<void> {
    const client = await pool.connect();
    try {
      if (type === 'blocked_by') {
        const circularCheck = await client.query(
          `SELECT 1 FROM task_dependencies WHERE task_id = $1 AND depends_on = $2`,
          [dependsOn, taskId]
        );
        if (circularCheck.rows.length > 0) {
          throw new AppError(400, 'Circular dependency detected');
        }
      }

      await client.query(
        `INSERT INTO task_dependencies (task_id, depends_on, dependency_type, created_at) VALUES ($1, $2, $3, $4)`,
        [taskId, dependsOn, type, new Date()]
      );
    } finally {
      client.release();
    }
  }

  async removeDependency(id: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM task_dependencies WHERE id = $1', [id]);
    } finally {
      client.release();
    }
  }

  // ─── Task Time Tracking ────────────────────────────────────────────────────

  async startTimeEntry(taskId: string, userId: string): Promise<TaskTimeEntry> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();

      const userRes = await client.query(
        'SELECT full_name FROM users WHERE id = $1',
        [userId]
      );
      const userName = userRes.rows[0]?.full_name || 'Unknown User';

      await client.query(
        `UPDATE task_time_entries SET end_time = $1, duration = EXTRACT(EPOCH FROM ($1 - start_time))
         WHERE task_id = $2 AND user_id = $3 AND end_time IS NULL`,
        [now, taskId, userId]
      );

      const query = `
        INSERT INTO task_time_entries (
          id, task_id, user_id, user_name, start_time, end_time, description, billable, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `;

      const res = await client.query(query, [
        id,
        taskId,
        userId,
        userName,
        now,
        null,
        null,
        true,
        now,
        now,
      ]);

      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async stopTimeEntry(entryId: string): Promise<TaskTimeEntry> {
    const client = await pool.connect();
    try {
      const now = new Date();

      const query = `
        UPDATE task_time_entries 
        SET end_time = $1, duration = EXTRACT(EPOCH FROM ($1 - start_time)), updated_at = $1
        WHERE id = $2
        RETURNING *;
      `;

      const res = await client.query(query, [now, entryId]);
      if (res.rows.length === 0) {
        throw new AppError(404, 'Time entry not found');
      }
      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async getTimeEntriesForTask(taskId: string): Promise<TaskTimeEntry[]> {
    const client = await pool.connect();
    try {
      const res = await client.query(
        'SELECT * FROM task_time_entries WHERE task_id = $1 ORDER BY start_time DESC',
        [taskId]
      );
      return res.rows;
    } finally {
      client.release();
    }
  }

  async getTimeSummaryForTask(taskId: string): Promise<{ total_duration: number; billable_duration: number; entries: TaskTimeEntry[]; last_entry: TaskTimeEntry | null }> {
    const entries = await this.getTimeEntriesForTask(taskId);
    const totalDuration = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
    const billableDuration = entries.filter(e => e.billable).reduce((sum, e) => sum + (e.duration || 0), 0);
    const lastEntry = entries.length > 0 ? entries[0] : null;

    return {
      entries,
      total_duration: totalDuration,
      billable_duration: billableDuration,
      last_entry: lastEntry,
    };
  }

  // ─── Task Templates ─────────────────────────────────────────────────────────

  async createTemplate(data: CreateTaskTemplateInput, userId: string): Promise<TaskTemplate> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();

      const userRes = await client.query(
        'SELECT full_name FROM users WHERE id = $1',
        [userId]
      );
      const userName = userRes.rows[0]?.full_name || 'Unknown User';

      const query = `
        INSERT INTO task_templates (
          id, title, description, type, priority, estimated_hours, tags,
          created_by, created_by_name, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
      `;

      const res = await client.query(query, [
        id,
        data.title,
        data.description || null,
        data.type || 'task',
        data.priority || 'normal',
        data.estimated_hours || null,
        data.tags || [],
        userId,
        userName,
        now,
        now,
      ]);

      if (data.subtasks && data.subtasks.length > 0) {
        for (const subtask of data.subtasks) {
          const subtaskId = uuidv4();
          await client.query(
            `INSERT INTO task_template_subtasks (id, template_id, title, description, priority, estimated_hours)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [subtaskId, id, subtask.title, subtask.description || null, subtask.priority || 'normal', subtask.estimated_hours || null]
          );
        }
      }

      const template = res.rows[0];
      const subtasksRes = await client.query(
        'SELECT * FROM task_template_subtasks WHERE template_id = $1 ORDER BY created_at ASC',
        [id]
      );
      template.subtasks = subtasksRes.rows;

      return template;
    } finally {
      client.release();
    }
  }

  async getTemplates(): Promise<TaskTemplate[]> {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT * FROM task_templates ORDER BY created_at DESC');
      const templates = res.rows;

      for (const template of templates) {
        const subtasksRes = await client.query(
          'SELECT * FROM task_template_subtasks WHERE template_id = $1 ORDER BY created_at ASC',
          [template.id]
        );
        template.subtasks = subtasksRes.rows;
      }

      return templates;
    } finally {
      client.release();
    }
  }

  async applyTemplate(templateId: string, projectId: string | null, userId: string): Promise<Task> {
    const client = await pool.connect();
    try {
      const templateRes = await client.query('SELECT * FROM task_templates WHERE id = $1', [templateId]);
      if (templateRes.rows.length === 0) {
        throw new AppError(404, 'Template not found');
      }

      const tpl = templateRes.rows[0];

      const taskData: CreateTaskInput = {
        project_id: projectId || null,
        title: tpl.title,
        description: tpl.description,
        assignee: null,
        priority: tpl.priority,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        start_date: new Date().toISOString(),
        type: tpl.type,
        visibility: 'team',
        tags: tpl.tags,
        estimated_hours: tpl.estimated_hours,
      };

      const task = await this.createTask(taskData, userId);

      const subtasksRes = await client.query(
        'SELECT * FROM task_template_subtasks WHERE template_id = $1',
        [templateId]
      );

      for (const st of subtasksRes.rows) {
        await this.createSubtask({
          task_id: task.id,
          title: st.title,
          description: st.description,
          due_date: null,
          priority: st.priority,
        }, userId);
      }

      return task;
    } finally {
      client.release();
    }
  }

  // ─── Dashboard / Stats ─────────────────────────────────────────────────────

  async getDashboardStats(userId: string): Promise<TaskDashboardStats> {
    const client = await pool.connect();
    try {
      const statusAgg: Record<string, number> = {};
      const typeAgg: Record<string, number> = {};

      const priorityAgg: Record<Priority, number> = {
        low: 0,
        normal: 0,
        high: 0,
        urgent: 0,
        critical: 0,
      };

      const res = await client.query(
        `SELECT * FROM tasks WHERE assignee = $1 OR assignee = 'GROUP'`,
        [userId]
      );

      const tasks = res.rows;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());

      let overdue = 0;
      let dueToday = 0;
      let dueThisWeek = 0;
      let completedToday = 0;
      let completedThisWeek = 0;
      let totalDuration = 0;

      for (const task of tasks) {
        statusAgg[task.status] = (statusAgg[task.status] || 0) + 1;
        typeAgg[task.type] = (typeAgg[task.type] || 0) + 1;
        if (task.priority in priorityAgg) {
          priorityAgg[task.priority as Priority] = (priorityAgg[task.priority as Priority] || 0) + 1;
        }

        if (task.due_date && task.status !== 'done') {
          const dueDate = new Date(task.due_date);
          if (dueDate < now) overdue++;
        }

        if (task.due_date && task.status !== 'done') {
          const dueDate = new Date(task.due_date);
          if (dueDate >= today && dueDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
            dueToday++;
          }
        }

        if (task.due_date && task.status !== 'done') {
          const dueDate = new Date(task.due_date);
          if (dueDate >= weekStart && dueDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)) {
            dueThisWeek++;
          }
        }

        if (task.completed_at) {
          const completed = new Date(task.completed_at);
          if (completed >= today && completed < new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
            completedToday++;
          }
          if (completed >= weekStart) {
            completedThisWeek++;
          }
        }

        if (task.estimated_hours) {
          totalDuration += task.estimated_hours;
        }
      }

      const withAttachmentsRes = await client.query(
        `SELECT COUNT(DISTINCT task_id) as count FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE assignee = $1 OR assignee = 'GROUP')`,
        [userId]
      );
      const tasksWithAttachments = parseInt(withAttachmentsRes.rows[0]?.count || '0', 10);

      const withNotesRes = await client.query(
        `SELECT COUNT(DISTINCT task_id) as count FROM task_notes WHERE task_id IN (SELECT id FROM tasks WHERE assignee = $1 OR assignee = 'GROUP')`,
        [userId]
      );
      const tasksWithNotes = parseInt(withNotesRes.rows[0]?.count || '0', 10);

      return {
        total: tasks.length,
        by_status: statusAgg,
        by_priority: priorityAgg,
        by_type: typeAgg,
        overdue,
        due_today: dueToday,
        due_this_week: dueThisWeek,
        completed_today: completedToday,
        completed_this_week: completedThisWeek,
        average_completion_time: tasks.length > 0 ? totalDuration / tasks.length : 0,
        tasks_with_attachments: tasksWithAttachments,
        tasks_with_notes: tasksWithNotes,
      };
    } finally {
      client.release();
    }
  }

  async getUserStats(userId: string): Promise<UserTaskStats> {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'todo') as todo,
          COUNT(*) FILTER (WHERE status = 'inprogress') as inprogress,
          COUNT(*) FILTER (WHERE status = 'done') as done,
          COUNT(*) FILTER (WHERE status = 'overdue') as overdue
         FROM tasks WHERE assignee = $1`,
        [userId]
      );

      const row = res.rows[0];
      const total = parseInt(row.total || '0', 10);
      const done = parseInt(row.done || '0', 10);

      const userRes = await client.query(
        'SELECT full_name FROM users WHERE id = $1',
        [userId]
      );

      return {
        user_id: userId,
        user_name: userRes.rows[0]?.full_name || 'Unknown User',
        assigned: total,
        in_progress: parseInt(row.inprogress || '0', 10),
        done: done,
        overdue: parseInt(row.overdue || '0', 10),
        completion_rate: total > 0 ? Math.round((done / total) * 100) : 0,
        average_response_time: 0,
        tasks_completed: done,
      };
    } finally {
      client.release();
    }
  }

  // ─── Task Export ────────────────────────────────────────────────────────────

  async exportTasks(options: TaskExportOptions, userId: string): Promise<TaskExportResult> {
    const client = await pool.connect();
    try {
      let query = `SELECT * FROM tasks WHERE (assignee = $1 OR assignee = 'GROUP')`;
      const values: any[] = [userId];
      let idx = 2;

      if (options.date_from) {
        query += ` AND created_at >= $${idx++}`;
        values.push(options.date_from);
      }
      if (options.date_to) {
        query += ` AND created_at <= $${idx++}`;
        values.push(options.date_to);
      }

      const tasks = await client.query(query, values);

      const exportData = tasks.rows.map((task: any) => {
        const row: Record<string, any> = {};
        for (const field of options.fields) {
          if (field in task) {
            row[field] = task[field];
          }
        }
        return row;
      });

      const filename = `tasks-export-${Date.now()}.${options.format}`;

      return {
        url: `/exports/${filename}`,
        filename,
        size: JSON.stringify(exportData).length,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
    } finally {
      client.release();
    }
  }

  // ─── Helper: get full task ─────────────────────────────────────────────────

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
      this.listTaskNotes(taskId, false),
      this.listRemindersForTask(taskId),
    ]);

    return { task, subtasks, notes, reminders };
  }

  // ─── Reminder Scheduler ─────────────────────────────────────────────────

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
        if (reminder.assignee && reminder.assignee !== 'GROUP') {
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
              ${reminder.message ? `<p><strong>Message:</strong> ${reminder.message}</p>` : ''}
              <p>Please take the necessary action.</p>
            `;
            await sendMail({
              to: email,
              subject: `Reminder: ${reminder.task_title}`,
              html,
            });
          }
        }
        await client.query('UPDATE reminders SET sent = true, sent_at = $1 WHERE id = $2', [now, reminder.id]);
      }
    } finally {
      client.release();
    }
  }


  // Add these missing methods to the TaskService class in tasks.service.ts

// ─── Task Templates - Additional CRUD Operations ────────────────────────────

/**
 * Get a single template by ID
 */
async getTemplate(id: string): Promise<TaskTemplate | null> {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM task_templates WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    
    const template = res.rows[0];
    const subtasksRes = await client.query(
      'SELECT * FROM task_template_subtasks WHERE template_id = $1 ORDER BY created_at ASC',
      [id]
    );
    template.subtasks = subtasksRes.rows;
    
    return template;
  } finally {
    client.release();
  }
}

/**
 * Update an existing template
 */
async updateTemplate(id: string, data: Partial<CreateTaskTemplateInput>): Promise<TaskTemplate> {
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
    if (data.type !== undefined) {
      fields.push(`type = $${idx++}`);
      values.push(data.type);
    }
    if (data.priority !== undefined) {
      fields.push(`priority = $${idx++}`);
      values.push(data.priority);
    }
    if (data.estimated_hours !== undefined) {
      fields.push(`estimated_hours = $${idx++}`);
      values.push(data.estimated_hours);
    }
    if (data.tags !== undefined) {
      fields.push(`tags = $${idx++}`);
      values.push(data.tags);
    }

    fields.push(`updated_at = $${idx++}`);
    values.push(new Date());

    if (fields.length === 0) {
      throw new AppError(400, 'No fields to update');
    }

    values.push(id);
    const query = `UPDATE task_templates SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *;`;
    const res = await client.query(query, values);
    if (res.rows.length === 0) {
      throw new AppError(404, 'Template not found');
    }

    // Update subtasks if provided
    if (data.subtasks !== undefined) {
      // Delete existing subtasks
      await client.query('DELETE FROM task_template_subtasks WHERE template_id = $1', [id]);
      
      // Insert new subtasks
      for (const subtask of data.subtasks) {
        const subtaskId = uuidv4();
        await client.query(
          `INSERT INTO task_template_subtasks (id, template_id, title, description, priority, estimated_hours)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [subtaskId, id, subtask.title, subtask.description || null, subtask.priority || 'normal', subtask.estimated_hours || null]
        );
      }
    }

    await client.query('COMMIT');

    const template = res.rows[0];
    const subtasksRes = await client.query(
      'SELECT * FROM task_template_subtasks WHERE template_id = $1 ORDER BY created_at ASC',
      [id]
    );
    template.subtasks = subtasksRes.rows;

    return template;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a template
 */
async deleteTemplate(id: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM task_template_subtasks WHERE template_id = $1', [id]);
    await client.query('DELETE FROM task_templates WHERE id = $1', [id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ─── Time Tracking - Delete Time Entry ──────────────────────────────────────

/**
 * Delete a time entry
 */
async deleteTimeEntry(entryId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM task_time_entries WHERE id = $1', [entryId]);
  } finally {
    client.release();
  }
}

// ─── Members ──────────────────────────────────────────────────────────────────

/**
 * Get all members (users who are assigned to tasks)
 */
async getMembers(): Promise<{ id: string; name: string; email: string; role: string; color: string; avatar_url?: string; department?: string; is_active: boolean; joined_at: Date }[]> {
  const client = await pool.connect();
  try {
    // Get all users who are either assigned to tasks or are project members
    const res = await client.query(`
      SELECT DISTINCT 
        u.id, 
        u.full_name as name, 
        u.email, 
        u.role, 
        u.color,
        u.avatar_url,
        u.department,
        u.is_active,
        u.created_at as joined_at
      FROM users u
      WHERE u.id IN (
        SELECT assignee FROM tasks WHERE assignee IS NOT NULL AND assignee != 'GROUP'
        UNION
        SELECT user_id FROM project_members
      )
      ORDER BY u.full_name ASC
    `);
    return res.rows;
  } finally {
    client.release();
  }
}

// ─── Task Dependencies - Get Dependencies ────────────────────────────────────

/**
 * Get all dependencies for a task
 */
async getTaskDependencies(taskId: string): Promise<TaskDependency[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      'SELECT * FROM task_dependencies WHERE task_id = $1 OR depends_on = $1 ORDER BY created_at DESC',
      [taskId]
    );
    return res.rows;
  } finally {
    client.release();
  }
}

// ─── Task Watchers - Get Watchers ───────────────────────────────────────────

/**
 * Get all watchers for a task
 */
async getTaskWatchers(taskId: string): Promise<string[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      'SELECT user_id FROM task_watchers WHERE task_id = $1',
      [taskId]
    );
    return res.rows.map((r) => r.user_id);
  } finally {
    client.release();
  }
}

// ─── Task Notes - Get Note Attachments ──────────────────────────────────────

/**
 * Get attachments for a task note
 */
async getTaskNoteAttachments(noteId: string): Promise<{ id: string; note_id: string; file_name: string; file_url: string; file_size: number; mime_type: string; uploaded_at: Date }[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      'SELECT * FROM task_note_attachments WHERE note_id = $1 ORDER BY uploaded_at DESC',
      [noteId]
    );
    return res.rows;
  } finally {
    client.release();
  }
}

// ─── Task Search ─────────────────────────────────────────────────────────────

/**
 * Advanced search with full-text search capabilities
 */
async searchTasks(
  query: string,
  filters?: Partial<TaskFilters>,
  userId?: string
): Promise<TaskSearchResult> {
  const client = await pool.connect();
  try {
    let sql = `
      SELECT t.*,
        ts_rank_cd(to_tsvector('english', t.title || ' ' || COALESCE(t.description, '')), plainto_tsquery('english', $1)) as rank
      FROM tasks t
      WHERE t.id IN (
        SELECT id FROM tasks 
        WHERE to_tsvector('english', title || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $1)
      )
    `;
    const values: any[] = [query];
    let idx = 2;

    // Apply additional filters
    if (filters?.project_id) {
      sql += ` AND t.project_id = $${idx++}`;
      values.push(filters.project_id);
    }
    if (filters?.assignee) {
      sql += ` AND t.assignee = $${idx++}`;
      values.push(filters.assignee);
    }
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        const placeholders = filters.status.map((_, i) => `$${idx + i}`).join(',');
        sql += ` AND t.status IN (${placeholders})`;
        values.push(...filters.status);
        idx += filters.status.length;
      } else {
        sql += ` AND t.status = $${idx++}`;
        values.push(filters.status);
      }
    }
    if (filters?.priority) {
      if (Array.isArray(filters.priority)) {
        const placeholders = filters.priority.map((_, i) => `$${idx + i}`).join(',');
        sql += ` AND t.priority IN (${placeholders})`;
        values.push(...filters.priority);
        idx += filters.priority.length;
      } else {
        sql += ` AND t.priority = $${idx++}`;
        values.push(filters.priority);
      }
    }

    if (filters?.tags && filters.tags.length > 0) {
      const placeholders = filters.tags.map((_, i) => `$${idx + i}`).join(',');
      sql += ` AND t.tags && ARRAY[${placeholders}]`;
      values.push(...filters.tags);
      idx += filters.tags.length;
    }

    sql += ` ORDER BY rank DESC LIMIT 50`;

    const res = await client.query(sql, values);

    // Get count
    const countRes = await client.query(
      `SELECT COUNT(*) as total FROM (${sql}) as subquery`,
      values
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    return {
      tasks: res.rows,
      total,
      page: 1,
      limit: 50,
      totalPages: Math.ceil(total / 50),
      aggregations: {
        by_status: {},
        by_priority: {
          low: 0,
          normal: 0,
          high: 0,
          urgent: 0,
          critical: 0,
        },
        by_type: {},
        by_assignee: {},
      },
    };
  } finally {
    client.release();
  }
}

// ─── Bulk Operations ─────────────────────────────────────────────────────────

/**
 * Bulk update tasks
 */
async bulkUpdateTasks(
  taskIds: string[],
  updates: Partial<UpdateTaskInput>,
  userId: string
): Promise<Task[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updatedTasks: Task[] = [];
    for (const taskId of taskIds) {
      const task = await this.updateTask(taskId, updates, userId);
      updatedTasks.push(task);
    }

    await client.query('COMMIT');
    return updatedTasks;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Bulk delete tasks
 */
async bulkDeleteTasks(taskIds: string[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const taskId of taskIds) {
      await this.deleteTask(taskId);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ─── Task Archive ────────────────────────────────────────────────────────────

/**
 * Archive a task (soft delete)
 */
async archiveTask(id: string, userId: string): Promise<Task> {
  return this.updateTask(id, { status: 'archived' }, userId);
}

/**
 * Restore an archived task
 */
async restoreTask(id: string, userId: string): Promise<Task> {
  return this.updateTask(id, { status: 'todo' }, userId);
}

// ─── Task History ────────────────────────────────────────────────────────────

/**
 * Get task history (activities) with pagination
 */
async getTaskHistory(
  taskId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ activities: TaskActivity[]; total: number }> {
  return this.getTaskActivities(taskId, page, limit);
}

// ─── Project Progress Recalculation ─────────────────────────────────────────

/**
 * Recalculate project progress based on tasks
 */
async recalculateProjectProgress(projectId: string): Promise<number> {
  const client = await pool.connect();
  try {
    const tasksRes = await client.query(
      'SELECT status FROM tasks WHERE project_id = $1',
      [projectId]
    );
    const tasks = tasksRes.rows;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'done').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    await client.query(
      'UPDATE projects SET progress = $1 WHERE id = $2',
      [progress, projectId]
    );

    return progress;
  } finally {
    client.release();
  }
}

// ─── Task Comments ──────────────────────────────────────────────────────────

/**
 * Get all comments (notes) for a task with threading
 */
async getTaskComments(
  taskId: string,
  includeInternal: boolean = false
): Promise<TaskNote[]> {
  const notes = await this.listTaskNotes(taskId, includeInternal);
  // Build thread hierarchy
  const noteMap = new Map<string, TaskNote & { replies?: TaskNote[] }>();
  const rootNotes: (TaskNote & { replies?: TaskNote[] })[] = [];

  notes.forEach(note => {
    const noteWithReplies = { ...note, replies: [] };
    noteMap.set(note.id, noteWithReplies);
  });

  notes.forEach(note => {
    const noteWithReplies = noteMap.get(note.id)!;
    if (note.parent_note_id && noteMap.has(note.parent_note_id)) {
      const parent = noteMap.get(note.parent_note_id)!;
      parent.replies!.push(noteWithReplies);
    } else {
      rootNotes.push(noteWithReplies);
    }
  });

  return rootNotes;
}
}