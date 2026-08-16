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

export type ReminderStatus = 'pending' | 'completed' | 'snoozed' | 'cancelled';

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

export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  snoozed: 'Snoozed',
  cancelled: 'Cancelled',
};

export function isReminderOverdue(reminder: ActivityReminder): boolean {
  if (reminder.status !== 'pending') return false;
  const today = new Date().toISOString().split('T')[0];
  return reminder.dueDate < today;
}

export function isReminderDueToday(reminder: ActivityReminder): boolean {
  if (reminder.status !== 'pending') return false;
  const today = new Date().toISOString().split('T')[0];
  return reminder.dueDate === today;
}

export function canCompleteReminder(reminder: ActivityReminder): boolean {
  return reminder.status === 'pending' || reminder.status === 'snoozed';
}

export function canSnoozeReminder(reminder: ActivityReminder): boolean {
  return reminder.status === 'pending' || reminder.status === 'snoozed';
}