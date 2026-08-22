// src/features/projects/projects.types.ts

export type ProjectTaskStatus = 'inprogress' | 'done' | 'overdue' | 'pending_approval' | 'blocked' | 'review';
export type ProjectPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';
export type ProjectVisibility = 'public' | 'private' | 'team';
export type ChecklistStatus = 'completed' | 'in_progress' | 'no_progress' | 'pending';

// ─── Status Transition Rules ──────────────────────────────────────────────

/**
 * Allowed status transitions for tasks
 * This ensures systematic status changes
 */
export const TASK_STATUS_TRANSITIONS: Record<ProjectTaskStatus, ProjectTaskStatus[]> = {
  inprogress: ['done', 'blocked', 'pending_approval', 'review'],
  done: ['inprogress', 'review', 'pending_approval'],
  overdue: ['inprogress', 'done', 'blocked', 'pending_approval'],
  pending_approval: ['done', 'inprogress', 'blocked', 'review'],
  blocked: ['inprogress', 'pending_approval'],
  review: ['done', 'inprogress', 'pending_approval', 'blocked'],
};

/**
 * Check if a status transition is valid
 */
export const canTransitionTo = (
  currentStatus: ProjectTaskStatus,
  newStatus: ProjectTaskStatus
): boolean => {
  return TASK_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
};

/**
 * Get available next statuses for a task
 */
export const getAvailableStatuses = (currentStatus: ProjectTaskStatus): ProjectTaskStatus[] => {
  return TASK_STATUS_TRANSITIONS[currentStatus] || [];
};

// ─── User Types ─────────────────────────────────────────────────────────────

export interface ProjectUser {
    id: string;
    full_name: string;
    pj_number: string;
    email: string;
    role?: 'admin' | 'member' | 'viewer';
    avatar?: string;
}

// ─── File/Attachment Types ─────────────────────────────────────────────────

export interface ProjectFile {
    id: string;
    task_id?: string;
    project_id?: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    public_id: string;
    secure_url: string;
    uploaded_by: string;
    uploaded_by_name: string;
    created_at: string;
    updated_at: string;
}

export interface ProjectFileInput {
    file: Express.Multer.File;
    task_id?: string;
    project_id?: string;
}

// ─── Comment Types ─────────────────────────────────────────────────────────

export interface ProjectTaskComment {
    id: string;
    task_id: string;
    user_id: string;
    user_name: string;
    content: string;
    attachments?: ProjectFile[];
    created_at: string;
    updated_at: string;
}

// ─── Subtask Types ─────────────────────────────────────────────────────────

export interface ProjectSubtask {
    id: string;
    task_id: string;
    title: string;
    description: string | null;
    completed: boolean;
    is_active: boolean;
    assigned_to: string | null;
    assigned_to_name?: string | null;
    created_at: string;
    updated_at: string;
}

// ─── Main Task Types ──────────────────────────────────────────────────────

export interface ProjectTask {
    id: string;
    project_id: string | null;
    title: string;
    description: string | null;
    status: ProjectTaskStatus;
    priority: ProjectPriority;
    type?: string;
    assignee: string | null;
    assignee_name: string | null;
    deadline: string;
    start_date: string | null;
    completed_at?: string | null;
    tags: string[];
    estimated_hours: number | null;
    actual_hours: number | null;
    parent_task_id: string | null;
    visibility: ProjectVisibility;
    is_active: boolean;
    created_by: string;
    created_by_name: string;
    created_at: string;
    updated_at: string;
    updated_by?: string;
    updated_by_name?: string;
    subtasks?: ProjectSubtask[];
    comments?: ProjectTaskComment[];
    attachments?: ProjectFile[];
    
    // Checklist-specific fields
    checklist_status?: ChecklistStatus;
    next_steps?: string | null;
    team_lead?: string | null;
    serial_number?: number | null;
    category?: string | null;
    
    // Progress tracking
    progress_percentage?: number;
    subtasks_completed?: number;
    subtasks_total?: number;
}

// ─── Project Types ─────────────────────────────────────────────────────────

export interface Project {
    id: string;
    title: string;
    description: string | null;
    priority: ProjectPriority;
    deadline: string;
    start_date?: string | null;
    completed_at?: string | null;
    tags: string[];
    members: ProjectUser[];
    tasks: ProjectTask[];
    attachments?: ProjectFile[];
    task_count?: number;
    completed_task_count?: number;
    progress_percentage?: number;
    is_active: boolean;
    created_by: string;
    created_by_name?: string;
    created_at: string;
    updated_at: string;
    updated_by?: string;
    updated_by_name?: string;
}

// ─── Input Types ───────────────────────────────────────────────────────────

export interface CreateProjectInput {
    title: string;
    description?: string;
    priority?: ProjectPriority;
    deadline?: string;
    start_date?: string;
    tags?: string[];
    member_ids?: string[];
}

export interface UpdateProjectInput {
    title?: string;
    description?: string | null;
    priority?: ProjectPriority;
    deadline?: string | null;
    start_date?: string | null;
    tags?: string[];
    member_ids?: string[];
    is_active?: boolean;
}

export interface CreateProjectTaskInput {
    project_id?: string;
    title: string;
    description?: string | null;
    status?: ProjectTaskStatus;
    priority?: ProjectPriority;
    type?: string;
    assignee?: string | null;
    deadline?: string;
    start_date?: string | null;
    tags?: string[];
    estimated_hours?: number;
    parent_task_id?: string | null;
    visibility?: ProjectVisibility;
    checklist_status?: ChecklistStatus;
    next_steps?: string | null;
    team_lead?: string | null;
    serial_number?: number | null;
    category?: string | null;
}

export interface UpdateProjectTaskInput {
    project_id?: string | null;
    title?: string;
    description?: string | null;
    status?: ProjectTaskStatus;
    priority?: ProjectPriority;
    type?: string;
    assignee?: string | null;
    deadline?: string | null;
    start_date?: string | null;
    tags?: string[];
    estimated_hours?: number | null;
    actual_hours?: number | null;
    parent_task_id?: string | null;
    visibility?: ProjectVisibility;
    checklist_status?: ChecklistStatus;
    next_steps?: string | null;
    team_lead?: string | null;
    serial_number?: number | null;
    category?: string | null;
    completed_at?: string | null;
}

export interface CreateProjectSubtaskInput {
    title: string;
    description?: string | null;
    assigned_to?: string | null;
}

export interface UpdateProjectSubtaskInput {
    title?: string;
    description?: string | null;
    completed?: boolean;
    assigned_to?: string | null;
}

export interface CreateProjectCommentInput {
    content: string;
    attachments?: File[];
}

export interface UpdateProjectCommentInput {
    content: string;
}

// ─── File Upload Types ─────────────────────────────────────────────────────

export interface UploadProjectFileInput {
    task_id?: string;
    project_id?: string;
    file: Express.Multer.File;
}

export interface BulkUploadProjectFilesInput {
    task_id?: string;
    project_id?: string;
    files: Express.Multer.File[];
}

// ─── Filter Types ──────────────────────────────────────────────────────────

export interface ProjectTaskFilters {
    project_id?: string;
    status?: ProjectTaskStatus;
    priority?: ProjectPriority;
    type?: string;
    assignee?: string;
    tags?: string[] | string;
    search?: string;
    deadline_from?: string;
    deadline_to?: string;
    page?: number;
    limit?: number;
    sort_by?: 'created_at' | 'deadline' | 'priority' | 'status' | 'title' | 'updated_at';
    sort_order?: 'ASC' | 'DESC';
    checklist_status?: ChecklistStatus;
    category?: string;
    team_lead?: string;
    assigned_to_me?: boolean;
}

export interface ProjectFilters {
    search?: string;
    page?: number;
    limit?: number;
    member_id?: string;
    created_by?: string;
    is_active?: boolean;
    priority?: ProjectPriority;
    deadline_from?: string;
    deadline_to?: string;
}

// ─── Response Types ────────────────────────────────────────────────────────

export interface ProjectPaginationResponse {
    data: Project[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ProjectTaskPaginationResponse {
    data: ProjectTask[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ProjectStats {
    inprogress: number;
    done: number;
    overdue: number;
    pending_approval: number;
    blocked: number;
    review: number;
    total: number;
    completed_percentage: number;
}

export interface TaskAssignmentResponse {
    task: ProjectTask;
    assigned_to: ProjectUser;
    assigned_at: string;
}

// ─── Checklist Types ──────────────────────────────────────────────────────

export interface ChecklistTask {
    serial_number: number;
    activity: string;
    status: ChecklistStatus;
    next_steps: string | null;
    team_lead: string | null;
    category: string | null;
    task_id?: string;
    description?: string | null;
    deadline?: string | null;
    priority?: string | null;
    assignee_name?: string | null;
}

export interface ChecklistSection {
    category: string;
    tasks: ChecklistTask[];
    total: number;
    completed: number;
    in_progress: number;
    no_progress: number;
    pending: number;
}

export interface ChecklistStats {
    total: number;
    completed: number;
    in_progress: number;
    no_progress: number;
    pending: number;
    sections: ChecklistSection[];
    completion_percentage: number;
}

export interface ChecklistFilters {
    category?: string;
    status?: ChecklistStatus;
    team_lead?: string;
    search?: string;
}

export interface ChecklistStatsResponse {
    stats: ChecklistStats;
    categories: string[];
}

export interface ChecklistBulkUpdateResult {
    success: boolean;
    updated_count: number;
    failed_ids?: string[];
    errors?: Array<{ id: string; error: string }>;
}

export interface ChecklistReorderResult {
    success: boolean;
    reordered_count: number;
    category?: string | null;
}

// ─── Activity/Log Types ───────────────────────────────────────────────────

export type ActivityType = 
    | 'project_created'
    | 'project_updated'
    | 'task_created'
    | 'task_updated'
    | 'task_assigned'
    | 'task_status_changed'
    | 'task_completed'
    | 'comment_added'
    | 'file_uploaded'
    | 'subtask_completed'
    | 'member_added'
    | 'member_removed';

export interface ProjectActivity {
    id: string;
    project_id: string;
    task_id?: string;
    user_id: string;
    user_name: string;
    activity_type: ActivityType;
    description: string;
    metadata?: Record<string, unknown>;
    created_at: string;
}

// ─── Component Props ──────────────────────────────────────────────────────

export interface TaskCardProps {
    task: ProjectTask;
    onTaskClick?: (task: ProjectTask) => void;
    onStatusChange?: (taskId: string, newStatus: ProjectTaskStatus) => void;
    onAssigneeChange?: (taskId: string, userId: string) => void;
    onEdit?: (task: ProjectTask) => void;
    onDelete?: (taskId: string) => void;
    isEditable?: boolean;
    isDraggable?: boolean;
}

export interface ChecklistTableProps {
    tasks: ChecklistTask[];
    onStatusChange: (serialNumber: number, status: ChecklistStatus) => void;
    onNextStepsUpdate: (serialNumber: number, nextSteps: string) => void;
    onTeamLeadUpdate: (serialNumber: number, teamLead: string) => void;
    onTaskClick?: (taskId: string) => void;
    isLoading?: boolean;
}

export interface TaskStatusBadgeProps {
    status: ProjectTaskStatus;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

export interface TaskPriorityBadgeProps {
    priority: ProjectPriority;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

// ─── Utility Types ─────────────────────────────────────────────────────────

export type TaskStatusCounts = Record<ProjectTaskStatus, number>;

export interface TaskAnalytics {
    total: number;
    by_status: TaskStatusCounts;
    by_priority: Record<ProjectPriority, number>;
    by_assignee: Record<string, number>;
    overdue: number;
    due_soon: number; // Due within 7 days
    completed: number;
    completion_rate: number;
}

export type ProjectMemberRole = 'admin' | 'member' | 'viewer';

export interface ProjectMember {
    user_id: string;
    role: ProjectMemberRole;
    joined_at: string;
}

// ─── Status Labels and Colors ─────────────────────────────────────────────

export const TASK_STATUS_LABELS: Record<ProjectTaskStatus, string> = {
    inprogress: 'In Progress',
    done: 'Done',
    overdue: 'Overdue',
    pending_approval: 'Pending Approval',
    blocked: 'Blocked',
    review: 'In Review',
};

export const TASK_STATUS_COLORS: Record<ProjectTaskStatus, string> = {
    inprogress: 'blue',
    done: 'green',
    overdue: 'red',
    pending_approval: 'amber',
    blocked: 'rose',
    review: 'purple',
};

export const TASK_PRIORITY_LABELS: Record<ProjectPriority, string> = {
    low: 'Low',
    normal: 'Normal',
    high: 'High',
    urgent: 'Urgent',
    critical: 'Critical',
};

export const TASK_PRIORITY_COLORS: Record<ProjectPriority, string> = {
    low: 'gray',
    normal: 'blue',
    high: 'orange',
    urgent: 'red',
    critical: 'rose',
};

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
    completed: 'Completed',
    in_progress: 'In Progress',
    no_progress: 'Not Started',
    pending: 'Pending',
};

export const CHECKLIST_STATUS_COLORS: Record<ChecklistStatus, string> = {
    completed: 'green',
    in_progress: 'blue',
    no_progress: 'gray',
    pending: 'amber',
};