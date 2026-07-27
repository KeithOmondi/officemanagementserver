// src/features/tasks/tasks.service.ts
import { deleteFromCloudinary, uploadMultipleToCloudinary } from '../../config/cloudinary';
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
//import type { Express } from 'express';
import type {
  Task,
  TaskList,
  Subtask,
  Attachment,
  TaskPaginationResponse,
  TaskSummary,
  CreateTaskInput,
  UpdateTaskInput,
  CreateSubtaskInput,
  UpdateSubtaskInput,
  CreateTaskListInput,
  UpdateTaskListInput,
  TaskFilters,
} from './tasks.types';

// ─── SELECT fragments ──────────────────────────────────────────────────────────

const TASK_SELECT = `
  t.id, t.title, t.list_id, l.name AS list_name,
  t.status, t.day, t.in_my_day, t.notes, t.priority,
  t.due_date, t.completed_at,
  t.created_by, cu.full_name AS created_by_name,
  t.assigned_to, au.full_name AS assigned_to_name,
  t.reminder_date, t.reminder_time,
  t.tags, t.is_active, t.created_at, t.updated_at,
  (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.is_active = true) AS subtask_count,
  (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.completed = true AND s.is_active = true) AS completed_subtask_count
`;

const TASK_JOIN = `
  FROM tasks t
  LEFT JOIN task_lists l ON l.id = t.list_id
  LEFT JOIN users cu ON cu.id = t.created_by
  LEFT JOIN users au ON au.id = t.assigned_to
`;

const LIST_SELECT = `
  l.id, l.name, l.color, l.icon, l.is_shared,
  l.created_by, cu.full_name AS created_by_name,
  l.is_active, l.created_at, l.updated_at,
  (SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id AND t.is_active = true) AS task_count,
  (SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id AND t.status = 'completed' AND t.is_active = true) AS completed_task_count
`;

const LIST_JOIN = `
  FROM task_lists l
  LEFT JOIN users cu ON cu.id = l.created_by
`;

const SUBTASK_SELECT = `
  s.id, s.task_id, s.title, s.completed, s.created_at, s.updated_at
`;

const SUBTASK_JOIN = `
  FROM subtasks s
`;

const ATTACHMENT_SELECT = `
  a.id, a.task_id, a.public_id, a.url, a.filename, a.mimetype, a.size, a.uploaded_at
`;

const ATTACHMENT_JOIN = `
  FROM attachments a
`;

const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'due_date', 'priority', 'title']);

// ─── Helper: Parse tags ──────────────────────────────────────────────────────

const parseTags = (tags: string | string[] | null | undefined): string[] => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return tags.split(',').map(t => t.trim()).filter(Boolean);
};

// ─── Helper: Handle null to undefined conversion for DB queries ─────────────

const toDbValue = <T>(value: T | null | undefined): T | null => {
  if (value === undefined) return null;
  return value as T;
};

// ─── Service ───────────────────────────────────────────────────────────────────

export class TaskService {

  // ═══════════════════════════════════════════════════════════════════════════
  //  TASK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Create Task ────────────────────────────────────────────────────────────

  static async createTask(input: CreateTaskInput, userId: string): Promise<Task> {
    const tags = parseTags(input.tags);

    const { rows } = await pool.query(
      `INSERT INTO tasks
         (title, list_id, day, in_my_day, notes, priority, due_date, assigned_to, created_by, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        input.title.trim(),
        toDbValue(input.list_id),
        input.day || 'Today',
        input.in_my_day || false,
        toDbValue(input.notes),
        input.priority || 'medium',
        toDbValue(input.due_date),
        toDbValue(input.assigned_to),
        userId,
        tags.length > 0 ? tags : null,
      ]
    );

    const task = await this.findTaskById(rows[0].id);
    if (!task) throw new AppError(500, 'Failed to create task');
    return task;
  }

  // ── Find All Tasks ─────────────────────────────────────────────────────────

  static async findAllTasks(filters: TaskFilters, userId?: string): Promise<TaskPaginationResponse> {
    const {
      list_id, status, day, in_my_day, assigned_to,
      tags, search,
      due_from, due_to,
      page = 1, limit = 20,
      sort_by = 'created_at', sort_order = 'DESC',
    } = filters;

    const sortCol = ALLOWED_SORT.has(sort_by) ? `t.${sort_by}` : 't.created_at';
    const sortDir = sort_order === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const conditions: string[] = ['t.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    // Only show tasks visible to the user
    if (userId) {
      conditions.push(`(t.created_by = $${p} OR t.assigned_to = $${p} OR t.list_id IS NULL)`);
      values.push(userId);
      p++;
    }

    if (list_id) { conditions.push(`t.list_id = $${p}`); values.push(list_id); p++; }
    if (status) { conditions.push(`t.status = $${p}`); values.push(status); p++; }
    if (day) { conditions.push(`t.day = $${p}`); values.push(day); p++; }
    if (in_my_day !== undefined) { conditions.push(`t.in_my_day = $${p}`); values.push(in_my_day); p++; }
    if (assigned_to) { conditions.push(`t.assigned_to = $${p}`); values.push(assigned_to); p++; }

    if (tags) {
      const tagArray = parseTags(tags);
      if (tagArray.length > 0) {
        conditions.push(`t.tags && $${p}`);
        values.push(tagArray);
        p++;
      }
    }

    if (search) {
      conditions.push(`t.title ILIKE $${p}`);
      values.push(`%${search}%`);
      p++;
    }

    if (due_from) {
      conditions.push(`t.due_date >= $${p}`);
      values.push(due_from);
      p++;
    }

    if (due_to) {
      conditions.push(`t.due_date <= $${p}`);
      values.push(due_to);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total ${TASK_JOIN} ${where}`, values),
      pool.query(
        `SELECT ${TASK_SELECT} ${TASK_JOIN}
         ${where}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT $${p} OFFSET $${p + 1}`,
        [...values, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
    return {
      data: dataResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Find Task by ID ────────────────────────────────────────────────────────

  static async findTaskById(id: string): Promise<Task | null> {
    const { rows } = await pool.query(
      `SELECT ${TASK_SELECT} ${TASK_JOIN} WHERE t.id = $1 AND t.is_active = true`,
      [id]
    );
    if (!rows[0]) return null;

    const task = rows[0];
    task.subtasks = await this.getSubtasks(id);
    // Attachments are not included by default to avoid overhead.
    // Use getTaskAttachments() separately if needed.
    return task;
  }

  // ── Update Task ────────────────────────────────────────────────────────────

  static async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    const existing = await this.findTaskById(id);
    if (!existing) throw new AppError(404, 'Task not found');

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    // Helper to add update
    const addUpdate = (field: string, value: unknown) => {
      updates.push(`${field} = $${p++}`);
      values.push(value);
    };

    if (input.title !== undefined) { addUpdate('title', input.title.trim()); }
    if (input.list_id !== undefined) { addUpdate('list_id', toDbValue(input.list_id)); }
    if (input.status !== undefined) { 
      addUpdate('status', input.status);
      if (input.status === 'completed') {
        updates.push(`completed_at = NOW()`);
      } else {
        updates.push(`completed_at = NULL`);
      }
    }
    if (input.day !== undefined) { addUpdate('day', input.day); }
    if (input.in_my_day !== undefined) { addUpdate('in_my_day', input.in_my_day); }
    if (input.notes !== undefined) { addUpdate('notes', toDbValue(input.notes)); }
    if (input.priority !== undefined) { addUpdate('priority', input.priority); }
    if (input.due_date !== undefined) { addUpdate('due_date', toDbValue(input.due_date)); }
    if (input.assigned_to !== undefined) { addUpdate('assigned_to', toDbValue(input.assigned_to)); }
    if (input.tags !== undefined) { 
      const tags = parseTags(input.tags);
      addUpdate('tags', tags.length > 0 ? tags : null);
    }
    if (input.reminder_date !== undefined) { addUpdate('reminder_date', toDbValue(input.reminder_date)); }
    if (input.reminder_time !== undefined) { addUpdate('reminder_time', toDbValue(input.reminder_time)); }

    if (!updates.length) return existing;

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${p} AND is_active = true`,
      values
    );

    const updated = await this.findTaskById(id);
    if (!updated) throw new AppError(500, 'Failed to update task');
    return updated;
  }

  // ── Toggle Task Status ────────────────────────────────────────────────────

  static async toggleTaskStatus(id: string, status: 'pending' | 'completed' | 'archived'): Promise<Task> {
    return this.updateTask(id, { status });
  }

  // ── Delete Task ────────────────────────────────────────────────────────────

  static async deleteTask(id: string): Promise<void> {
    const existing = await this.findTaskById(id);
    if (!existing) throw new AppError(404, 'Task not found');

    await pool.query(
      `UPDATE tasks SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Soft delete subtasks
    await pool.query(
      `UPDATE subtasks SET is_active = false WHERE task_id = $1`,
      [id]
    );
  }

  // ── Get Task Summary ──────────────────────────────────────────────────────

  static async getTaskSummary(userId?: string): Promise<TaskSummary> {
    const conditions: string[] = ['t.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (userId) {
      conditions.push(`(t.created_by = $${p} OR t.assigned_to = $${p})`);
      values.push(userId);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE t.status = 'completed') AS completed,
         COUNT(*) FILTER (WHERE t.status = 'pending') AS pending,
         COUNT(*) FILTER (WHERE t.status = 'archived') AS archived,
         COUNT(*) FILTER (WHERE t.in_my_day = true) AS in_my_day,
         COUNT(*) FILTER (WHERE t.day = 'Today') AS day_today,
         COUNT(*) FILTER (WHERE t.day = 'Tomorrow') AS day_tomorrow,
         COUNT(*) FILTER (WHERE t.day = 'Upcoming') AS day_upcoming,
         COUNT(*) FILTER (WHERE t.day = 'Someday') AS day_someday,
         COUNT(*) FILTER (WHERE t.priority = 'low') AS priority_low,
         COUNT(*) FILTER (WHERE t.priority = 'medium') AS priority_medium,
         COUNT(*) FILTER (WHERE t.priority = 'high') AS priority_high,
         COUNT(*) FILTER (WHERE t.priority = 'urgent') AS priority_urgent
       FROM tasks t
       ${where}`,
      values
    );

    const row = rows[0] || {};
    return {
      total: parseInt(row.total || '0', 10),
      completed: parseInt(row.completed || '0', 10),
      pending: parseInt(row.pending || '0', 10),
      archived: parseInt(row.archived || '0', 10),
      in_my_day: parseInt(row.in_my_day || '0', 10),
      by_day: {
        Today: parseInt(row.day_today || '0', 10),
        Tomorrow: parseInt(row.day_tomorrow || '0', 10),
        Upcoming: parseInt(row.day_upcoming || '0', 10),
        Someday: parseInt(row.day_someday || '0', 10),
      },
      by_priority: {
        low: parseInt(row.priority_low || '0', 10),
        medium: parseInt(row.priority_medium || '0', 10),
        high: parseInt(row.priority_high || '0', 10),
        urgent: parseInt(row.priority_urgent || '0', 10),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SUBTASK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Get Subtasks ─────────────────────────────────────────────────────────

  static async getSubtasks(taskId: string): Promise<Subtask[]> {
    const { rows } = await pool.query(
      `SELECT ${SUBTASK_SELECT} ${SUBTASK_JOIN}
       WHERE s.task_id = $1 AND s.is_active = true
       ORDER BY s.created_at ASC`,
      [taskId]
    );
    return rows;
  }

  // ── Create Subtask ────────────────────────────────────────────────────────

  static async createSubtask(taskId: string, input: CreateSubtaskInput): Promise<Subtask> {
    const task = await this.findTaskById(taskId);
    if (!task) throw new AppError(404, 'Task not found');

    const { rows } = await pool.query(
      `INSERT INTO subtasks (task_id, title)
       VALUES ($1, $2)
       RETURNING id`,
      [taskId, input.title.trim()]
    );

    const { rows: subtaskRows } = await pool.query(
      `SELECT ${SUBTASK_SELECT} ${SUBTASK_JOIN} WHERE s.id = $1`,
      [rows[0].id]
    );

    return subtaskRows[0];
  }

  // ── Update Subtask ────────────────────────────────────────────────────────

  static async updateSubtask(taskId: string, subtaskId: string, input: UpdateSubtaskInput): Promise<Subtask> {
    const { rows: existing } = await pool.query(
      `SELECT id FROM subtasks WHERE id = $1 AND task_id = $2 AND is_active = true`,
      [subtaskId, taskId]
    );
    if (!existing.length) throw new AppError(404, 'Subtask not found');

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.title !== undefined) { updates.push(`title = $${p++}`); values.push(input.title.trim()); }
    if (input.completed !== undefined) { updates.push(`completed = $${p++}`); values.push(input.completed); }

    if (!updates.length) {
      const { rows: subtaskRows } = await pool.query(
        `SELECT ${SUBTASK_SELECT} ${SUBTASK_JOIN} WHERE s.id = $1`,
        [subtaskId]
      );
      return subtaskRows[0];
    }

    updates.push(`updated_at = NOW()`);
    values.push(subtaskId);

    await pool.query(
      `UPDATE subtasks SET ${updates.join(', ')} WHERE id = $${p} AND is_active = true`,
      values
    );

    const { rows: subtaskRows } = await pool.query(
      `SELECT ${SUBTASK_SELECT} ${SUBTASK_JOIN} WHERE s.id = $1`,
      [subtaskId]
    );

    return subtaskRows[0];
  }

  // ── Delete Subtask ────────────────────────────────────────────────────────

  static async deleteSubtask(taskId: string, subtaskId: string): Promise<void> {
    const { rows } = await pool.query(
      `UPDATE subtasks SET is_active = false WHERE id = $1 AND task_id = $2 RETURNING id`,
      [subtaskId, taskId]
    );
    if (!rows.length) throw new AppError(404, 'Subtask not found');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  TASK LIST OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Create Task List ─────────────────────────────────────────────────────

  static async createTaskList(input: CreateTaskListInput, userId: string): Promise<TaskList> {
    const { rows } = await pool.query(
      `INSERT INTO task_lists (name, color, icon, is_shared, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        input.name.trim(),
        toDbValue(input.color),
        toDbValue(input.icon),
        input.is_shared || false,
        userId,
      ]
    );

    // Add members if shared
    if (input.is_shared && input.member_ids && input.member_ids.length > 0) {
      for (const memberId of input.member_ids) {
        await pool.query(
          `INSERT INTO task_list_members (list_id, user_id)
           VALUES ($1, $2)`,
          [rows[0].id, memberId]
        );
      }
    }

    const list = await this.findTaskListById(rows[0].id);
    if (!list) throw new AppError(500, 'Failed to create task list');
    return list;
  }

  // ── Find All Task Lists ──────────────────────────────────────────────────

  static async findAllTaskLists(userId?: string): Promise<TaskList[]> {
    const conditions: string[] = ['l.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (userId) {
      conditions.push(`(l.created_by = $${p} OR EXISTS (
        SELECT 1 FROM task_list_members tlm 
        WHERE tlm.list_id = l.id AND tlm.user_id = $${p} AND tlm.is_active = true
      ))`);
      values.push(userId);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT ${LIST_SELECT} ${LIST_JOIN}
       ${where}
       ORDER BY l.name ASC`,
      values
    );

    return rows;
  }

  // ── Find Task List by ID ─────────────────────────────────────────────────

  static async findTaskListById(id: string): Promise<TaskList | null> {
    const { rows } = await pool.query(
      `SELECT ${LIST_SELECT} ${LIST_JOIN} WHERE l.id = $1 AND l.is_active = true`,
      [id]
    );
    return rows[0] || null;
  }

  // ── Update Task List ─────────────────────────────────────────────────────

  static async updateTaskList(id: string, input: UpdateTaskListInput): Promise<TaskList> {
    const existing = await this.findTaskListById(id);
    if (!existing) throw new AppError(404, 'Task list not found');

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.name !== undefined) { updates.push(`name = $${p++}`); values.push(input.name.trim()); }
    if (input.color !== undefined) { updates.push(`color = $${p++}`); values.push(toDbValue(input.color)); }
    if (input.icon !== undefined) { updates.push(`icon = $${p++}`); values.push(toDbValue(input.icon)); }
    if (input.is_shared !== undefined) { updates.push(`is_shared = $${p++}`); values.push(input.is_shared); }

    if (!updates.length) return existing;

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE task_lists SET ${updates.join(', ')} WHERE id = $${p} AND is_active = true`,
      values
    );

    const updated = await this.findTaskListById(id);
    if (!updated) throw new AppError(500, 'Failed to update task list');
    return updated;
  }

  // ── Delete Task List ─────────────────────────────────────────────────────

  static async deleteTaskList(id: string): Promise<void> {
    const existing = await this.findTaskListById(id);
    if (!existing) throw new AppError(404, 'Task list not found');

    // Check if there are tasks in this list
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM tasks WHERE list_id = $1 AND is_active = true`,
      [id]
    );
    if (parseInt(rows[0].count, 10) > 0) {
      throw new AppError(409, 'Cannot delete list with active tasks');
    }

    await pool.query(
      `UPDATE task_lists SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  // ── Get List Members ─────────────────────────────────────────────────────

  static async getListMembers(listId: string): Promise<{ id: string; full_name: string; email: string }[]> {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email
       FROM task_list_members tlm
       JOIN users u ON u.id = tlm.user_id
       WHERE tlm.list_id = $1 AND tlm.is_active = true AND u.is_active = true`,
      [listId]
    );
    return rows;
  }

  // ── Add Member to List ───────────────────────────────────────────────────

  static async addMemberToList(listId: string, userId: string): Promise<void> {
    const list = await this.findTaskListById(listId);
    if (!list) throw new AppError(404, 'Task list not found');

    await pool.query(
      `INSERT INTO task_list_members (list_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (list_id, user_id) DO NOTHING`,
      [listId, userId]
    );
  }

  // ── Remove Member from List ──────────────────────────────────────────────

  static async removeMemberFromList(listId: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE task_list_members SET is_active = false
       WHERE list_id = $1 AND user_id = $2`,
      [listId, userId]
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ATTACHMENT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Upload one or more files as attachments to a task.
   * Files are uploaded to Cloudinary and metadata stored in the database.
   */
  static async uploadAttachments(
    taskId: string,
    files: Express.Multer.File[],
    userId: string
  ): Promise<Attachment[]> {
    // Verify task exists
    const task = await this.findTaskById(taskId);
    if (!task) throw new AppError(404, 'Task not found');

    // Upload all files to Cloudinary under a folder named after the task
    const folder = `tasks/${taskId}`;
    const results = await uploadMultipleToCloudinary(files, folder);

    // Insert each upload result into the attachments table
    const attachments: Attachment[] = [];
    for (const result of results) {
      // Determine resource type for later deletion (stored in DB but not used here)
      // We store mimetype; deletion will figure out resource type from mimetype.
      const { rows } = await pool.query(
        `INSERT INTO attachments (task_id, public_id, url, filename, mimetype, size, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, task_id, public_id, url, filename, mimetype, size, uploaded_at`,
        [
          taskId,
          result.public_id,
          result.secure_url,
          result.original_filename || 'file',
          result.format || 'application/octet-stream',
          result.bytes,
          userId,
        ]
      );
      attachments.push(rows[0]);
    }
    return attachments;
  }

  /**
   * Delete an attachment from both Cloudinary and the database.
   * Performs a soft delete in the database after removing from Cloudinary.
   */
  static async deleteAttachment(attachmentId: string): Promise<void> {
    // Fetch attachment record
    const { rows } = await pool.query(
      `SELECT public_id, mimetype FROM attachments WHERE id = $1 AND is_active = true`,
      [attachmentId]
    );
    if (!rows.length) throw new AppError(404, 'Attachment not found');

    const { public_id, mimetype } = rows[0];

    // Determine Cloudinary resource type based on mimetype
    let resourceType: 'image' | 'video' | 'raw' = 'image';
    if (mimetype.startsWith('video')) {
      resourceType = 'video';
    } else if (mimetype === 'application/pdf') {
      // PDFs were uploaded as 'image' because we use resource_type: "image"
      // to serve them inline. Keep as 'image' for deletion.
      resourceType = 'image';
    } else if (mimetype.startsWith('image')) {
      resourceType = 'image';
    } else {
      // Everything else (documents, archives, etc.) was uploaded as 'raw'
      // unless overridden. For safety, use 'raw' fallback.
      resourceType = 'raw';
    }

    // Delete from Cloudinary
    await deleteFromCloudinary(public_id, resourceType);

    // Soft delete in database
    await pool.query(
      `UPDATE attachments SET is_active = false WHERE id = $1`,
      [attachmentId]
    );
  }

  /**
   * Retrieve all attachments for a given task.
   * Ordered by upload date ascending.
   */
  static async getTaskAttachments(taskId: string): Promise<Attachment[]> {
    const { rows } = await pool.query(
      `SELECT ${ATTACHMENT_SELECT}
       FROM attachments a
       WHERE a.task_id = $1 AND a.is_active = true
       ORDER BY a.uploaded_at ASC`,
      [taskId]
    );
    return rows;
  }

  /**
   * Get a single attachment by its ID (useful for access checks).
   */
  static async getAttachmentById(attachmentId: string): Promise<Attachment | null> {
    const { rows } = await pool.query(
      `SELECT ${ATTACHMENT_SELECT}
       FROM attachments a
       WHERE a.id = $1 AND a.is_active = true`,
      [attachmentId]
    );
    return rows[0] || null;
  }
}