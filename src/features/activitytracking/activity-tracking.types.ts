// activity-tracking.types.ts
// An "activity" is any logged interaction with a contact (a judge, or anyone
// else) — who talked to them, what was said, when. A "reminder" is a
// follow-up commitment, optionally tied back to the activity that prompted
// it, surfaced to the owning staff member (and, in aggregate, to admins) on
// its due date.

export type ContactSource = 'judge' | 'manual';

export type ActivityChannel = 'call' | 'email' | 'whatsapp' | 'in_person' | 'letter' | 'other';

export interface ContactReference {
  contactSource: ContactSource;
  judgeId: string | null;    // set only when contactSource === 'judge'
  contactName: string;       // always populated — copied from the judge record or typed manually
  contactPhone: string | null;
  contactEmail: string | null;
}

// Staff information that comes from the backend with activity logs
export interface StaffInfo {
  id: string;
  full_name: string;
  email?: string;
  role?: string;
  pj_number?: string;
}

export interface ActivityLog extends ContactReference {
  id: string;
  staffId: string;           // who logged the interaction
  staff?: StaffInfo;         // full staff details (populated by backend when available)
  departmentId: string;
  channel: ActivityChannel;
  summary: string;           // "what did they say"
  occurredAt: string;        // ISO timestamp — when the interaction actually happened
  createdAt: string;
  updatedAt: string;
}

// Updated ReminderStatus with more granular statuses
export type ReminderStatus = 
  | 'pending'      // Created but not yet actioned
  | 'in_progress'  // Currently being worked on
  | 'upcoming'     // Scheduled for future (not yet due)
  | 'overdue'      // Past due date
  | 'completed'    // Successfully finished
  | 'cancelled';   // No longer needed

export interface ActivityReminder extends ContactReference {
  id: string;
  staffId: string;                   // who should be reminded
  departmentId: string;
  relatedActivityId: string | null;  // optional link back to the log entry that prompted this
  message: string;                   // e.g. "Call Judge Wanjiru re: Form 60 backlog"
  dueDate: string;                   // ISO date
  status: ReminderStatus;
  completedAt: string | null;
  notifiedAt: string | null;         // last time an in-app notification fired for this reminder
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogFilters {
  staffId?: string;
  departmentId?: string;
  judgeId?: string;
  channel?: ActivityChannel;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface ReminderFilters {
  staffId?: string;
  departmentId?: string;
  status?: ReminderStatus;
  dueBefore?: string; // for overdue queries
  dueOn?: string;     // for "due today" queries
  page?: number;
  pageSize?: number;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export const CHANNEL_LABELS: Record<ActivityChannel, string> = {
  call: 'Phone Call',
  email: 'Email',
  whatsapp: 'WhatsApp',
  in_person: 'In Person',
  letter: 'Letter',
  other: 'Other',
};

// Updated REMINDER_STATUS_LABELS with new statuses
export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  upcoming: 'Upcoming',
  overdue: 'Overdue',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// Updated helper functions to work with new statuses
export function isReminderOverdue(reminder: ActivityReminder): boolean {
  // Only check due date for pending, in_progress, and upcoming statuses
  if (!['pending', 'in_progress', 'upcoming'].includes(reminder.status)) return false;
  const today = new Date().toISOString().split('T')[0];
  return reminder.dueDate < today;
}

export function isReminderDueToday(reminder: ActivityReminder): boolean {
  if (!['pending', 'in_progress', 'upcoming'].includes(reminder.status)) return false;
  const today = new Date().toISOString().split('T')[0];
  return reminder.dueDate === today;
}

export function isReminderUpcoming(reminder: ActivityReminder): boolean {
  if (!['pending', 'in_progress', 'upcoming'].includes(reminder.status)) return false;
  const today = new Date().toISOString().split('T')[0];
  return reminder.dueDate > today;
}

export function canCompleteReminder(reminder: ActivityReminder): boolean {
  // Can complete if status is pending, in_progress, upcoming, or overdue
  return ['pending', 'in_progress', 'upcoming', 'overdue'].includes(reminder.status);
}

export function canSnoozeReminder(reminder: ActivityReminder): boolean {
  // Can snooze if status is pending, in_progress, upcoming, or overdue
  return ['pending', 'in_progress', 'upcoming', 'overdue'].includes(reminder.status);
}

export function canEditReminder(reminder: ActivityReminder): boolean {
  // Can edit if not completed or cancelled
  return !['completed', 'cancelled'].includes(reminder.status);
}

// Helper to get the appropriate status based on due date
export function getAutoStatusFromDueDate(dueDate: string): ReminderStatus {
  const today = new Date().toISOString().split('T')[0];
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'pending';
  return 'upcoming';
}