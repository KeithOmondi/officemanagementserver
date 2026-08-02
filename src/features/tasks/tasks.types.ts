// src/features/tasks/tasks.types.ts

export type TaskDay = 'Today' | 'Tomorrow' | 'Upcoming' | 'Someday';
export type TaskStatus = 'pending' | 'completed' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskRecurrencePattern = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type TaskRecurrenceEndType = 'never' | 'after' | 'on_date';

/**
 * Represents a recurrence rule for repeating tasks
 */
export interface TaskRecurrence {
  id: string;
  task_id: string;
  pattern: TaskRecurrencePattern;
  interval: number; // 1 = every day/week/month, 2 = every other, etc.
  day_of_week?: number[]; // 0-6 for weekly recurrence
  day_of_month?: number; // 1-31 for monthly recurrence
  month_of_year?: number; // 1-12 for yearly recurrence
  end_type: TaskRecurrenceEndType;
  end_after_count?: number; // Number of occurrences
  end_date?: Date; // Specific end date
  last_occurrence_date?: Date;
  next_occurrence_date?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Represents a notification/reminder associated with a task
 */
export interface TaskReminder {
  id: string;
  task_id: string;
  user_id: string;
  reminder_date: Date;
  reminder_time: string; // HH:MM format
  reminder_type: 'email' | 'push' | 'sms' | 'in_app';
  is_sent: boolean;
  sent_at?: Date;
  is_active: boolean;
  note?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Represents a comment on a task
 */
export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  content: string;
  mentions?: string[]; // User IDs mentioned in the comment
  attachments?: string[]; // Attachment IDs
  parent_comment_id?: string; // For nested replies
  is_edited: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Represents a file attached to a task.
 * All fields are derived from Cloudinary upload responses.
 */
export interface Attachment {
  id: string;
  task_id: string;               // The task this attachment belongs to
  user_id: string;               // Who uploaded it
  public_id: string;             // Cloudinary public ID (for deletion)
  url: string;                   // Accessible URL
  thumbnail_url?: string;        // Thumbnail for images
  filename: string;              // Original file name
  mimetype: string;              // MIME type
  size: number;                  // File size in bytes
  upload_status: 'pending' | 'uploading' | 'completed' | 'failed';
  upload_progress?: number;      // 0-100 for upload progress
  is_deleted: boolean;
  uploaded_at: Date;
  deleted_at?: Date;
}

export interface Subtask {
  id: string;
  task_id: string;               // Parent task ID
  title: string;
  description?: string;          // Description for complex subtasks
  completed: boolean;
  completed_at?: Date;
  assigned_to?: string;          // Can assign subtask to different person
  assigned_to_name?: string;
  due_date?: Date;               // Subtask can have its own due date
  priority: TaskPriority;        // Subtask can have its own priority
  position: number;              // For ordering subtasks
  created_at: Date;
  updated_at: Date;
}

/**
 * Represents a link between tasks (parent-child relationship)
 */
export interface TaskDependency {
  id: string;
  parent_task_id: string;        // The task that depends on another
  dependent_task_id: string;     // The task that must be completed first
  dependency_type: 'blocks' | 'blocks_completion' | 'relates_to';
  created_at: Date;
  updated_at: Date;
}

export interface Task {
  id: string;
  title: string;
  description?: string;          // Rich text description (formerly notes)
  list_id: string | null;
  list_name: string | null;
  status: TaskStatus;
  day: TaskDay;
  in_my_day: boolean;
  notes: string | null;          // Keep for backward compatibility
  subtasks: Subtask[];
  attachments?: Attachment[];    // Documents, images, etc. attached to the task
  comments?: TaskComment[];      // Comments/activity
  reminder_date: string | null;
  reminder_time: string | null;
  reminders?: TaskReminder[];    // All reminders for this task
  tags: string[];
  priority: TaskPriority;
  due_date: Date | null;
  completed_at: Date | null;
  created_by: string;
  created_by_name: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  assigned_date?: Date;           // When the task was assigned
  is_active: boolean;
  parent_task_id?: string;        // For subtask relationships
  parent_task_title?: string;
  child_tasks?: Task[];           // Child tasks (subtasks that are also tasks)
  recurrence?: TaskRecurrence;    // Recurrence rule if this is a recurring task
  dependency_count?: number;      // Number of tasks that depend on this task
  dependencies?: TaskDependency[]; // Tasks that depend on this task
  estimated_hours?: number;       // Estimated time to complete
  actual_hours?: number;          // Actual time spent
  start_date?: Date;              // When work on this task begins
  position: number;               // For ordering in lists
  is_favorite: boolean;           // Starred/favorited tasks
  color?: string;                 // Custom color override
  subtask_count?: number;
  completed_subtask_count?: number;
  created_at: Date;
  updated_at: Date;
}

export interface TaskList {
  id: string;
  name: string;
  description?: string;          // Description of the list/purpose
  color: string | null;
  icon: string | null;
  is_shared: boolean;
  is_shared_with_public?: boolean; // If true, anyone with link can view
  shared_with?: string[];        // User IDs who have access
  created_by: string;
  created_by_name: string;
  member_count: number;
  members?: TaskListMember[];    // Detailed member info
  is_active: boolean;
  is_archived: boolean;           // Archive instead of delete
  archived_at?: Date;
  position: number;               // Ordering for display
  task_count?: number;
  completed_task_count?: number;
  created_at: Date;
  updated_at: Date;
}

export interface TaskListMember {
  id: string;
  list_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: 'admin' | 'editor' | 'viewer';
  permissions: string[];          // Granular permissions
  joined_at: Date;
  last_accessed_at?: Date;
  is_active: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
  created_by: string;
  is_active: boolean;
  usage_count?: number;           // How many tasks use this tag
  created_at: Date;
  updated_at: Date;
}

export interface TaskTag {
  task_id: string;
  tag_id: string;
  created_at: Date;
}

export interface SearchHistory {
  id: string;
  user_id: string;
  query: string;
  filters?: TaskFilters;
  search_count: number;
  last_searched_at: Date;
}

// ─── Activity/Event Logging ────────────────────────────────────────────

export type TaskEventType = 
  | 'created'
  | 'updated'
  | 'deleted'
  | 'completed'
  | 'uncompleted'
  | 'archived'
  | 'unarchived'
  | 'assigned'
  | 'unassigned'
  | 'due_date_changed'
  | 'priority_changed'
  | 'status_changed'
  | 'list_changed'
  | 'subtask_added'
  | 'subtask_completed'
  | 'subtask_deleted'
  | 'comment_added'
  | 'comment_edited'
  | 'comment_deleted'
  | 'attachment_added'
  | 'attachment_deleted'
  | 'tag_added'
  | 'tag_removed'
  | 'reminder_added'
  | 'reminder_sent'
  | 'reminder_deleted'      // ✅ ADDED
  | 'dependency_added'
  | 'dependency_removed'
  | 'recurrence_created'
  | 'recurrence_updated'
  | 'recurrence_deleted';   // ✅ ADDED

export interface TaskEvent {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  event_type: TaskEventType;
  field_name?: string;           // Which field changed
  old_value?: any;               // Previous value
  new_value?: any;               // New value
  metadata?: Record<string, any>; // Additional context
  created_at: Date;
}

export interface TaskEventFilter {
  task_id?: string;
  user_id?: string;
  event_type?: TaskEventType | TaskEventType[];
  from_date?: Date;
  to_date?: Date;
  limit?: number;
  offset?: number;
}

// ─── Input Types ──────────────────────────────────────────────────────────────

/**
 * Create Task Input
 * All optional fields accept null from validation but are converted to undefined
 * for the service layer.
 */
export interface CreateTaskInput {
  title: string;
  description?: string;          // Rich text description
  list_id?: string;
  day?: TaskDay;
  in_my_day?: boolean;
  notes?: string;
  priority?: TaskPriority;
  due_date?: Date | string;
  assigned_to?: string;
  assigned_to_name?: string;
  tags?: string[];
  parent_task_id?: string;       // For subtask relationship
  estimated_hours?: number;
  start_date?: Date | string;
  color?: string;
  position?: number;
  is_favorite?: boolean;
  recurrence?: Omit<TaskRecurrence, 'id' | 'task_id' | 'created_at' | 'updated_at' | 'last_occurrence_date' | 'next_occurrence_date'>;
}

/**
 * Update Task Input
 * All fields are optional and accept null to allow clearing values.
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  list_id?: string | null;
  status?: TaskStatus;
  day?: TaskDay;
  in_my_day?: boolean;
  notes?: string | null;
  priority?: TaskPriority;
  due_date?: Date | string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  tags?: string[];
  reminder_date?: string | null;
  reminder_time?: string | null;
  parent_task_id?: string | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  start_date?: Date | string | null;
  color?: string | null;
  position?: number;
  is_favorite?: boolean;
}

/**
 * Bulk Update Tasks Input
 */
export interface BulkUpdateTasksInput {
  task_ids: string[];
  data: UpdateTaskInput;
}

export interface BulkTaskAction {
  action: 'complete' | 'uncomplete' | 'archive' | 'unarchive' | 'delete' | 'assign' | 'change_list' | 'change_priority' | 'add_tags' | 'remove_tags';
  task_ids: string[];
  value?: any; // Action-specific data
}

/**
 * Create Subtask Input
 */
export interface CreateSubtaskInput {
  task_id?: string;              // Made optional since it's passed separately
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: Date | string;
  assigned_to?: string;
  assigned_to_name?: string;
  position?: number;
}

/**
 * Update Subtask Input
 */
export interface UpdateSubtaskInput {
  title?: string;
  description?: string | null;
  completed?: boolean;
  priority?: TaskPriority;
  due_date?: Date | string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  position?: number;
}

/**
 * Bulk Update Subtasks Input
 */
export interface BulkUpdateSubtasksInput {
  subtask_ids: string[];
  data: UpdateSubtaskInput;
}

/**
 * Create Task List Input
 */
export interface CreateTaskListInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  is_shared?: boolean;
  is_shared_with_public?: boolean;
  member_ids?: string[];
  position?: number;
}

/**
 * Update Task List Input
 */
export interface UpdateTaskListInput {
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  is_shared?: boolean;
  is_shared_with_public?: boolean;
  position?: number;
}

/**
 * Add Members to Task List Input
 */
export interface AddListMembersInput {
  user_ids: string[];
  role?: 'admin' | 'editor' | 'viewer';
}

/**
 * Update List Member Input
 */
export interface UpdateListMemberInput {
  role: 'admin' | 'editor' | 'viewer';
  permissions?: string[];
}

/**
 * Create Reminder Input
 */
export interface CreateReminderInput {
  task_id: string;
  reminder_date: Date | string;
  reminder_time: string; // HH:MM format
  reminder_type: 'email' | 'push' | 'sms' | 'in_app';
  note?: string;
  user_id?: string; // If not provided, uses the task's assigned user
}

/**
 * Update Reminder Input
 */
export interface UpdateReminderInput {
  reminder_date?: Date | string;
  reminder_time?: string;
  reminder_type?: 'email' | 'push' | 'sms' | 'in_app';
  note?: string | null;
  is_active?: boolean;
}

/**
 * Create Comment Input
 */
export interface CreateCommentInput {
  task_id: string;
  content: string;
  mentions?: string[];
  attachment_ids?: string[];
  parent_comment_id?: string;
}

/**
 * Update Comment Input
 */
export interface UpdateCommentInput {
  content: string;
  mentions?: string[];
}

/**
 * Create Tag Input
 */
export interface CreateTagInput {
  name: string;
  color: string;
  description?: string;
}

/**
 * Update Tag Input
 */
export interface UpdateTagInput {
  name?: string;
  color?: string;
  description?: string | null;
  is_active?: boolean;
}

/**
 * Create Task Dependency Input
 */
export interface CreateDependencyInput {
  parent_task_id: string;
  dependent_task_id: string;
  dependency_type: 'blocks' | 'blocks_completion' | 'relates_to';
}

/**
 * Update Recurrence Input
 */
export interface UpdateRecurrenceInput {
  pattern?: TaskRecurrencePattern;
  interval?: number;
  day_of_week?: number[];
  day_of_month?: number;
  month_of_year?: number;
  end_type?: TaskRecurrenceEndType;
  end_after_count?: number | null;
  end_date?: Date | string | null;
  is_active?: boolean;
}

/**
 * Move Task Input (for drag and drop)
 */
export interface MoveTaskInput {
  task_id: string;
  new_day?: TaskDay;
  new_list_id?: string | null;
  new_position?: number; // Position within the list/day
  new_parent_task_id?: string | null;
}

/**
 * Copy Task Input
 */
export interface CopyTaskInput {
  task_id: string;
  new_list_id?: string;
  new_day?: TaskDay;
  include_subtasks?: boolean;
  include_attachments?: boolean;
}

// ─── Query Types ──────────────────────────────────────────────────────────────

export interface TaskFilters {
  list_id?: string;
  status?: TaskStatus | TaskStatus[];
  day?: TaskDay | TaskDay[];
  in_my_day?: boolean;
  assigned_to?: string | string[];
  created_by?: string;
  tags?: string[] | string;       // Accept both array and comma-separated string
  search?: string;
  due_from?: Date | string;
  due_to?: Date | string;
  due_date_range?: 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'this_month' | 'no_due_date';
  priority?: TaskPriority | TaskPriority[];
  parent_task_id?: string | null; // null for top-level tasks
  has_subtasks?: boolean;
  has_attachments?: boolean;
  has_comments?: boolean;
  is_favorite?: boolean;
  is_recurring?: boolean;
  completed_from?: Date | string;
  completed_to?: Date | string;
  reminder_date_from?: Date | string;
  reminder_date_to?: Date | string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'due_date' | 'priority' | 'title' | 'position' | 'completed_at' | 'start_date';
  sort_order?: 'ASC' | 'DESC';
  include_deleted?: boolean;
  include_subtasks?: boolean;
  include_attachments?: boolean;
  include_comments?: boolean;
  include_dependencies?: boolean;
  include_recurrence?: boolean;
}

export interface TaskPaginationResponse {
  data: Task[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface TaskSummary {
  total: number;
  completed: number;
  pending: number;
  archived: number;
  in_my_day: number;
  overdue: number;
  due_today: number;
  due_this_week: number;
  by_day: {
    Today: number;
    Tomorrow: number;
    Upcoming: number;
    Someday: number;
  };
  by_priority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  by_status: {
    pending: number;
    completed: number;
    archived: number;
  };
  by_list: {
    list_id: string;
    list_name: string;
    count: number;
    completed: number;
  }[];
  by_assignee: {
    user_id: string;
    user_name: string;
    count: number;
    completed: number;
  }[];
  by_tag: {
    tag_id: string;
    tag_name: string;
    color: string;
    count: number;
  }[];
}

export interface TaskTimelineFilters {
  start_date: Date | string;
  end_date: Date | string;
  group_by: 'day' | 'week' | 'month' | 'quarter' | 'year';
  list_id?: string;
  assigned_to?: string;
  status?: TaskStatus | TaskStatus[];
  include_completed?: boolean;
}

export interface TaskTimelineData {
  date: string; // ISO date string
  total: number;
  completed: number;
  pending: number;
  archived: number;
  tasks: Task[];
}

export interface TaskAnalytics {
  average_completion_time: number; // in hours
  tasks_completed_per_day: number;
  tasks_created_per_day: number;
  peak_productivity_time: string; // Hour of day
  most_productive_day: string; // Day of week
  completion_rate_by_priority: {
    priority: TaskPriority;
    rate: number; // 0-100
  }[];
  average_subtasks_per_task: number;
  tasks_with_attachments_percentage: number;
  overdue_tasks_percentage: number;
  time_estimates_accuracy: {
    estimated_vs_actual_hours: number;
    tasks_under_estimated: number;
    tasks_over_estimated: number;
    tasks_on_time: number;
  };
}

// ─── Analytics Filters ──────────────────────────────────────────────────────

export interface TaskAnalyticsFilters {
  list_id?: string;
  assigned_to?: string;
  from_date?: Date | string;
  to_date?: Date | string;
}

// ─── Helper Types ────────────────────────────────────────────────────────────

/**
 * Type for parsing tags from various input formats
 */
export type TagInput = string | string[] | null | undefined;

/**
 * Type for service method parameters that accept null from validation
 */
export type NullableToOptional<T> = {
  [K in keyof T]: T[K] extends null ? T[K] | undefined : T[K];
};

/**
 * Convert CreateTaskInput to a type that handles null from validation
 */
export type CreateTaskInputWithNull = {
  [K in keyof CreateTaskInput]: CreateTaskInput[K] | null;
};

/**
 * Search-related types
 */
export interface TaskSearchRequest {
  query: string;
  filters?: TaskFilters;
  highlight_matches?: boolean;
  fuzzy_match?: boolean;
  search_fields?: ('title' | 'description' | 'notes' | 'subtasks' | 'comments')[];
}

export interface TaskSearchResult {
  task: Task;
  score: number; // Relevance score
  matched_fields: string[]; // Which fields matched
  highlights?: {
    field: string;
    text: string; // Highlighted text
    positions: number[]; // Character positions
  }[];
}

export interface TaskSearchResponse {
  results: TaskSearchResult[];
  total: number;
  took_ms: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
  suggested_queries?: string[];
}

/**
 * Export types
 */
export interface TaskExportOptions {
  format: 'json' | 'csv' | 'pdf' | 'html';
  filters?: TaskFilters;
  include_fields?: (keyof Task)[];
  include_subtasks?: boolean;
  include_comments?: boolean;
  include_attachments?: boolean;
  include_activity_log?: boolean;
  date_range?: {
    from: Date;
    to: Date;
  };
}

export interface TaskImportOptions {
  format: 'json' | 'csv' | 'todoist' | 'trello' | 'asana';
  data: any;
  merge_strategy: 'replace' | 'merge' | 'skip_existing';
  import_to_list_id?: string;
  mapping?: Record<string, string>; // Field mapping for CSV
  dry_run?: boolean;
}

export interface TaskImportResult {
  imported: number;
  failed: number;
  errors: {
    row: number;
    error: string;
  }[];
  summary: {
    tasks_created: number;
    tasks_updated: number;
    subtasks_created: number;
    attachments_uploaded: number;
  };
}

/**
 * Notification types
 */
export interface TaskNotification {
  id: string;
  user_id: string;
  task_id: string;
  event_type: TaskEventType;
  message: string;
  is_read: boolean;
  link?: string;
  created_at: Date;
  read_at?: Date;
  metadata?: Record<string, any>;
}

export interface NotificationFilters {
  is_read?: boolean;
  event_type?: TaskEventType | TaskEventType[];
  from_date?: Date;
  to_date?: Date;
  limit?: number;
  offset?: number;
}