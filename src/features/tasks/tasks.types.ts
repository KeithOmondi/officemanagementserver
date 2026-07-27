// src/features/tasks/tasks.types.ts

export type TaskDay = 'Today' | 'Tomorrow' | 'Upcoming' | 'Someday';
export type TaskStatus = 'pending' | 'completed' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
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
  public_id: string;             // Cloudinary public ID (for deletion)
  url: string;                   // Accessible URL
  filename: string;              // Original file name
  mimetype: string;              // MIME type
  size: number;                  // File size in bytes
  uploaded_at: Date;
}

export interface Task {
  id: string;
  title: string;
  list_id: string | null;
  list_name: string | null;
  status: TaskStatus;
  day: TaskDay;
  in_my_day: boolean;
  notes: string | null;
  subtasks: Subtask[];
  attachments?: Attachment[];    // Documents, images, etc. attached to the task
  reminder_date: string | null;
  reminder_time: string | null;
  tags: string[];
  priority: TaskPriority;
  due_date: Date | null;
  completed_at: Date | null;
  created_by: string;
  created_by_name: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  subtask_count?: number;
  completed_subtask_count?: number;
}

export interface TaskList {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  is_shared: boolean;
  created_by: string;
  created_by_name: string;
  member_count: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  task_count?: number;
  completed_task_count?: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_by: string;
  is_active: boolean;
  created_at: Date;
}

// ─── Input Types ──────────────────────────────────────────────────────────────

/**
 * Create Task Input
 * All optional fields accept null from validation but are converted to undefined
 * for the service layer.
 * Note: Attachments are handled separately via file upload endpoints and are not
 * part of the JSON payload.
 */
export interface CreateTaskInput {
  title: string;
  list_id?: string;           // null from validation → undefined
  day?: TaskDay;
  in_my_day?: boolean;
  notes?: string;             // null from validation → undefined
  priority?: TaskPriority;
  due_date?: Date | string;   // null from validation → undefined
  assigned_to?: string;       // null from validation → undefined
  tags?: string[];
}

/**
 * Update Task Input
 * All fields are optional and accept null to allow clearing values.
 */
export interface UpdateTaskInput {
  title?: string;
  list_id?: string | null;      // null allowed to unset
  status?: TaskStatus;
  day?: TaskDay;
  in_my_day?: boolean;
  notes?: string | null;        // null allowed to clear
  priority?: TaskPriority;
  due_date?: Date | string | null;  // null allowed to clear
  assigned_to?: string | null;      // null allowed to unset
  tags?: string[];
  reminder_date?: string | null;    // null allowed to clear
  reminder_time?: string | null;    // null allowed to clear
}

/**
 * Create Subtask Input
 * task_id is passed separately in the service, but kept here for type completeness.
 */
export interface CreateSubtaskInput {
  task_id?: string;            // Made optional since it's passed separately
  title: string;
}

/**
 * Update Subtask Input
 */
export interface UpdateSubtaskInput {
  title?: string;
  completed?: boolean;
}

/**
 * Create Task List Input
 */
export interface CreateTaskListInput {
  name: string;
  color?: string;
  icon?: string;
  is_shared?: boolean;
  member_ids?: string[];
}

/**
 * Update Task List Input
 */
export interface UpdateTaskListInput {
  name?: string;
  color?: string | null;      // null allowed to clear
  icon?: string | null;       // null allowed to clear
  is_shared?: boolean;
}

// ─── Query Types ──────────────────────────────────────────────────────────────

export interface TaskFilters {
  list_id?: string;
  status?: TaskStatus;
  day?: TaskDay;
  in_my_day?: boolean;
  assigned_to?: string;
  tags?: string[] | string;    // Accept both array and comma-separated string
  search?: string;
  due_from?: Date | string;
  due_to?: Date | string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'due_date' | 'priority' | 'title';
  sort_order?: 'ASC' | 'DESC';
}

// ─── Response Types ──────────────────────────────────────────────────────────

export interface TaskPaginationResponse {
  data: Task[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TaskSummary {
  total: number;
  completed: number;
  pending: number;
  archived: number;
  in_my_day: number;
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