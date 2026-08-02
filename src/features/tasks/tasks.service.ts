// src/features/tasks/tasks.service.ts
import { deleteFromCloudinary, uploadMultipleToCloudinary } from '../../config/cloudinary';
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
  Task,
  TaskList,
  TaskListMember,
  Subtask,
  Attachment,
  Tag,
  TaskComment,
  TaskReminder,
  TaskDependency,
  TaskRecurrence,
  TaskEvent,
  TaskNotification,
  TaskPaginationResponse,
  TaskSummary,
  TaskTimelineData,
  TaskAnalytics,
  TaskSearchResult,
  TaskSearchResponse,
  TaskImportResult,
  CreateTaskInput,
  UpdateTaskInput,
  BulkUpdateTasksInput,
  BulkTaskAction,
  CreateSubtaskInput,
  UpdateSubtaskInput,
  BulkUpdateSubtasksInput,
  CreateTaskListInput,
  UpdateTaskListInput,
  AddListMembersInput,
  UpdateListMemberInput,
  CreateReminderInput,
  UpdateReminderInput,
  CreateCommentInput,
  UpdateCommentInput,
  CreateTagInput,
  UpdateTagInput,
  CreateDependencyInput,
  UpdateRecurrenceInput,
  MoveTaskInput,
  CopyTaskInput,
  TaskFilters,
  TaskTimelineFilters,
  TaskAnalyticsFilters,
  TaskSearchRequest,
  TaskExportOptions,
  TaskImportOptions,
  TaskEventFilter,
  NotificationFilters,
  TaskEventType,
} from './tasks.types';

// ─── SELECT fragments ──────────────────────────────────────────────────────────

const TASK_SELECT = `
  t.id, t.title, t.description, t.list_id, l.name AS list_name,
  t.status, t.day, t.in_my_day, t.notes, t.priority,
  t.due_date, t.completed_at, t.start_date,
  t.created_by, cu.full_name AS created_by_name,
  t.assigned_to, au.full_name AS assigned_to_name, t.assigned_date,
  t.reminder_date, t.reminder_time,
  t.tags, t.is_active, t.parent_task_id, pt.title AS parent_task_title,
  t.estimated_hours, t.actual_hours,
  t.position, t.is_favorite, t.color,
  t.created_at, t.updated_at,
  (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.is_active = true) AS subtask_count,
  (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.completed = true AND s.is_active = true) AS completed_subtask_count,
  0 AS dependency_count
`;

const TASK_JOIN = `
  FROM tasks t
  LEFT JOIN task_lists l ON l.id = t.list_id
  LEFT JOIN users cu ON cu.id = t.created_by
  LEFT JOIN users au ON au.id = t.assigned_to
  LEFT JOIN tasks pt ON pt.id = t.parent_task_id
`;

const LIST_SELECT = `
  l.id, l.name, l.description, l.color, l.icon, l.is_shared, l.is_shared_with_public,
  l.created_by, cu.full_name AS created_by_name,
  l.is_active, l.is_archived, l.archived_at, l.position,
  l.created_at, l.updated_at,
  (SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id AND t.is_active = true) AS task_count,
  (SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id AND t.status = 'completed' AND t.is_active = true) AS completed_task_count,
  (SELECT COUNT(*) FROM task_list_members tlm WHERE tlm.list_id = l.id AND tlm.is_active = true) AS member_count
`;

const LIST_JOIN = `
  FROM task_lists l
  LEFT JOIN users cu ON cu.id = l.created_by
`;

const SUBTASK_SELECT = `
  s.id, s.task_id, s.title, s.description, s.completed, NULL AS completed_at,
  s.assigned_to, au.full_name AS assigned_to_name,
  s.due_date, s.priority, s.position,
  s.created_at, s.updated_at
`;

const SUBTASK_JOIN = `
  FROM subtasks s
  LEFT JOIN users au ON au.id = s.assigned_to
`;

const ATTACHMENT_SELECT = `
  a.id, a.task_id, a.uploaded_by AS user_id,
  a.file_public_id AS public_id, a.file_url AS url, a.thumbnail_url,
  a.file_name AS filename, a.mime_type AS mimetype, a.file_size AS size,
  'completed' AS upload_status, 100 AS upload_progress,
  NOT a.is_active AS is_deleted,
  a.uploaded_at, NULL AS deleted_at
`;

const ATTACHMENT_JOIN = `
  FROM attachments a
`;

const COMMENT_SELECT = `
  c.id, c.task_id, c.user_id, u.full_name AS user_name,
  c.content, c.mentions, c.attachments, c.parent_comment_id,
  c.is_edited, c.created_at, c.updated_at
`;

const COMMENT_JOIN = `
  FROM task_comments c
  LEFT JOIN users u ON u.id = c.user_id
`;

const REMINDER_SELECT = `
  r.id, r.task_id, r.user_id, u.full_name AS user_name,
  r.reminder_date, r.reminder_time, r.reminder_type,
  r.is_sent, r.sent_at, r.is_active, r.note,
  r.created_at, r.updated_at
`;

const REMINDER_JOIN = `
  FROM task_reminders r
  LEFT JOIN users u ON u.id = r.user_id
`;

const DEPENDENCY_SELECT = `
  d.id, d.depends_on AS parent_task_id, d.task_id AS dependent_task_id,
  d.dependency_type, d.created_at, d.updated_at
`;

const DEPENDENCY_JOIN = `
  FROM task_dependencies d
`;

const RECURRENCE_SELECT = `
  rec.id, rec.task_id, rec.pattern, rec.interval,
  rec.day_of_week, rec.day_of_month, rec.month_of_year,
  rec.end_type, rec.end_after_count, rec.end_date,
  rec.last_occurrence_date, rec.next_occurrence_date,
  rec.created_at, rec.updated_at
`;

const RECURRENCE_JOIN = `
  FROM task_recurrences rec
`;

const TAG_SELECT = `
  tag.id, tag.name, tag.color, tag.description,
  tag.created_by, tag.is_active, tag.created_at, tag.updated_at
`;

const TAG_JOIN = `
  FROM tags tag
`;

const EVENT_SELECT = `
  e.id, e.task_id, e.performed_by AS user_id, u.full_name AS user_name,
  e.event_type, e.event_data, e.performed_at AS created_at
`;

const EVENT_JOIN = `
  FROM task_events e
  LEFT JOIN users u ON u.id = e.performed_by
`;

const NOTIFICATION_SELECT = `
  n.id, n.user_id, n.task_id, n.event_type,
  n.message, n.is_read, n.link, n.metadata,
  n.created_at, n.read_at
`;

const NOTIFICATION_JOIN = `
  FROM task_notifications n
`;

const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'due_date', 'priority', 'title', 'position', 'completed_at', 'start_date']);

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

// ─── Helper: Build WHERE clause for filters ─────────────────────────────────

const buildFilterConditions = (filters: TaskFilters, userId?: string): { where: string; values: unknown[] } => {
  const conditions: string[] = ['t.is_active = true'];
  const values: unknown[] = [];
  let p = 1;

  if (userId) {
    conditions.push(`(t.created_by = $${p} OR t.assigned_to = $${p} OR t.list_id IS NULL)`);
    values.push(userId);
    p++;
  }

  if (filters.list_id !== undefined) { 
    if (filters.list_id === null) {
      conditions.push(`t.list_id IS NULL`);
    } else {
      conditions.push(`t.list_id = $${p}`); 
      values.push(filters.list_id); 
      p++;
    }
  }

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(`t.status = ANY($${p})`);
      values.push(filters.status);
      p++;
    } else {
      conditions.push(`t.status = $${p}`);
      values.push(filters.status);
      p++;
    }
  }

  if (filters.day) {
    if (Array.isArray(filters.day)) {
      conditions.push(`t.day = ANY($${p})`);
      values.push(filters.day);
      p++;
    } else {
      conditions.push(`t.day = $${p}`);
      values.push(filters.day);
      p++;
    }
  }

  if (filters.in_my_day !== undefined) { conditions.push(`t.in_my_day = $${p}`); values.push(filters.in_my_day); p++; }

  if (filters.assigned_to) {
    if (Array.isArray(filters.assigned_to)) {
      conditions.push(`t.assigned_to = ANY($${p})`);
      values.push(filters.assigned_to);
      p++;
    } else {
      conditions.push(`t.assigned_to = $${p}`);
      values.push(filters.assigned_to);
      p++;
    }
  }

  if (filters.created_by) { conditions.push(`t.created_by = $${p}`); values.push(filters.created_by); p++; }

  if (filters.tags) {
    const tagArray = parseTags(filters.tags);
    if (tagArray.length > 0) {
      conditions.push(`t.tags && $${p}`);
      values.push(tagArray);
      p++;
    }
  }

  if (filters.search) {
    conditions.push(`(t.title ILIKE $${p} OR t.description ILIKE $${p} OR t.notes ILIKE $${p})`);
    values.push(`%${filters.search}%`);
    p++;
  }

  if (filters.due_from) { conditions.push(`t.due_date >= $${p}`); values.push(filters.due_from); p++; }
  if (filters.due_to) { conditions.push(`t.due_date <= $${p}`); values.push(filters.due_to); p++; }

  if (filters.due_date_range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthEnd = new Date(today);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    switch (filters.due_date_range) {
      case 'overdue':
        conditions.push(`t.due_date < $${p} AND t.status != 'completed'`);
        values.push(today);
        p++;
        break;
      case 'today':
        conditions.push(`t.due_date >= $${p} AND t.due_date < $${p + 1}`);
        values.push(today, tomorrow);
        p += 2;
        break;
      case 'tomorrow':
        const dayAfter = new Date(tomorrow);
        dayAfter.setDate(dayAfter.getDate() + 1);
        conditions.push(`t.due_date >= $${p} AND t.due_date < $${p + 1}`);
        values.push(tomorrow, dayAfter);
        p += 2;
        break;
      case 'this_week':
        conditions.push(`t.due_date >= $${p} AND t.due_date < $${p + 1}`);
        values.push(today, weekEnd);
        p += 2;
        break;
      case 'next_week':
        const nextWeekStart = new Date(weekEnd);
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
        conditions.push(`t.due_date >= $${p} AND t.due_date < $${p + 1}`);
        values.push(nextWeekStart, nextWeekEnd);
        p += 2;
        break;
      case 'this_month':
        const monthEndDate = new Date(today);
        monthEndDate.setMonth(monthEndDate.getMonth() + 1);
        conditions.push(`t.due_date >= $${p} AND t.due_date < $${p + 1}`);
        values.push(today, monthEndDate);
        p += 2;
        break;
      case 'no_due_date':
        conditions.push(`t.due_date IS NULL`);
        break;
    }
  }

  if (filters.priority) {
    if (Array.isArray(filters.priority)) {
      conditions.push(`t.priority = ANY($${p})`);
      values.push(filters.priority);
      p++;
    } else {
      conditions.push(`t.priority = $${p}`);
      values.push(filters.priority);
      p++;
    }
  }

  if (filters.parent_task_id !== undefined) {
    if (filters.parent_task_id === null) {
      conditions.push(`t.parent_task_id IS NULL`);
    } else {
      conditions.push(`t.parent_task_id = $${p}`);
      values.push(filters.parent_task_id);
      p++;
    }
  }

  if (filters.has_subtasks !== undefined) {
    const subquery = `(SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.is_active = true)`;
    if (filters.has_subtasks) {
      conditions.push(`${subquery} > 0`);
    } else {
      conditions.push(`${subquery} = 0`);
    }
  }

  if (filters.has_attachments !== undefined) {
    const subquery = `(SELECT COUNT(*) FROM attachments a WHERE a.task_id = t.id AND a.is_active = true)`;
    if (filters.has_attachments) {
      conditions.push(`${subquery} > 0`);
    } else {
      conditions.push(`${subquery} = 0`);
    }
  }

  if (filters.has_comments !== undefined) {
    const subquery = `(SELECT COUNT(*) FROM task_comments c WHERE c.task_id = t.id AND c.is_active = true)`;
    if (filters.has_comments) {
      conditions.push(`${subquery} > 0`);
    } else {
      conditions.push(`${subquery} = 0`);
    }
  }

  if (filters.is_favorite !== undefined) { conditions.push(`t.is_favorite = $${p}`); values.push(filters.is_favorite); p++; }
  if (filters.is_recurring !== undefined) { 
    const subquery = `(SELECT COUNT(*) FROM task_recurrences rec WHERE rec.task_id = t.id AND rec.is_active = true)`;
    if (filters.is_recurring) {
      conditions.push(`${subquery} > 0`);
    } else {
      conditions.push(`${subquery} = 0`);
    }
  }

  if (filters.completed_from) { conditions.push(`t.completed_at >= $${p}`); values.push(filters.completed_from); p++; }
  if (filters.completed_to) { conditions.push(`t.completed_at <= $${p}`); values.push(filters.completed_to); p++; }
  if (filters.reminder_date_from) { 
    conditions.push(`t.reminder_date >= $${p}`); 
    values.push(filters.reminder_date_from); 
    p++; 
  }
  if (filters.reminder_date_to) { 
    conditions.push(`t.reminder_date <= $${p}`); 
    values.push(filters.reminder_date_to); 
    p++; 
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', values };
};

// ─── Service ───────────────────────────────────────────────────────────────────

export class TaskService {

  // ═══════════════════════════════════════════════════════════════════════════
  //  TASK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Create Task ────────────────────────────────────────────────────────────

  static async createTask(input: CreateTaskInput, userId: string): Promise<Task> {
    const tags = parseTags(input.tags);

    // Handle recurrence if provided
    let recurrenceId: string | null = null;
    if (input.recurrence) {
      const { rows } = await pool.query(
        `INSERT INTO task_recurrences 
         (pattern, interval, day_of_week, day_of_month, month_of_year, end_type, end_after_count, end_date, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         RETURNING id`,
        [
          input.recurrence.pattern,
          input.recurrence.interval || 1,
          input.recurrence.day_of_week || null,
          input.recurrence.day_of_month || null,
          input.recurrence.month_of_year || null,
          input.recurrence.end_type || 'never',
          input.recurrence.end_after_count || null,
          input.recurrence.end_date || null,
        ]
      );
      recurrenceId = rows[0].id;
    }

    const { rows } = await pool.query(
      `INSERT INTO tasks
         (title, description, list_id, day, in_my_day, notes, priority, due_date, 
          assigned_to, created_by, tags, parent_task_id, estimated_hours, start_date, 
          color, position, is_favorite, recurrence_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING id`,
      [
        input.title.trim(),
        toDbValue(input.description),
        toDbValue(input.list_id),
        input.day || 'Today',
        input.in_my_day || false,
        toDbValue(input.notes),
        input.priority || 'medium',
        toDbValue(input.due_date),
        toDbValue(input.assigned_to),
        userId,
        tags.length > 0 ? tags : null,
        toDbValue(input.parent_task_id),
        toDbValue(input.estimated_hours),
        toDbValue(input.start_date),
        toDbValue(input.color),
        input.position || 0,
        input.is_favorite || false,
        recurrenceId,
      ]
    );

    const task = await this.findTaskById(rows[0].id);
    if (!task) throw new AppError(500, 'Failed to create task');

    // Log event
    await this.logEvent(task.id, userId, 'created', null, { title: task.title });

    return task;
  }

  // ── Find All Tasks ─────────────────────────────────────────────────────────

  static async findAllTasks(filters: TaskFilters, userId?: string): Promise<TaskPaginationResponse> {
    const {
      page = 1, limit = 20,
      sort_by = 'created_at', sort_order = 'DESC',
    } = filters;

    const sortCol = ALLOWED_SORT.has(sort_by) ? `t.${sort_by}` : 't.created_at';
    const sortDir = sort_order === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const { where, values } = buildFilterConditions(filters, userId);
    const p = values.length + 1;

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
    
    // Get subtasks for each task
    const tasks = await this.enrichTasks(dataResult.rows, filters);

    return {
      data: tasks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit),
    };
  }

  // ── Enrich Tasks with related data ──────────────────────────────────────

  private static async enrichTasks(tasks: any[], filters?: TaskFilters): Promise<Task[]> {
    if (!tasks.length) return [];

    const taskIds = tasks.map(t => t.id);

    // Get subtasks for all tasks
    const subtaskMap = new Map<string, any[]>();
    if (filters?.include_subtasks !== false) {
      const { rows } = await pool.query(
        `SELECT ${SUBTASK_SELECT} ${SUBTASK_JOIN} WHERE s.task_id = ANY($1) AND s.is_active = true ORDER BY s.position ASC, s.created_at ASC`,
        [taskIds]
      );
      for (const row of rows) {
        if (!subtaskMap.has(row.task_id)) subtaskMap.set(row.task_id, []);
        subtaskMap.get(row.task_id)!.push(row);
      }
    }

    // Get attachments
    // Get attachments
    const attachmentMap = new Map<string, any[]>();
    if (filters?.include_attachments !== false) {
      const { rows } = await pool.query(
        `SELECT ${ATTACHMENT_SELECT} ${ATTACHMENT_JOIN} WHERE a.task_id = ANY($1) AND a.is_active = true ORDER BY a.uploaded_at ASC`,
        [taskIds]
      );
      for (const row of rows) {
        if (!attachmentMap.has(row.task_id)) attachmentMap.set(row.task_id, []);
        attachmentMap.get(row.task_id)!.push(row);
      }
    }

    // Get comments
    const commentMap = new Map<string, any[]>();
    if (filters?.include_comments !== false) {
      const { rows } = await pool.query(
        `SELECT ${COMMENT_SELECT} ${COMMENT_JOIN} WHERE c.task_id = ANY($1) AND c.is_active = true ORDER BY c.created_at ASC`,
        [taskIds]
      );
      for (const row of rows) {
        if (!commentMap.has(row.task_id)) commentMap.set(row.task_id, []);
        commentMap.get(row.task_id)!.push(row);
      }
    }

    // Get recurrence
    const recurrenceMap = new Map<string, any>();
    if (filters?.include_recurrence !== false) {
      const { rows } = await pool.query(
        `SELECT ${RECURRENCE_SELECT} ${RECURRENCE_JOIN} WHERE rec.task_id = ANY($1) AND rec.is_active = true`,
        [taskIds]
      );
      for (const row of rows) {
        recurrenceMap.set(row.task_id, row);
      }
    }

    // Get dependencies
    // Get dependencies
    const dependencyMap = new Map<string, any[]>();
    if (filters?.include_dependencies !== false) {
      const { rows } = await pool.query(
        `SELECT ${DEPENDENCY_SELECT} ${DEPENDENCY_JOIN} WHERE d.depends_on = ANY($1) AND d.is_active = true`,
        [taskIds]
      );
      for (const row of rows) {
        if (!dependencyMap.has(row.parent_task_id)) dependencyMap.set(row.parent_task_id, []);
        dependencyMap.get(row.parent_task_id)!.push(row);
      }
    }

    // Get reminders
    const reminderMap = new Map<string, any[]>();
    const { rows: reminderRows } = await pool.query(
      `SELECT ${REMINDER_SELECT} ${REMINDER_JOIN} WHERE r.task_id = ANY($1) AND r.is_active = true ORDER BY r.reminder_date ASC`,
      [taskIds]
    );
    for (const row of reminderRows) {
      if (!reminderMap.has(row.task_id)) reminderMap.set(row.task_id, []);
      reminderMap.get(row.task_id)!.push(row);
    }

    // Map everything together
    return tasks.map(task => ({
      ...task,
      subtasks: subtaskMap.get(task.id) || [],
      attachments: attachmentMap.get(task.id) || [],
      comments: commentMap.get(task.id) || [],
      reminders: reminderMap.get(task.id) || [],
      recurrence: recurrenceMap.get(task.id) || null,
      dependencies: dependencyMap.get(task.id) || [],
    }));
  }

  // ── Find Task by ID ────────────────────────────────────────────────────────

  static async findTaskById(id: string, includeAll: boolean = true): Promise<Task | null> {
    const { rows } = await pool.query(
      `SELECT ${TASK_SELECT} ${TASK_JOIN} WHERE t.id = $1 AND t.is_active = true`,
      [id]
    );
    if (!rows[0]) return null;

    const tasks = await this.enrichTasks(rows, {
      include_subtasks: includeAll,
      include_attachments: includeAll,
      include_comments: includeAll,
      include_recurrence: includeAll,
      include_dependencies: includeAll,
    });
    
    return tasks[0] || null;
  }

  // ── Update Task ────────────────────────────────────────────────────────────

  static async updateTask(id: string, input: UpdateTaskInput, userId?: string): Promise<Task> {
    const existing = await this.findTaskById(id, false);
    if (!existing) throw new AppError(404, 'Task not found');

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    const addUpdate = (field: string, value: unknown) => {
      updates.push(`${field} = $${p++}`);
      values.push(value);
    };

    // Track changes for logging
    const changes: Record<string, { old: any; new: any }> = {};

    if (input.title !== undefined && input.title !== existing.title) {
      addUpdate('title', input.title.trim());
      changes.title = { old: existing.title, new: input.title.trim() };
    }
    if (input.description !== undefined) { 
      addUpdate('description', toDbValue(input.description));
      changes.description = { old: existing.description, new: input.description };
    }
    if (input.list_id !== undefined && input.list_id !== existing.list_id) { 
      addUpdate('list_id', toDbValue(input.list_id));
      changes.list_id = { old: existing.list_id, new: input.list_id };
    }
    if (input.status !== undefined && input.status !== existing.status) { 
      addUpdate('status', input.status);
      if (input.status === 'completed') {
        updates.push(`completed_at = NOW()`);
      } else {
        updates.push(`completed_at = NULL`);
      }
      changes.status = { old: existing.status, new: input.status };
    }
    if (input.day !== undefined && input.day !== existing.day) { 
      addUpdate('day', input.day);
      changes.day = { old: existing.day, new: input.day };
    }
    if (input.in_my_day !== undefined && input.in_my_day !== existing.in_my_day) { 
      addUpdate('in_my_day', input.in_my_day);
      changes.in_my_day = { old: existing.in_my_day, new: input.in_my_day };
    }
    if (input.notes !== undefined) { 
      addUpdate('notes', toDbValue(input.notes));
      changes.notes = { old: existing.notes, new: input.notes };
    }
    if (input.priority !== undefined && input.priority !== existing.priority) { 
      addUpdate('priority', input.priority);
      changes.priority = { old: existing.priority, new: input.priority };
    }
    if (input.due_date !== undefined) { 
      addUpdate('due_date', toDbValue(input.due_date));
      changes.due_date = { old: existing.due_date, new: input.due_date };
    }
    if (input.assigned_to !== undefined && input.assigned_to !== existing.assigned_to) { 
      addUpdate('assigned_to', toDbValue(input.assigned_to));
      addUpdate('assigned_date', input.assigned_to ? new Date() : null);
      changes.assigned_to = { old: existing.assigned_to, new: input.assigned_to };
    }
    if (input.assigned_to_name !== undefined) { 
      addUpdate('assigned_to_name', toDbValue(input.assigned_to_name));
    }
    if (input.tags !== undefined) { 
      const tags = parseTags(input.tags);
      addUpdate('tags', tags.length > 0 ? tags : null);
      changes.tags = { old: existing.tags, new: tags };
    }
    if (input.reminder_date !== undefined) { 
      addUpdate('reminder_date', toDbValue(input.reminder_date));
      changes.reminder_date = { old: existing.reminder_date, new: input.reminder_date };
    }
    if (input.reminder_time !== undefined) { 
      addUpdate('reminder_time', toDbValue(input.reminder_time));
      changes.reminder_time = { old: existing.reminder_time, new: input.reminder_time };
    }
    if (input.parent_task_id !== undefined) { 
      addUpdate('parent_task_id', toDbValue(input.parent_task_id));
      changes.parent_task_id = { old: existing.parent_task_id, new: input.parent_task_id };
    }
    if (input.estimated_hours !== undefined) { 
      addUpdate('estimated_hours', toDbValue(input.estimated_hours));
      changes.estimated_hours = { old: existing.estimated_hours, new: input.estimated_hours };
    }
    if (input.actual_hours !== undefined) { 
      addUpdate('actual_hours', toDbValue(input.actual_hours));
      changes.actual_hours = { old: existing.actual_hours, new: input.actual_hours };
    }
    if (input.start_date !== undefined) { 
      addUpdate('start_date', toDbValue(input.start_date));
      changes.start_date = { old: existing.start_date, new: input.start_date };
    }
    if (input.color !== undefined) { 
      addUpdate('color', toDbValue(input.color));
      changes.color = { old: existing.color, new: input.color };
    }
    if (input.position !== undefined && input.position !== existing.position) { 
      addUpdate('position', input.position);
      changes.position = { old: existing.position, new: input.position };
    }
    if (input.is_favorite !== undefined && input.is_favorite !== existing.is_favorite) { 
      addUpdate('is_favorite', input.is_favorite);
      changes.is_favorite = { old: existing.is_favorite, new: input.is_favorite };
    }

    if (!updates.length) return existing;

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${p} AND is_active = true`,
      values
    );

    // Log changes
    if (userId && Object.keys(changes).length > 0) {
      for (const [field, change] of Object.entries(changes)) {
        await this.logEvent(id, userId, 'updated', change.old, change.new, { field });
      }
    }

    const updated = await this.findTaskById(id);
    if (!updated) throw new AppError(500, 'Failed to update task');
    return updated;
  }

  // ── Bulk Update Tasks ──────────────────────────────────────────────────────

  static async bulkUpdateTasks(input: BulkUpdateTasksInput, userId: string): Promise<Task[]> {
    const { task_ids, data } = input;

    // Verify all tasks exist
    const { rows } = await pool.query(
      `SELECT id FROM tasks WHERE id = ANY($1) AND is_active = true`,
      [task_ids]
    );
    if (rows.length !== task_ids.length) {
      throw new AppError(404, 'One or more tasks not found');
    }

    const results: Task[] = [];
    for (const taskId of task_ids) {
      const task = await this.updateTask(taskId, data, userId);
      results.push(task);
    }

    return results;
  }

  // ── Bulk Task Action ──────────────────────────────────────────────────────

  static async bulkAction(input: BulkTaskAction, userId: string): Promise<{ task_ids: string[]; updated: number }> {
    const { action, task_ids, value } = input;

    // Verify all tasks exist
    const { rows } = await pool.query(
      `SELECT id FROM tasks WHERE id = ANY($1) AND is_active = true`,
      [task_ids]
    );
    if (rows.length !== task_ids.length) {
      throw new AppError(404, 'One or more tasks not found');
    }

    let updatedCount = 0;
    let data: UpdateTaskInput = {};

    switch (action) {
      case 'complete':
        data = { status: 'completed' };
        break;
      case 'uncomplete':
        data = { status: 'pending' };
        break;
      case 'archive':
        data = { status: 'archived' };
        break;
      case 'unarchive':
        data = { status: 'pending' };
        break;
      case 'delete':
        for (const taskId of task_ids) {
          await this.deleteTask(taskId);
          updatedCount++;
        }
        return { task_ids, updated: updatedCount };
      case 'assign':
        data = { assigned_to: value || null };
        break;
      case 'change_list':
        data = { list_id: value || null };
        break;
      case 'change_priority':
        data = { priority: value };
        break;
      case 'add_tags':
        for (const taskId of task_ids) {
          const task = await this.findTaskById(taskId, false);
          if (task) {
            const currentTags = task.tags || [];
            const newTags = [...new Set([...currentTags, ...(value || [])])];
            await this.updateTask(taskId, { tags: newTags }, userId);
            updatedCount++;
          }
        }
        return { task_ids, updated: updatedCount };
      case 'remove_tags':
        for (const taskId of task_ids) {
          const task = await this.findTaskById(taskId, false);
          if (task) {
            const currentTags = task.tags || [];
            const removeTags = value || [];
            const newTags = currentTags.filter(t => !removeTags.includes(t));
            await this.updateTask(taskId, { tags: newTags }, userId);
            updatedCount++;
          }
        }
        return { task_ids, updated: updatedCount };
    }

    for (const taskId of task_ids) {
      await this.updateTask(taskId, data, userId);
      updatedCount++;
    }

    return { task_ids, updated: updatedCount };
  }

  // ── Toggle Task Status ────────────────────────────────────────────────────

  static async toggleTaskStatus(id: string, status: 'pending' | 'completed' | 'archived', userId?: string): Promise<Task> {
    return this.updateTask(id, { status }, userId);
  }

  // ── Delete Task ────────────────────────────────────────────────────────────

  static async deleteTask(id: string, userId?: string): Promise<void> {
    const existing = await this.findTaskById(id, false);
    if (!existing) throw new AppError(404, 'Task not found');

    // Log deletion
    if (userId) {
      await this.logEvent(id, userId, 'deleted', null, { title: existing.title });
    }

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

  // ── Move Task ──────────────────────────────────────────────────────────────

  static async moveTask(id: string, input: MoveTaskInput, userId?: string): Promise<Task> {
    const updateData: UpdateTaskInput = {};
    
    if (input.new_day !== undefined) updateData.day = input.new_day;
    if (input.new_list_id !== undefined) updateData.list_id = input.new_list_id;
    if (input.new_position !== undefined) updateData.position = input.new_position;
    if (input.new_parent_task_id !== undefined) updateData.parent_task_id = input.new_parent_task_id;

    return this.updateTask(id, updateData, userId);
  }

  // ── Copy Task ──────────────────────────────────────────────────────────────

  static async copyTask(id: string, input: CopyTaskInput, userId: string): Promise<Task> {
    const existing = await this.findTaskById(id);
    if (!existing) throw new AppError(404, 'Task not found');

    // Create new task from existing
    const createData: CreateTaskInput = {
      title: `${existing.title} (Copy)`,
      description: existing.description,
      list_id: input.new_list_id || existing.list_id || undefined,
      day: input.new_day || existing.day,
      in_my_day: existing.in_my_day,
      notes: existing.notes || undefined,
      priority: existing.priority,
      due_date: existing.due_date || undefined,
      assigned_to: existing.assigned_to || undefined,
      tags: existing.tags,
      parent_task_id: existing.parent_task_id,
      estimated_hours: existing.estimated_hours,
      start_date: existing.start_date,
      color: existing.color,
    };

    const newTask = await this.createTask(createData, userId);

    // Copy subtasks if requested
    if (input.include_subtasks !== false && existing.subtasks.length > 0) {
      for (const subtask of existing.subtasks) {
        await this.createSubtask(newTask.id, {
          title: subtask.title,
          description: subtask.description,
          priority: subtask.priority,
          due_date: subtask.due_date || undefined,
          assigned_to: subtask.assigned_to || undefined,
          position: subtask.position,
        });
      }
    }

    // Copy attachments if requested
    if (input.include_attachments !== false && existing.attachments && existing.attachments.length > 0) {
      // Note: This would require actual file copying which is complex.
      // For now, we just note that attachments need to be handled separately.
      // In a real implementation, you'd copy the files to a new location.
    }

    return this.findTaskById(newTask.id) as Promise<Task>;
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

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const { rows } = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE t.status = 'completed') AS completed,
         COUNT(*) FILTER (WHERE t.status = 'pending') AS pending,
         COUNT(*) FILTER (WHERE t.status = 'archived') AS archived,
         COUNT(*) FILTER (WHERE t.in_my_day = true) AS in_my_day,
         COUNT(*) FILTER (WHERE t.due_date < $${p} AND t.status != 'completed') AS overdue,
         COUNT(*) FILTER (WHERE t.due_date >= $${p} AND t.due_date < $${p + 1}) AS due_today,
         COUNT(*) FILTER (WHERE t.due_date >= $${p} AND t.due_date < $${p + 2}) AS due_this_week,
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
      [...values, today, new Date(today.getTime() + 86400000), weekEnd]
    );

    const row = rows[0] || {};

    // Get by list
    const listResults = await pool.query(
      `SELECT 
         l.id AS list_id, l.name AS list_name,
         COUNT(t.id) AS count,
         COUNT(*) FILTER (WHERE t.status = 'completed') AS completed
       FROM task_lists l
       LEFT JOIN tasks t ON t.list_id = l.id AND t.is_active = true
       WHERE l.is_active = true
       GROUP BY l.id, l.name
       ORDER BY l.name ASC`
    );

    // Get by assignee
    const assigneeResults = await pool.query(
      `SELECT 
         u.id AS user_id, u.full_name AS user_name,
         COUNT(t.id) AS count,
         COUNT(*) FILTER (WHERE t.status = 'completed') AS completed
       FROM users u
       LEFT JOIN tasks t ON t.assigned_to = u.id AND t.is_active = true
       WHERE u.is_active = true
       GROUP BY u.id, u.full_name
       ORDER BY u.full_name ASC`
    );

    // Get by tag
    const tagResults = await pool.query(
  `SELECT 
     tag.id AS tag_id, tag.name AS tag_name, tag.color,
     COUNT(t.id) AS count
   FROM tags tag
   LEFT JOIN tasks t ON t.is_active = true AND t.tags && ARRAY[tag.name]::text[]
   WHERE tag.is_active = true
   GROUP BY tag.id, tag.name, tag.color
   ORDER BY tag.name ASC`
);

    return {
      total: parseInt(row.total || '0', 10),
      completed: parseInt(row.completed || '0', 10),
      pending: parseInt(row.pending || '0', 10),
      archived: parseInt(row.archived || '0', 10),
      in_my_day: parseInt(row.in_my_day || '0', 10),
      overdue: parseInt(row.overdue || '0', 10),
      due_today: parseInt(row.due_today || '0', 10),
      due_this_week: parseInt(row.due_this_week || '0', 10),
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
      by_status: {
        pending: parseInt(row.pending || '0', 10),
        completed: parseInt(row.completed || '0', 10),
        archived: parseInt(row.archived || '0', 10),
      },
      by_list: listResults.rows.map(r => ({
        list_id: r.list_id,
        list_name: r.list_name || 'Uncategorized',
        count: parseInt(r.count || '0', 10),
        completed: parseInt(r.completed || '0', 10),
      })),
      by_assignee: assigneeResults.rows.map(r => ({
        user_id: r.user_id,
        user_name: r.user_name || 'Unassigned',
        count: parseInt(r.count || '0', 10),
        completed: parseInt(r.completed || '0', 10),
      })),
      by_tag: tagResults.rows.map(r => ({
        tag_id: r.tag_id,
        tag_name: r.tag_name,
        color: r.color,
        count: parseInt(r.count || '0', 10),
      })),
    };
  }

  // ── Get Task Timeline ──────────────────────────────────────────────────────

  static async getTaskTimeline(filters: TaskTimelineFilters, userId?: string): Promise<TaskTimelineData[]> {
    const { start_date, end_date, group_by = 'day', list_id, assigned_to, status, include_completed = true } = filters;

    const conditions: string[] = ['t.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (userId) {
      conditions.push(`(t.created_by = $${p} OR t.assigned_to = $${p})`);
      values.push(userId);
      p++;
    }

    if (list_id) { conditions.push(`t.list_id = $${p}`); values.push(list_id); p++; }
    if (assigned_to) { conditions.push(`t.assigned_to = $${p}`); values.push(assigned_to); p++; }
    if (status) {
      if (Array.isArray(status)) {
        conditions.push(`t.status = ANY($${p})`);
        values.push(status);
        p++;
      } else {
        conditions.push(`t.status = $${p}`);
        values.push(status);
        p++;
      }
    }
    if (!include_completed) { conditions.push(`t.status != 'completed'`); }

    conditions.push(`t.created_at >= $${p} AND t.created_at <= $${p + 1}`);
    values.push(start_date, end_date);
    p += 2;

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    let dateFormat: string;
    switch (group_by) {
      case 'day': dateFormat = 'YYYY-MM-DD'; break;
      case 'week': dateFormat = 'YYYY-MM-DD'; break;
      case 'month': dateFormat = 'YYYY-MM'; break;
      case 'quarter': dateFormat = 'YYYY-Q'; break;
      case 'year': dateFormat = 'YYYY'; break;
      default: dateFormat = 'YYYY-MM-DD';
    }

    const { rows } = await pool.query(
      `SELECT 
         TO_CHAR(DATE_TRUNC('${group_by}', t.created_at), '${dateFormat}') AS date,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE t.status = 'completed') AS completed,
         COUNT(*) FILTER (WHERE t.status = 'pending') AS pending,
         COUNT(*) FILTER (WHERE t.status = 'archived') AS archived,
         JSON_AGG(t.id) AS task_ids
       FROM tasks t
       ${where}
       GROUP BY DATE_TRUNC('${group_by}', t.created_at)
       ORDER BY DATE_TRUNC('${group_by}', t.created_at) ASC`,
      values
    );

    // Fetch task details for each date
    const result: TaskTimelineData[] = [];
    for (const row of rows) {
      const taskIds = row.task_ids || [];
      let tasks: Task[] = [];
      if (taskIds.length > 0) {
        // ✅ FIX: Destructure rows from the query result
        const { rows: taskRows } = await pool.query(
          `SELECT ${TASK_SELECT} ${TASK_JOIN} WHERE t.id = ANY($1) AND t.is_active = true`,
          [taskIds]
        );
        tasks = await this.enrichTasks(taskRows);
      }
      result.push({
        date: row.date,
        total: parseInt(row.total || '0', 10),
        completed: parseInt(row.completed || '0', 10),
        pending: parseInt(row.pending || '0', 10),
        archived: parseInt(row.archived || '0', 10),
        tasks,
      });
    }

    return result;
}

  // ── Get Task Analytics ─────────────────────────────────────────────────────

  static async getTaskAnalytics(filters: TaskAnalyticsFilters, userId?: string): Promise<TaskAnalytics> {
    const conditions: string[] = ['t.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (userId) {
      conditions.push(`(t.created_by = $${p} OR t.assigned_to = $${p})`);
      values.push(userId);
      p++;
    }

    if (filters.list_id) { conditions.push(`t.list_id = $${p}`); values.push(filters.list_id); p++; }
    if (filters.assigned_to) { conditions.push(`t.assigned_to = $${p}`); values.push(filters.assigned_to); p++; }
    if (filters.from_date) { conditions.push(`t.created_at >= $${p}`); values.push(filters.from_date); p++; }
    if (filters.to_date) { conditions.push(`t.created_at <= $${p}`); values.push(filters.to_date); p++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get completion metrics
    const { rows } = await pool.query(
      `SELECT
         AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) AS avg_completion_hours,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
         COUNT(*) AS total_tasks,
         COUNT(DISTINCT DATE(created_at)) AS days_active,
         EXTRACT(HOUR FROM AVG(completed_at - created_at)) AS peak_hour,
         EXTRACT(DOW FROM AVG(completed_at)) AS productive_day
       FROM tasks t
       ${where}
       AND completed_at IS NOT NULL`,
      values
    );

    const row = rows[0] || {};
    const totalTasks = await this.getTaskSummary(userId);

    // Completion rate by priority
    const priorityRates = await pool.query(
      `SELECT 
         priority,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed
       FROM tasks t
       ${where}
       GROUP BY priority`,
      values
    );

    // Sub tasks and attachments metrics
    const metrics = await pool.query(
      `SELECT
         AVG(s.subtask_count) AS avg_subtasks,
         COUNT(DISTINCT a.task_id)::FLOAT / NULLIF(COUNT(DISTINCT t.id), 0) * 100 AS tasks_with_attachments,
         COUNT(*) FILTER (WHERE t.due_date < NOW() AND t.status != 'completed')::FLOAT / NULLIF(COUNT(*), 0) * 100 AS overdue_percentage
       FROM tasks t
       LEFT JOIN LATERAL (SELECT COUNT(*) AS subtask_count FROM subtasks s WHERE s.task_id = t.id AND s.is_active = true) s ON true
       LEFT JOIN attachments a ON a.task_id = t.id AND a.is_active = true
       ${where}`,
      values
    );

    const metricRow = metrics.rows[0] || {};

    // Time estimates accuracy
    const estimateAccuracy = await pool.query(
      `SELECT
         AVG(actual_hours - estimated_hours) AS avg_diff,
         COUNT(*) FILTER (WHERE actual_hours <= estimated_hours) AS on_time,
         COUNT(*) FILTER (WHERE actual_hours > estimated_hours) AS over_estimated,
         COUNT(*) FILTER (WHERE actual_hours < estimated_hours) AS under_estimated
       FROM tasks t
       ${where}
       AND estimated_hours IS NOT NULL AND actual_hours IS NOT NULL`,
      values
    );

    const accRow = estimateAccuracy.rows[0] || {};

    return {
      average_completion_time: parseFloat(row.avg_completion_hours || '0'),
      tasks_completed_per_day: parseFloat(row.completed_count || '0') / Math.max(parseInt(row.days_active || '1'), 1),
      tasks_created_per_day: parseFloat(row.total_tasks || '0') / Math.max(parseInt(row.days_active || '1'), 1),
      peak_productivity_time: `${Math.floor(parseFloat(row.peak_hour || '0'))}:00`,
      most_productive_day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(row.productive_day || '0')] || 'Unknown',
      completion_rate_by_priority: priorityRates.rows.map(r => ({
        priority: r.priority,
        rate: parseFloat(r.completed || '0') / Math.max(parseFloat(r.total || '1'), 1) * 100,
      })),
      average_subtasks_per_task: parseFloat(metricRow.avg_subtasks || '0'),
      tasks_with_attachments_percentage: parseFloat(metricRow.tasks_with_attachments || '0'),
      overdue_tasks_percentage: parseFloat(metricRow.overdue_percentage || '0'),
      time_estimates_accuracy: {
        estimated_vs_actual_hours: parseFloat(accRow.avg_diff || '0'),
        tasks_under_estimated: parseInt(accRow.under_estimated || '0'),
        tasks_over_estimated: parseInt(accRow.over_estimated || '0'),
        tasks_on_time: parseInt(accRow.on_time || '0'),
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
       ORDER BY s.position ASC, s.created_at ASC`,
      [taskId]
    );
    return rows;
  }

  // ── Create Subtask ────────────────────────────────────────────────────────

  static async createSubtask(taskId: string, input: CreateSubtaskInput): Promise<Subtask> {
    const task = await this.findTaskById(taskId, false);
    if (!task) throw new AppError(404, 'Task not found');

    const { rows } = await pool.query(
      `INSERT INTO subtasks 
         (task_id, title, description, priority, due_date, assigned_to, position)
       VALUES ($1, $2, $3, $4, $5, $6, 
         COALESCE($7, (SELECT COALESCE(MAX(position), -1) + 1 FROM subtasks WHERE task_id = $1 AND is_active = true)))
       RETURNING id`,
      [
        taskId,
        input.title.trim(),
        toDbValue(input.description),
        input.priority || 'medium',
        toDbValue(input.due_date),
        toDbValue(input.assigned_to),
        input.position,
      ]
    );

    const { rows: subtaskRows } = await pool.query(
      `SELECT ${SUBTASK_SELECT} ${SUBTASK_JOIN} WHERE s.id = $1`,
      [rows[0].id]
    );

    // Log event
    await this.logEvent(taskId, task.created_by, 'subtask_added', null, { subtask: subtaskRows[0].title });

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
    if (input.description !== undefined) { updates.push(`description = $${p++}`); values.push(toDbValue(input.description)); }
    if (input.completed !== undefined) { 
      updates.push(`completed = $${p++}`); 
      values.push(input.completed);
      if (input.completed) {
        updates.push(`completed_at = NOW()`);
      } else {
        updates.push(`completed_at = NULL`);
      }
    }
    if (input.priority !== undefined) { updates.push(`priority = $${p++}`); values.push(input.priority); }
    if (input.due_date !== undefined) { updates.push(`due_date = $${p++}`); values.push(toDbValue(input.due_date)); }
    if (input.assigned_to !== undefined) { updates.push(`assigned_to = $${p++}`); values.push(toDbValue(input.assigned_to)); }
    if (input.position !== undefined) { updates.push(`position = $${p++}`); values.push(input.position); }

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

  // ── Bulk Update Subtasks ──────────────────────────────────────────────────

  static async bulkUpdateSubtasks(input: BulkUpdateSubtasksInput): Promise<Subtask[]> {
    const { subtask_ids, data } = input;

    const { rows } = await pool.query(
      `SELECT id, task_id FROM subtasks WHERE id = ANY($1) AND is_active = true`,
      [subtask_ids]
    );
    if (rows.length !== subtask_ids.length) {
      throw new AppError(404, 'One or more subtasks not found');
    }

    const results: Subtask[] = [];
    for (const row of rows) {
      const subtask = await this.updateSubtask(row.task_id, row.id, data);
      results.push(subtask);
    }

    return results;
  }

  // ── Delete Subtask ────────────────────────────────────────────────────────

  static async deleteSubtask(taskId: string, subtaskId: string): Promise<void> {
    const { rows } = await pool.query(
      `UPDATE subtasks SET is_active = false WHERE id = $1 AND task_id = $2 RETURNING id`,
      [subtaskId, taskId]
    );
    if (!rows.length) throw new AppError(404, 'Subtask not found');

    // Log event
    await this.logEvent(taskId, 'system', 'subtask_deleted', null, { subtask_id: subtaskId });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  TASK LIST OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Create Task List ─────────────────────────────────────────────────────

  static async createTaskList(input: CreateTaskListInput, userId: string): Promise<TaskList> {
    const { rows } = await pool.query(
      `INSERT INTO task_lists 
         (name, description, color, icon, is_shared, is_shared_with_public, position, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 
         COALESCE($7, (SELECT COALESCE(MAX(position), -1) + 1 FROM task_lists WHERE created_by = $8 AND is_active = true)),
         $8)
       RETURNING id`,
      [
        input.name.trim(),
        toDbValue(input.description),
        toDbValue(input.color),
        toDbValue(input.icon),
        input.is_shared || false,
        input.is_shared_with_public || false,
        input.position,
        userId,
      ]
    );

    // Add members if shared
    if (input.is_shared && input.member_ids && input.member_ids.length > 0) {
      for (const memberId of input.member_ids) {
        await pool.query(
          `INSERT INTO task_list_members (list_id, user_id, role) VALUES ($1, $2, 'viewer')`,
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
    const conditions: string[] = ['l.is_active = true', 'l.is_archived = false'];
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
       ORDER BY l.position ASC, l.name ASC`,
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
    if (!rows[0]) return null;

    // Get members
    const { rows: members } = await pool.query(
      `SELECT tlm.id, tlm.list_id, tlm.user_id, u.full_name AS user_name, u.email AS user_email,
              tlm.role, tlm.permissions, tlm.joined_at, tlm.last_accessed_at, tlm.is_active
       FROM task_list_members tlm
       JOIN users u ON u.id = tlm.user_id
       WHERE tlm.list_id = $1 AND tlm.is_active = true`,
      [id]
    );

    return {
      ...rows[0],
      members,
    };
  }

  // ── Update Task List ─────────────────────────────────────────────────────

  static async updateTaskList(id: string, input: UpdateTaskListInput): Promise<TaskList> {
    const existing = await this.findTaskListById(id);
    if (!existing) throw new AppError(404, 'Task list not found');

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.name !== undefined) { updates.push(`name = $${p++}`); values.push(input.name.trim()); }
    if (input.description !== undefined) { updates.push(`description = $${p++}`); values.push(toDbValue(input.description)); }
    if (input.color !== undefined) { updates.push(`color = $${p++}`); values.push(toDbValue(input.color)); }
    if (input.icon !== undefined) { updates.push(`icon = $${p++}`); values.push(toDbValue(input.icon)); }
    if (input.is_shared !== undefined) { updates.push(`is_shared = $${p++}`); values.push(input.is_shared); }
    if (input.is_shared_with_public !== undefined) { updates.push(`is_shared_with_public = $${p++}`); values.push(input.is_shared_with_public); }
    if (input.position !== undefined) { updates.push(`position = $${p++}`); values.push(input.position); }

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
      // Archive instead of delete
      await pool.query(
        `UPDATE task_lists SET is_archived = true, updated_at = NOW() WHERE id = $1`,
        [id]
      );
      return;
    }

    await pool.query(
      `UPDATE task_lists SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  // ── Get List Members ─────────────────────────────────────────────────────

  static async getListMembers(listId: string): Promise<TaskListMember[]> {
    const { rows } = await pool.query(
      `SELECT tlm.id, tlm.list_id, tlm.user_id, u.full_name AS user_name, u.email AS user_email,
              tlm.role, tlm.permissions, tlm.joined_at, tlm.last_accessed_at, tlm.is_active
       FROM task_list_members tlm
       JOIN users u ON u.id = tlm.user_id
       WHERE tlm.list_id = $1 AND tlm.is_active = true`,
      [listId]
    );
    return rows;
  }

  // ── Add Members to List ───────────────────────────────────────────────────

  static async addMembersToList(listId: string, input: AddListMembersInput): Promise<void> {
    const list = await this.findTaskListById(listId);
    if (!list) throw new AppError(404, 'Task list not found');

    const { user_ids, role = 'viewer' } = input;

    for (const userId of user_ids) {
      await pool.query(
        `INSERT INTO task_list_members (list_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (list_id, user_id) DO UPDATE SET 
           role = EXCLUDED.role,
           is_active = true,
           joined_at = NOW()`,
        [listId, userId, role]
      );
    }
  }

  // ── Update List Member ──────────────────────────────────────────────────

  static async updateListMember(listId: string, userId: string, input: UpdateListMemberInput): Promise<void> {
    const { rows } = await pool.query(
      `UPDATE task_list_members 
       SET role = $1, permissions = $2, updated_at = NOW()
       WHERE list_id = $3 AND user_id = $4 AND is_active = true
       RETURNING id`,
      [input.role, input.permissions || [], listId, userId]
    );
    if (!rows.length) throw new AppError(404, 'Member not found');
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

 static async uploadAttachments(
  taskId: string,
  files: Express.Multer.File[],
  userId: string
): Promise<Attachment[]> {
  const task = await this.findTaskById(taskId, false);
  if (!task) throw new AppError(404, 'Task not found');

  const folder = `tasks/${taskId}`;
  const results = await uploadMultipleToCloudinary(files, folder);

  const attachments: Attachment[] = [];
  for (const result of results) {
    const { rows } = await pool.query(
      `INSERT INTO attachments
         (task_id, uploaded_by, file_public_id, file_url, thumbnail_url, file_name, mime_type, file_size, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING id`,
      [
        taskId,
        userId,
        result.public_id,
        result.secure_url,
        result.thumbnail_url || null,
        result.original_filename || 'file',
        result.format || 'application/octet-stream',
        result.bytes,
      ]
    );

    const { rows: attachmentRows } = await pool.query(
      `SELECT ${ATTACHMENT_SELECT} ${ATTACHMENT_JOIN} WHERE a.id = $1`,
      [rows[0].id]
    );
    attachments.push(attachmentRows[0]);

    await this.logEvent(taskId, userId, 'attachment_added', null, { filename: attachmentRows[0].filename });
  }
  return attachments;
}

static async deleteAttachment(attachmentId: string, userId?: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT file_public_id, mime_type, task_id FROM attachments WHERE id = $1 AND is_active = true`,
    [attachmentId]
  );
  if (!rows.length) throw new AppError(404, 'Attachment not found');

  const { file_public_id, mime_type, task_id } = rows[0];

  let resourceType: 'image' | 'video' | 'raw' = 'image';
  if (mime_type?.startsWith('video')) resourceType = 'video';
  else if (mime_type?.startsWith('image')) resourceType = 'image';
  else resourceType = 'raw';

  if (file_public_id) {
    await deleteFromCloudinary(file_public_id, resourceType);
  }

  await pool.query(
    `UPDATE attachments SET is_active = false WHERE id = $1`,
    [attachmentId]
  );

  if (userId) {
    await this.logEvent(task_id, userId, 'attachment_deleted', null, { attachment_id: attachmentId });
  }
}

  static async getTaskAttachments(taskId: string): Promise<Attachment[]> {
    const { rows } = await pool.query(
      `SELECT ${ATTACHMENT_SELECT} ${ATTACHMENT_JOIN}
       WHERE a.task_id = $1 AND a.is_active = true
       ORDER BY a.uploaded_at ASC`,
      [taskId]
    );
    return rows;
  }

static async getAttachmentById(attachmentId: string): Promise<Attachment | null> {
  const { rows } = await pool.query(
    `SELECT ${ATTACHMENT_SELECT} ${ATTACHMENT_JOIN} WHERE a.id = $1 AND a.is_active = true`,
    [attachmentId]
  );
  return rows[0] || null;
}

  // ═══════════════════════════════════════════════════════════════════════════
  //  COMMENT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  static async createComment(taskId: string, input: CreateCommentInput, userId: string): Promise<TaskComment> {
    const task = await this.findTaskById(taskId, false);
    if (!task) throw new AppError(404, 'Task not found');

    const { rows } = await pool.query(
      `INSERT INTO task_comments 
         (task_id, user_id, content, mentions, attachments, parent_comment_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        taskId,
        userId,
        input.content.trim(),
        input.mentions || [],
        input.attachment_ids || [],
        toDbValue(input.parent_comment_id),
      ]
    );

    const { rows: commentRows } = await pool.query(
      `SELECT ${COMMENT_SELECT} ${COMMENT_JOIN} WHERE c.id = $1`,
      [rows[0].id]
    );

    // Log event
    await this.logEvent(taskId, userId, 'comment_added', null, { comment_id: rows[0].id });

    // Create notifications for mentions
    if (input.mentions && input.mentions.length > 0) {
      for (const mentionedUserId of input.mentions) {
        await this.createNotification(
          mentionedUserId,
          taskId,
          'comment_added',
          `${task.created_by_name} mentioned you in a comment on "${task.title}"`
        );
      }
    }

    return commentRows[0];
  }

  static async updateComment(commentId: string, input: UpdateCommentInput, userId: string): Promise<TaskComment> {
    const { rows: existing } = await pool.query(
      `SELECT id, task_id FROM task_comments WHERE id = $1 AND user_id = $2 AND is_active = true`,
      [commentId, userId]
    );
    if (!existing.length) throw new AppError(404, 'Comment not found or unauthorized');

    await pool.query(
      `UPDATE task_comments 
       SET content = $1, mentions = $2, is_edited = true, updated_at = NOW()
       WHERE id = $3 AND is_active = true`,
      [input.content.trim(), input.mentions || [], commentId]
    );

    const { rows: commentRows } = await pool.query(
      `SELECT ${COMMENT_SELECT} ${COMMENT_JOIN} WHERE c.id = $1`,
      [commentId]
    );

    await this.logEvent(existing[0].task_id, userId, 'comment_edited', null, { comment_id: commentId });

    return commentRows[0];
  }

  static async deleteComment(commentId: string, userId: string): Promise<void> {
    const { rows } = await pool.query(
      `SELECT id, task_id FROM task_comments WHERE id = $1 AND user_id = $2 AND is_active = true`,
      [commentId, userId]
    );
    if (!rows.length) throw new AppError(404, 'Comment not found or unauthorized');

    await pool.query(
      `UPDATE task_comments SET is_active = false WHERE id = $1`,
      [commentId]
    );

    await this.logEvent(rows[0].task_id, userId, 'comment_deleted', null, { comment_id: commentId });
  }

  static async getTaskComments(taskId: string): Promise<TaskComment[]> {
    const { rows } = await pool.query(
      `SELECT ${COMMENT_SELECT} ${COMMENT_JOIN}
       WHERE c.task_id = $1 AND c.is_active = true
       ORDER BY c.created_at ASC`,
      [taskId]
    );
    return rows;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  REMINDER OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  static async createReminder(input: CreateReminderInput, userId: string): Promise<TaskReminder> {
    const task = await this.findTaskById(input.task_id, false);
    if (!task) throw new AppError(404, 'Task not found');

    const targetUserId = input.user_id || task.assigned_to || task.created_by;

    const { rows } = await pool.query(
      `INSERT INTO task_reminders 
         (task_id, user_id, reminder_date, reminder_time, reminder_type, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.task_id,
        targetUserId,
        input.reminder_date,
        input.reminder_time,
        input.reminder_type || 'in_app',
        toDbValue(input.note),
      ]
    );

    const { rows: reminderRows } = await pool.query(
      `SELECT ${REMINDER_SELECT} ${REMINDER_JOIN} WHERE r.id = $1`,
      [rows[0].id]
    );

    await this.logEvent(input.task_id, userId, 'reminder_added', null, { reminder_id: rows[0].id });

    return reminderRows[0];
  }

  static async updateReminder(reminderId: string, input: UpdateReminderInput, userId: string): Promise<TaskReminder> {
    const { rows: existing } = await pool.query(
      `SELECT id, task_id FROM task_reminders WHERE id = $1 AND is_active = true`,
      [reminderId]
    );
    if (!existing.length) throw new AppError(404, 'Reminder not found');

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.reminder_date !== undefined) { updates.push(`reminder_date = $${p++}`); values.push(input.reminder_date); }
    if (input.reminder_time !== undefined) { updates.push(`reminder_time = $${p++}`); values.push(input.reminder_time); }
    if (input.reminder_type !== undefined) { updates.push(`reminder_type = $${p++}`); values.push(input.reminder_type); }
    if (input.note !== undefined) { updates.push(`note = $${p++}`); values.push(toDbValue(input.note)); }
    if (input.is_active !== undefined) { updates.push(`is_active = $${p++}`); values.push(input.is_active); }

    if (!updates.length) {
      const { rows: reminderRows } = await pool.query(
        `SELECT ${REMINDER_SELECT} ${REMINDER_JOIN} WHERE r.id = $1`,
        [reminderId]
      );
      return reminderRows[0];
    }

    updates.push(`updated_at = NOW()`);
    values.push(reminderId);

    await pool.query(
      `UPDATE task_reminders SET ${updates.join(', ')} WHERE id = $${p}`,
      values
    );

    const { rows: reminderRows } = await pool.query(
      `SELECT ${REMINDER_SELECT} ${REMINDER_JOIN} WHERE r.id = $1`,
      [reminderId]
    );

    return reminderRows[0];
  }

  static async deleteReminder(reminderId: string, userId: string): Promise<void> {
    const { rows } = await pool.query(
      `SELECT task_id FROM task_reminders WHERE id = $1 AND is_active = true`,
      [reminderId]
    );
    if (!rows.length) throw new AppError(404, 'Reminder not found');

    await pool.query(
      `UPDATE task_reminders SET is_active = false WHERE id = $1`,
      [reminderId]
    );

    await this.logEvent(rows[0].task_id, userId, 'reminder_deleted', null, { reminder_id: reminderId });
  }

  static async getTaskReminders(taskId: string): Promise<TaskReminder[]> {
    const { rows } = await pool.query(
      `SELECT ${REMINDER_SELECT} ${REMINDER_JOIN}
       WHERE r.task_id = $1 AND r.is_active = true
       ORDER BY r.reminder_date ASC, r.reminder_time ASC`,
      [taskId]
    );
    return rows;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  TAG OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  static async createTag(input: CreateTagInput, userId: string): Promise<Tag> {
    const { rows } = await pool.query(
      `INSERT INTO tags (name, color, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [input.name.trim(), input.color, toDbValue(input.description), userId]
    );

    const { rows: tagRows } = await pool.query(
      `SELECT ${TAG_SELECT} ${TAG_JOIN} WHERE tag.id = $1`,
      [rows[0].id]
    );

    return tagRows[0];
  }

  static async findAllTags(userId?: string): Promise<Tag[]> {
    const conditions: string[] = ['tag.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (userId) {
      conditions.push(`tag.created_by = $${p}`);
      values.push(userId);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT ${TAG_SELECT}, 
        (SELECT COUNT(*) FROM tasks t WHERE t.is_active = true AND t.tags && ARRAY[tag.name]) AS usage_count
       ${TAG_JOIN}
       ${where}
       ORDER BY tag.name ASC`,
      values
    );

    return rows;
  }

  static async findTagById(id: string): Promise<Tag | null> {
    const { rows } = await pool.query(
      `SELECT ${TAG_SELECT},
        (SELECT COUNT(*) FROM tasks t WHERE t.is_active = true AND t.tags && ARRAY[tag.name]) AS usage_count
       ${TAG_JOIN}
       WHERE tag.id = $1 AND tag.is_active = true`,
      [id]
    );
    return rows[0] || null;
  }

  static async updateTag(id: string, input: UpdateTagInput): Promise<Tag> {
    const existing = await this.findTagById(id);
    if (!existing) throw new AppError(404, 'Tag not found');

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.name !== undefined) { updates.push(`name = $${p++}`); values.push(input.name.trim()); }
    if (input.color !== undefined) { updates.push(`color = $${p++}`); values.push(input.color); }
    if (input.description !== undefined) { updates.push(`description = $${p++}`); values.push(toDbValue(input.description)); }
    if (input.is_active !== undefined) { updates.push(`is_active = $${p++}`); values.push(input.is_active); }

    if (!updates.length) return existing;

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE tags SET ${updates.join(', ')} WHERE id = $${p}`,
      values
    );

    const updated = await this.findTagById(id);
    if (!updated) throw new AppError(500, 'Failed to update tag');
    return updated;
  }

  static async deleteTag(id: string): Promise<void> {
    await pool.query(
      `UPDATE tags SET is_active = false WHERE id = $1`,
      [id]
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  DEPENDENCY OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  static async createDependency(input: CreateDependencyInput, userId: string): Promise<TaskDependency> {
  const { parent_task_id, dependent_task_id, dependency_type } = input;

  const parent = await this.findTaskById(parent_task_id, false);
  if (!parent) throw new AppError(404, 'Parent task not found');
  const dependent = await this.findTaskById(dependent_task_id, false);
  if (!dependent) throw new AppError(404, 'Dependent task not found');

  if (parent_task_id === dependent_task_id) {
    throw new AppError(400, 'Task cannot depend on itself');
  }

  const { rows } = await pool.query(
    `INSERT INTO task_dependencies 
       (task_id, depends_on, dependency_type)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [dependent_task_id, parent_task_id, dependency_type || 'blocks_completion']
  );

  const { rows: dependencyRows } = await pool.query(
    `SELECT ${DEPENDENCY_SELECT} ${DEPENDENCY_JOIN} WHERE d.id = $1`,
    [rows[0].id]
  );

  await this.logEvent(parent_task_id, userId, 'dependency_added', null, { dependent_task_id });
  await this.logEvent(dependent_task_id, userId, 'dependency_added', null, { parent_task_id });

  return dependencyRows[0];
}

// deleteDependency — now a proper soft delete:
static async deleteDependency(dependencyId: string, userId: string): Promise<void> {
  const { rows } = await pool.query(
    `UPDATE task_dependencies SET is_active = false, updated_at = NOW()
     WHERE id = $1 AND is_active = true
     RETURNING depends_on AS parent_task_id, task_id AS dependent_task_id`,
    [dependencyId]
  );
  if (!rows.length) throw new AppError(404, 'Dependency not found');

  await this.logEvent(rows[0].parent_task_id, userId, 'dependency_removed', null, { dependent_task_id: rows[0].dependent_task_id });
  await this.logEvent(rows[0].dependent_task_id, userId, 'dependency_removed', null, { parent_task_id: rows[0].parent_task_id });
}

static async getTaskDependencies(taskId: string): Promise<TaskDependency[]> {
  const { rows } = await pool.query(
    `SELECT ${DEPENDENCY_SELECT} ${DEPENDENCY_JOIN}
     WHERE d.depends_on = $1
     ORDER BY d.created_at ASC`,
    [taskId]
  );
  return rows;
}

  // ═══════════════════════════════════════════════════════════════════════════
  //  RECURRENCE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  static async updateRecurrence(taskId: string, input: UpdateRecurrenceInput, userId: string): Promise<TaskRecurrence> {
    const task = await this.findTaskById(taskId, false);
    if (!task) throw new AppError(404, 'Task not found');

    // Check if recurrence exists
    const { rows: existing } = await pool.query(
      `SELECT id FROM task_recurrences WHERE task_id = $1 AND is_active = true`,
      [taskId]
    );

    let recurrenceId: string;
    if (existing.length > 0) {
      // Update existing
      recurrenceId = existing[0].id;
      const updates: string[] = [];
      const values: unknown[] = [];
      let p = 1;

      if (input.pattern !== undefined) { updates.push(`pattern = $${p++}`); values.push(input.pattern); }
      if (input.interval !== undefined) { updates.push(`interval = $${p++}`); values.push(input.interval); }
      if (input.day_of_week !== undefined) { updates.push(`day_of_week = $${p++}`); values.push(input.day_of_week); }
      if (input.day_of_month !== undefined) { updates.push(`day_of_month = $${p++}`); values.push(input.day_of_month); }
      if (input.month_of_year !== undefined) { updates.push(`month_of_year = $${p++}`); values.push(input.month_of_year); }
      if (input.end_type !== undefined) { updates.push(`end_type = $${p++}`); values.push(input.end_type); }
      if (input.end_after_count !== undefined) { updates.push(`end_after_count = $${p++}`); values.push(toDbValue(input.end_after_count)); }
      if (input.end_date !== undefined) { updates.push(`end_date = $${p++}`); values.push(toDbValue(input.end_date)); }
      if (input.is_active !== undefined) { updates.push(`is_active = $${p++}`); values.push(input.is_active); }

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        values.push(recurrenceId);
        await pool.query(
          `UPDATE task_recurrences SET ${updates.join(', ')} WHERE id = $${p}`,
          values
        );
      }

      await this.logEvent(taskId, userId, 'recurrence_updated', null, { recurrence_id: recurrenceId });
    } else {
      // Create new recurrence
      if (!input.pattern) throw new AppError(400, 'Pattern is required to create recurrence');

      const { rows } = await pool.query(
        `INSERT INTO task_recurrences 
           (task_id, pattern, interval, day_of_week, day_of_month, month_of_year, 
            end_type, end_after_count, end_date, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
         RETURNING id`,
        [
          taskId,
          input.pattern,
          input.interval || 1,
          input.day_of_week || null,
          input.day_of_month || null,
          input.month_of_year || null,
          input.end_type || 'never',
          toDbValue(input.end_after_count),
          toDbValue(input.end_date),
        ]
      );
      recurrenceId = rows[0].id;

      // Update task with recurrence_id
      await pool.query(
        `UPDATE tasks SET recurrence_id = $1 WHERE id = $2`,
        [recurrenceId, taskId]
      );

      await this.logEvent(taskId, userId, 'recurrence_created', null, { recurrence_id: recurrenceId });
    }

    const { rows: recurrenceRows } = await pool.query(
      `SELECT ${RECURRENCE_SELECT} ${RECURRENCE_JOIN} WHERE rec.id = $1`,
      [recurrenceId]
    );

    return recurrenceRows[0];
  }

  static async deleteRecurrence(taskId: string, userId: string): Promise<void> {
    const { rows } = await pool.query(
      `UPDATE task_recurrences SET is_active = false WHERE task_id = $1 RETURNING id`,
      [taskId]
    );
    if (!rows.length) throw new AppError(404, 'Recurrence not found');

    await pool.query(
      `UPDATE tasks SET recurrence_id = NULL WHERE id = $1`,
      [taskId]
    );

    await this.logEvent(taskId, userId, 'recurrence_deleted', null, { recurrence_id: rows[0].id });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SEARCH OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  static async searchTasks(request: TaskSearchRequest, userId?: string): Promise<TaskSearchResponse> {
    const { query, filters = {}, highlight_matches = true, fuzzy_match = false, search_fields = ['title', 'description'] } = request;

    const conditions: string[] = ['t.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (userId) {
      conditions.push(`(t.created_by = $${p} OR t.assigned_to = $${p})`);
      values.push(userId);
      p++;
    }

    // Search query
    const searchConditions: string[] = [];
    if (search_fields.includes('title') || search_fields.length === 0) {
      searchConditions.push(fuzzy_match ? `t.title % $${p}` : `t.title ILIKE $${p}`);
    }
    if (search_fields.includes('description')) {
      searchConditions.push(fuzzy_match ? `t.description % $${p}` : `t.description ILIKE $${p}`);
    }
    if (search_fields.includes('notes')) {
      searchConditions.push(fuzzy_match ? `t.notes % $${p}` : `t.notes ILIKE $${p}`);
    }
    if (search_fields.includes('subtasks')) {
      searchConditions.push(`EXISTS (SELECT 1 FROM subtasks s WHERE s.task_id = t.id AND (${fuzzy_match ? 's.title %' : 's.title ILIKE'} $${p}))`);
    }
    if (search_fields.includes('comments')) {
      searchConditions.push(`EXISTS (SELECT 1 FROM task_comments c WHERE c.task_id = t.id AND (${fuzzy_match ? 'c.content %' : 'c.content ILIKE'} $${p}))`);
    }

    if (searchConditions.length > 0) {
      conditions.push(`(${searchConditions.join(' OR ')})`);
      values.push(fuzzy_match ? query : `%${query}%`);
      p++;
    }

    // Apply filters
    if (filters.list_id) { conditions.push(`t.list_id = $${p}`); values.push(filters.list_id); p++; }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(`t.status = ANY($${p})`);
        values.push(filters.status);
        p++;
      } else {
        conditions.push(`t.status = $${p}`);
        values.push(filters.status);
        p++;
      }
    }
    if (filters.day) {
      if (Array.isArray(filters.day)) {
        conditions.push(`t.day = ANY($${p})`);
        values.push(filters.day);
        p++;
      } else {
        conditions.push(`t.day = $${p}`);
        values.push(filters.day);
        p++;
      }
    }
    if (filters.priority) {
      if (Array.isArray(filters.priority)) {
        conditions.push(`t.priority = ANY($${p})`);
        values.push(filters.priority);
        p++;
      } else {
        conditions.push(`t.priority = $${p}`);
        values.push(filters.priority);
        p++;
      }
    }
    if (filters.assigned_to) {
      if (Array.isArray(filters.assigned_to)) {
        conditions.push(`t.assigned_to = ANY($${p})`);
        values.push(filters.assigned_to);
        p++;
      } else {
        conditions.push(`t.assigned_to = $${p}`);
        values.push(filters.assigned_to);
        p++;
      }
    }
    if (filters.due_date_range) {
      // Same logic as in findAllTasks
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Use ts_rank for relevance scoring
    const searchQuery = fuzzy_match ? query : `'${query}':*`;

    const { rows } = await pool.query(
      `SELECT ${TASK_SELECT},
        ts_rank(to_tsvector('english', COALESCE(t.title, '') || ' ' || COALESCE(t.description, '')), plainto_tsquery($${p})) AS score,
        ts_headline('english', COALESCE(t.title, ''), plainto_tsquery($${p})) AS title_highlight,
        ts_headline('english', COALESCE(t.description, ''), plainto_tsquery($${p})) AS description_highlight
       ${TASK_JOIN}
       ${where}
       ORDER BY score DESC,
                CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END ASC,
                t.due_date ASC NULLS LAST
       LIMIT 50`,
      [...values, query]
    );

    const results: TaskSearchResult[] = rows.map(row => {
      const matched_fields: string[] = [];
      const highlights: { field: string; text: string; positions: number[] }[] = [];

      if (row.title_highlight && row.title_highlight !== row.title) {
        matched_fields.push('title');
        if (highlight_matches) {
          highlights.push({ field: 'title', text: row.title_highlight, positions: [] });
        }
      }
      if (row.description_highlight && row.description_highlight !== row.description) {
        matched_fields.push('description');
        if (highlight_matches) {
          highlights.push({ field: 'description', text: row.description_highlight, positions: [] });
        }
      }

      return {
        task: row,
        score: parseFloat(row.score || '0'),
        matched_fields,
        highlights: highlights.length > 0 ? highlights : undefined,
      };
    });

    return {
      results,
      total: results.length,
      took_ms: 0,
      pagination: {
        page: 1,
        limit: 50,
        totalPages: 1,
      },
      suggested_queries: results.length === 0 ? [`Try "${query}" with different keywords`] : undefined,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  EXPORT / IMPORT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  static async exportTasks(options: TaskExportOptions, userId?: string): Promise<any> {
    const { format, filters = {}, include_fields, include_subtasks = true, include_comments = false, include_attachments = false, include_activity_log = false, date_range } = options;

    // Build filters with date range
    const taskFilters: TaskFilters = { ...filters };
    if (date_range) {
      taskFilters.due_from = date_range.from;
      taskFilters.due_to = date_range.to;
    }

    const result = await this.findAllTasks(taskFilters, userId);
    let tasks = result.data;

    // Include additional data
    if (include_subtasks) {
      for (const task of tasks) {
        task.subtasks = await this.getSubtasks(task.id);
      }
    }
    if (include_attachments) {
      for (const task of tasks) {
        task.attachments = await this.getTaskAttachments(task.id);
      }
    }
    if (include_comments) {
      for (const task of tasks) {
        task.comments = await this.getTaskComments(task.id);
      }
    }
    if (include_activity_log) {
      for (const task of tasks) {
        const events = await this.getTaskEvents({ task_id: task.id });
        // Attach events to task
        (task as any).events = events;
      }
    }

    // Filter fields if specified
    if (include_fields && include_fields.length > 0) {
      tasks = tasks.map(task => {
        const filtered: any = {};
        for (const field of include_fields) {
          filtered[field] = (task as any)[field];
        }
        return filtered;
      });
    }

    // Format output
    switch (format) {
      case 'json':
        return tasks;
      case 'csv':
        // Convert to CSV format
        const headers = include_fields || ['id', 'title', 'status', 'priority', 'due_date', 'created_at'];
        const csvRows = tasks.map(task => {
          return headers.map(header => {
            const value = (task as any)[header];
            if (value instanceof Date) return value.toISOString();
            if (Array.isArray(value)) return value.join(';');
            return value || '';
          });
        });
        return { headers, rows: csvRows };
      case 'pdf':
      case 'html':
        // For PDF and HTML, return structured data
        return {
          format,
          data: tasks,
          metadata: {
            exported_at: new Date().toISOString(),
            total: tasks.length,
            filters,
          },
        };
      default:
        return tasks;
    }
  }

  static async importTasks(options: TaskImportOptions, userId: string): Promise<TaskImportResult> {
    const { format, data, merge_strategy = 'merge', import_to_list_id, mapping = {}, dry_run = false } = options;

    let tasks: any[] = [];

    // Parse data based on format
    switch (format) {
      case 'json':
        tasks = Array.isArray(data) ? data : [data];
        break;
      case 'csv':
        // Parse CSV data
        const lines = data.split('\n');
        const headers = lines[0].split(',').map((h: string) => h.trim());
        tasks = lines.slice(1).map((line: string) => {
          const values = line.split(',').map((v: string) => v.trim());
          const task: any = {};
          headers.forEach((header: string, index: number) => {
            const mappedKey = mapping[header] || header;
            task[mappedKey] = values[index] || null;
          });
          return task;
        });
        break;
      case 'todoist':
      case 'trello':
      case 'asana':
        // Format-specific parsing
        tasks = this.parseThirdPartyTasks(format, data);
        break;
      default:
        throw new AppError(400, `Unsupported import format: ${format}`);
    }

    const results: TaskImportResult = {
      imported: 0,
      failed: 0,
      errors: [],
      summary: {
        tasks_created: 0,
        tasks_updated: 0,
        subtasks_created: 0,
        attachments_uploaded: 0,
      },
    };

    if (dry_run) {
      return {
        ...results,
        imported: tasks.length,
        summary: {
          tasks_created: tasks.length,
          tasks_updated: 0,
          subtasks_created: 0,
          attachments_uploaded: 0,
        },
      };
    }

    for (let i = 0; i < tasks.length; i++) {
      try {
        const taskData = tasks[i];
        
        // Check if task exists
        let existingTask: Task | null = null;
        if (taskData.id && merge_strategy !== 'replace') {
          existingTask = await this.findTaskById(taskData.id, false);
        }

        if (existingTask && merge_strategy === 'skip_existing') {
          continue;
        }

        const createInput: CreateTaskInput = {
          title: taskData.title || 'Imported Task',
          description: taskData.description,
          list_id: import_to_list_id || taskData.list_id,
          day: taskData.day || 'Today',
          in_my_day: taskData.in_my_day || false,
          notes: taskData.notes,
          priority: taskData.priority || 'medium',
          due_date: taskData.due_date,
          assigned_to: taskData.assigned_to,
          tags: taskData.tags ? (typeof taskData.tags === 'string' ? taskData.tags.split(',') : taskData.tags) : undefined,
        };

        if (existingTask && merge_strategy === 'merge') {
          // Update existing task
          await this.updateTask(existingTask.id, createInput, userId);
          results.summary.tasks_updated++;
        } else {
          // Create new task
          const newTask = await this.createTask(createInput, userId);
          results.summary.tasks_created++;

          // Import subtasks if present
          if (taskData.subtasks && Array.isArray(taskData.subtasks)) {
            for (const subtaskData of taskData.subtasks) {
              await this.createSubtask(newTask.id, {
                title: subtaskData.title || 'Imported Subtask',
                description: subtaskData.description,
                priority: subtaskData.priority,
                due_date: subtaskData.due_date,
                assigned_to: subtaskData.assigned_to,
              });
              results.summary.subtasks_created++;
            }
          }
        }

        results.imported++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  private static parseThirdPartyTasks(format: 'todoist' | 'trello' | 'asana', data: any): any[] {
    // Simplified parsing for third-party formats
    switch (format) {
      case 'todoist':
        return (data.items || []).map((item: any) => ({
          title: item.content,
          priority: item.priority > 3 ? 'high' : item.priority > 2 ? 'medium' : 'low',
          due_date: item.due_date_utc,
          tags: item.labels || [],
          description: item.description,
        }));
      case 'trello':
        return (data.cards || []).map((card: any) => ({
          title: card.name,
          description: card.desc,
          due_date: card.due,
          list_id: card.idList,
          tags: card.labels?.map((l: any) => l.name) || [],
        }));
      case 'asana':
        return (data.data || []).map((task: any) => ({
          title: task.name,
          description: task.notes,
          due_date: task.due_on,
          assigned_to: task.assignee?.gid,
          tags: task.tags?.map((t: any) => t.name) || [],
        }));
      default:
        return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  EVENT LOGGING
  // ═══════════════════════════════════════════════════════════════════════════

 static async logEvent(
  taskId: string,
  userId: string,
  eventType: TaskEventType,
  oldValue: any = null,
  newValue: any = null,
  metadata: Record<string, any> = {}
): Promise<void> {
  const eventData = { old_value: oldValue, new_value: newValue, ...metadata };
  await pool.query(
    `INSERT INTO task_events (task_id, performed_by, event_type, event_data, is_active)
     VALUES ($1, $2, $3, $4, true)`,
    [taskId, userId, eventType, JSON.stringify(eventData)]
  );
}

 static async getTaskEvents(filters: TaskEventFilter): Promise<TaskEvent[]> {
  const conditions: string[] = ['e.is_active = true'];
  const values: unknown[] = [];
  let p = 1;

  if (filters.task_id) { conditions.push(`e.task_id = $${p}`); values.push(filters.task_id); p++; }
  if (filters.user_id) { conditions.push(`e.performed_by = $${p}`); values.push(filters.user_id); p++; }
  if (filters.event_type) {
    if (Array.isArray(filters.event_type)) {
      conditions.push(`e.event_type = ANY($${p})`);
      values.push(filters.event_type);
      p++;
    } else {
      conditions.push(`e.event_type = $${p}`);
      values.push(filters.event_type);
      p++;
    }
  }
  if (filters.from_date) { conditions.push(`e.performed_at >= $${p}`); values.push(filters.from_date); p++; }
  if (filters.to_date) { conditions.push(`e.performed_at <= $${p}`); values.push(filters.to_date); p++; }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const { rows } = await pool.query(
    `SELECT ${EVENT_SELECT} ${EVENT_JOIN}
     ${where}
     ORDER BY e.performed_at DESC
     LIMIT $${p} OFFSET $${p + 1}`,
    [...values, limit, offset]
  );

  return rows;
}

  // ═══════════════════════════════════════════════════════════════════════════
  //  NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  static async createNotification(
    userId: string,
    taskId: string,
    eventType: TaskEventType,
    message: string,
    link?: string,
    metadata?: Record<string, any>
  ): Promise<TaskNotification> {
    const { rows } = await pool.query(
      `INSERT INTO task_notifications (user_id, task_id, event_type, message, link, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [userId, taskId, eventType, message, link, metadata]
    );

    const { rows: notificationRows } = await pool.query(
      `SELECT ${NOTIFICATION_SELECT} ${NOTIFICATION_JOIN} WHERE n.id = $1`,
      [rows[0].id]
    );

    return notificationRows[0];
  }

  static async getNotifications(userId: string, filters?: NotificationFilters): Promise<TaskNotification[]> {
    const conditions: string[] = ['n.user_id = $1', 'n.is_active = true'];
    const values: unknown[] = [userId];
    let p = 2;

    if (filters?.is_read !== undefined) { conditions.push(`n.is_read = $${p}`); values.push(filters.is_read); p++; }
    if (filters?.event_type) {
      if (Array.isArray(filters.event_type)) {
        conditions.push(`n.event_type = ANY($${p})`);
        values.push(filters.event_type);
        p++;
      } else {
        conditions.push(`n.event_type = $${p}`);
        values.push(filters.event_type);
        p++;
      }
    }
    if (filters?.from_date) { conditions.push(`n.created_at >= $${p}`); values.push(filters.from_date); p++; }
    if (filters?.to_date) { conditions.push(`n.created_at <= $${p}`); values.push(filters.to_date); p++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const { rows } = await pool.query(
      `SELECT ${NOTIFICATION_SELECT} ${NOTIFICATION_JOIN}
       ${where}
       ORDER BY n.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...values, limit, offset]
    );

    return rows;
  }

  static async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    const { rows } = await pool.query(
      `UPDATE task_notifications 
       SET is_read = true, read_at = NOW() 
       WHERE id = $1 AND user_id = $2 AND is_active = true
       RETURNING id`,
      [notificationId, userId]
    );
    if (!rows.length) throw new AppError(404, 'Notification not found');
  }

  static async markAllNotificationsRead(userId: string, eventType?: TaskEventType | TaskEventType[]): Promise<void> {
    const conditions: string[] = ['user_id = $1', 'is_active = true', 'is_read = false'];
    const values: unknown[] = [userId];
    let p = 2;

    if (eventType) {
      if (Array.isArray(eventType)) {
        conditions.push(`event_type = ANY($${p})`);
        values.push(eventType);
        p++;
      } else {
        conditions.push(`event_type = $${p}`);
        values.push(eventType);
        p++;
      }
    }

    const where = conditions.join(' AND ');
    await pool.query(
      `UPDATE task_notifications 
       SET is_read = true, read_at = NOW() 
       WHERE ${where}`,
      values
    );
  }

  static async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE task_notifications SET is_active = false 
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  RECURRENCE TASK GENERATION (Background Job)
  // ═══════════════════════════════════════════════════════════════════════════

  static async generateRecurringTasks(): Promise<void> {
    const now = new Date();
    
    const { rows } = await pool.query(
      `SELECT rec.*, t.title, t.description, t.list_id, t.in_my_day, t.priority, t.assigned_to, t.created_by, t.tags
       FROM task_recurrences rec
       JOIN tasks t ON t.id = rec.task_id
       WHERE rec.is_active = true 
         AND rec.next_occurrence_date IS NOT NULL
         AND rec.next_occurrence_date <= NOW()
         AND (rec.end_type = 'never' 
              OR (rec.end_type = 'after' AND rec.end_after_count > (
                SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id AND is_active = true
              ))
              OR (rec.end_type = 'on_date' AND rec.end_date >= NOW()))`,
    );

    for (const recurrence of rows) {
      // Calculate next occurrence date
      const nextDate = new Date(recurrence.next_occurrence_date);
      const taskData: CreateTaskInput = {
        title: recurrence.title,
        description: recurrence.description,
        list_id: recurrence.list_id,
        in_my_day: recurrence.in_my_day,
        priority: recurrence.priority,
        due_date: this.calculateDueDate(recurrence, nextDate),
        assigned_to: recurrence.assigned_to,
        tags: recurrence.tags || [],
        parent_task_id: recurrence.task_id,
      };

      const task = await this.createTask(taskData, recurrence.created_by);

      // Update next occurrence
      const nextOccurrence = this.calculateNextOccurrence(recurrence, nextDate);
      await pool.query(
        `UPDATE task_recurrences 
         SET last_occurrence_date = $1, next_occurrence_date = $2, updated_at = NOW()
         WHERE id = $3`,
        [nextDate, nextOccurrence, recurrence.id]
      );
    }
  }

  private static calculateNextOccurrence(recurrence: any, fromDate: Date): Date {
    const next = new Date(fromDate);
    const { pattern, interval } = recurrence;

    switch (pattern) {
      case 'daily':
        next.setDate(next.getDate() + interval);
        break;
      case 'weekly': {
        const daysToAdd = interval * 7;
        next.setDate(next.getDate() + daysToAdd);
        break;
      }
      case 'biweekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + interval);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3 * interval);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + interval);
        break;
      default:
        // Custom or none
        next.setDate(next.getDate() + 1);
    }

    return next;
  }

  private static calculateDueDate(recurrence: any, occurrenceDate: Date): Date {
    // Use the occurrence date as due date by default
    return occurrenceDate;
  }
}