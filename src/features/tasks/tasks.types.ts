
export type MemberCode = string; // e.g., "RHC", "AO", etc.
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'inprogress' | 'done' | 'overdue' | 'pending_approval';

export interface Member {
  name: string;
  role: string;
  color: string;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  deadline: string; // ISO date string
  priority: Priority;
  members: MemberCode[];
  tasks: Task[];
  collapsed?: boolean; // client-only
  created_at: Date;
  updated_at: Date;
}

export interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  assignee: MemberCode | 'GROUP'; // 'GROUP' means assigned to all project members
  priority: Priority;
  deadline: string;
  status: TaskStatus;
  progress: number; // 0-100
  start_date: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TaskNote {
  id: string;
  task_id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

export interface Reminder {
  id: string;
  task_id: string;
  remind_at: Date;
  sent: boolean;
  created_at: Date;
}

// Input types (for creation/update)
export type CreateProjectInput = Pick<Project, 'title' | 'description' | 'deadline' | 'priority' | 'members'>;
export type UpdateProjectInput = Partial<CreateProjectInput> & { id: string };

export type CreateTaskInput = Pick<Task, 'title' | 'description' | 'assignee' | 'priority' | 'deadline' | 'start_date' | 'project_id'>;
export type UpdateTaskInput = Partial<CreateTaskInput> & { id: string; status?: TaskStatus; progress?: number };

export type CreateSubtaskInput = Pick<Subtask, 'task_id' | 'title'>;
export type UpdateSubtaskInput = Partial<Pick<Subtask, 'title' | 'completed'>> & { id: string };

export type CreateTaskNoteInput = Pick<TaskNote, 'task_id' | 'content'>;
export type CreateReminderInput = Pick<Reminder, 'task_id' | 'remind_at'>;

// Filters
export interface TaskFilters {
  assignee?: MemberCode;
  status?: TaskStatus;
  project_id?: string;
}