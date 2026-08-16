// activity-tracking.service.ts

import { pool } from '../../config/db';
import { ActivityLog, ActivityReminder, StaffInfo } from './activity-tracking.types';
import {
  CreateActivityLogInput,
  UpdateActivityLogInput,
  ActivityLogListQuery,
  CreateReminderInput,
  UpdateReminderInput,
  ReminderListQuery,
  DueRemindersQuery,
} from './activity-tracking.validator';

function mapActivityLogRow(row: any): ActivityLog {
  return {
    id: row.id,
    staffId: row.staff_id,
    departmentId: row.department_id,
    contactSource: row.contact_source,
    judgeId: row.judge_id,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    channel: row.channel,
    summary: row.summary,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    staff: row.staff_id && row.staff_full_name ? {
      id: row.staff_id,
      full_name: row.staff_full_name,
      email: row.staff_email,
      role: row.staff_role,
      pj_number: row.staff_pj_number,
    } : undefined,
  };
}

function mapReminderRow(row: any): ActivityReminder {
  return {
    id: row.id,
    staffId: row.staff_id,
    departmentId: row.department_id,
    relatedActivityId: row.related_activity_id,
    contactSource: row.contact_source,
    judgeId: row.judge_id,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    message: row.message,
    dueDate: row.due_date,
    status: row.status,
    completedAt: row.completed_at,
    notifiedAt: row.notified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ACTIVITY_LOG_FIELD_TO_COLUMN: Record<string, string> = {
  contactSource: 'contact_source',
  judgeId: 'judge_id',
  contactName: 'contact_name',
  contactPhone: 'contact_phone',
  contactEmail: 'contact_email',
  departmentId: 'department_id',
  channel: 'channel',
  summary: 'summary',
  occurredAt: 'occurred_at',
};

const REMINDER_FIELD_TO_COLUMN: Record<string, string> = {
  contactSource: 'contact_source',
  judgeId: 'judge_id',
  contactName: 'contact_name',
  contactPhone: 'contact_phone',
  contactEmail: 'contact_email',
  departmentId: 'department_id',
  relatedActivityId: 'related_activity_id',
  message: 'message',
  dueDate: 'due_date',
  status: 'status',
};

// ═══════════════════════════════════════════════════════════════════════════
//  ACTIVITY LOG SERVICE
// ═══════════════════════════════════════════════════════════════════════════

class ActivityLogServiceImpl {
  async create(input: CreateActivityLogInput, staffId: string): Promise<ActivityLog> {
    const query = `
      INSERT INTO activity_logs (
        staff_id, department_id, contact_source, judge_id, contact_name,
        contact_phone, contact_email, channel, summary, occurred_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;
    const values = [
      staffId,
      input.departmentId,
      input.contactSource,
      input.judgeId ?? null,
      input.contactName,
      input.contactPhone ?? null,
      input.contactEmail ?? null,
      input.channel,
      input.summary,
      input.occurredAt,
    ];
    const { rows } = await pool.query(query, values);
    const log = mapActivityLogRow(rows[0]);
    const staffInfo = await this.getStaffInfo(staffId);
    return { ...log, staff: staffInfo };
  }

  async findById(id: string): Promise<ActivityLog | null> {
    const query = `
      SELECT 
        al.*,
        u.full_name as staff_full_name,
        u.email as staff_email,
        u.role as staff_role,
        u.pj_number as staff_pj_number
      FROM activity_logs al
      LEFT JOIN users u ON al.staff_id = u.id
      WHERE al.id = $1
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0] ? mapActivityLogRow(rows[0]) : null;
  }

  async findAll(
    filters: ActivityLogListQuery
  ): Promise<{ logs: ActivityLog[]; total: number; page: number; pageSize: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.staffId) {
      conditions.push(`al.staff_id = $${idx++}`);
      values.push(filters.staffId);
    }
    if (filters.departmentId) {
      conditions.push(`al.department_id = $${idx++}`);
      values.push(filters.departmentId);
    }
    if (filters.judgeId) {
      conditions.push(`al.judge_id = $${idx++}`);
      values.push(filters.judgeId);
    }
    if (filters.channel) {
      conditions.push(`al.channel = $${idx++}`);
      values.push(filters.channel);
    }
    if (filters.dateFrom) {
      conditions.push(`al.occurred_at >= $${idx++}`);
      values.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push(`al.occurred_at <= $${idx++}`);
      values.push(filters.dateTo);
    }
    if (filters.search) {
      conditions.push(`(u.full_name ILIKE $${idx} OR al.contact_name ILIKE $${idx})`);
      values.push(`%${filters.search}%`);
      idx++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;
    const offset = (page - 1) * pageSize;

    const dataQuery = `
      SELECT 
        al.*,
        u.full_name as staff_full_name,
        u.email as staff_email,
        u.role as staff_role,
        u.pj_number as staff_pj_number
      FROM activity_logs al
      LEFT JOIN users u ON al.staff_id = u.id
      ${whereClause}
      ORDER BY al.occurred_at DESC
      LIMIT $${idx} OFFSET $${idx + 1};
    `;

    const countQuery = `
      SELECT COUNT(*)::int AS total 
      FROM activity_logs al
      LEFT JOIN users u ON al.staff_id = u.id
      ${whereClause};
    `;

    try {
      const { rows } = await pool.query(dataQuery, [...values, pageSize, offset]);
      const { rows: countRows } = await pool.query(countQuery, values);
      return { 
        logs: rows.map(mapActivityLogRow), 
        total: countRows[0]?.total || 0, 
        page, 
        pageSize 
      };
    } catch (error) {
      console.error('Error in findAll:', error);
      console.error('Query:', dataQuery);
      console.error('Values:', [...values, pageSize, offset]);
      throw error;
    }
  }

  async update(id: string, input: UpdateActivityLogInput): Promise<ActivityLog | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, column] of Object.entries(ACTIVITY_LOG_FIELD_TO_COLUMN)) {
      if (key in input) {
        setClauses.push(`${column} = $${idx++}`);
        values.push((input as any)[key]);
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE activity_logs SET ${setClauses.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    if (rows[0]) {
      const log = mapActivityLogRow(rows[0]);
      const staffInfo = await this.getStaffInfo(log.staffId);
      return { ...log, staff: staffInfo };
    }
    return null;
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await pool.query('DELETE FROM activity_logs WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  private async getStaffInfo(staffId: string): Promise<StaffInfo | undefined> {
    const { rows } = await pool.query(
      `SELECT id, full_name, email, role, pj_number FROM users WHERE id = $1`,
      [staffId]
    );
    if (rows.length === 0) return undefined;
    return {
      id: rows[0].id,
      full_name: rows[0].full_name,
      email: rows[0].email,
      role: rows[0].role,
      pj_number: rows[0].pj_number,
    };
  }
}

export const ActivityLogService = new ActivityLogServiceImpl();

// ═══════════════════════════════════════════════════════════════════════════
//  REMINDER SERVICE
// ═══════════════════════════════════════════════════════════════════════════

class ActivityReminderServiceImpl {
  async create(input: CreateReminderInput, staffId: string): Promise<ActivityReminder> {
    // Auto-set status based on due date
    const today = new Date().toISOString().split('T')[0];
    let status: string;
    
    if (input.dueDate < today) {
      status = 'overdue';
    } else if (input.dueDate === today) {
      status = 'pending';
    } else {
      status = 'upcoming';
    }

    const query = `
      INSERT INTO activity_reminders (
        staff_id, department_id, related_activity_id, contact_source, judge_id,
        contact_name, contact_phone, contact_email, message, due_date, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *;
    `;
    const values = [
      staffId,
      input.departmentId,
      input.relatedActivityId ?? null,
      input.contactSource,
      input.judgeId ?? null,
      input.contactName,
      input.contactPhone ?? null,
      input.contactEmail ?? null,
      input.message,
      input.dueDate,
      status,
    ];
    const { rows } = await pool.query(query, values);
    return mapReminderRow(rows[0]);
  }

  async findById(id: string): Promise<ActivityReminder | null> {
    const { rows } = await pool.query('SELECT * FROM activity_reminders WHERE id = $1', [id]);
    return rows[0] ? mapReminderRow(rows[0]) : null;
  }

  async findAll(
    filters: ReminderListQuery
  ): Promise<{ reminders: ActivityReminder[]; total: number; page: number; pageSize: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.staffId) {
      conditions.push(`staff_id = $${idx++}`);
      values.push(filters.staffId);
    }
    if (filters.departmentId) {
      conditions.push(`department_id = $${idx++}`);
      values.push(filters.departmentId);
    }
    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters.dueBefore) {
      conditions.push(`due_date <= $${idx++}`);
      values.push(filters.dueBefore);
    }
    if (filters.dueOn) {
      conditions.push(`due_date = $${idx++}`);
      values.push(filters.dueOn);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;
    const offset = (page - 1) * pageSize;

    const dataQuery = `
      SELECT * FROM activity_reminders ${whereClause}
      ORDER BY due_date ASC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    const countQuery = `SELECT COUNT(*)::int AS total FROM activity_reminders ${whereClause};`;

    const { rows } = await pool.query(dataQuery, [...values, pageSize, offset]);
    const { rows: countRows } = await pool.query(countQuery, values);

    return { reminders: rows.map(mapReminderRow), total: countRows[0].total, page, pageSize };
  }

  // Updated findDue to include all active statuses (pending, in_progress, upcoming, overdue)
  // Sorted with overdue first, then due today, then upcoming
  async findDue(filters: DueRemindersQuery): Promise<ActivityReminder[]> {
    const conditions: string[] = [
      `status IN ('pending', 'in_progress', 'upcoming', 'overdue')`
    ];
    const values: any[] = [];
    let idx = 1;

    if (filters.staffId) {
      conditions.push(`staff_id = $${idx++}`);
      values.push(filters.staffId);
    }
    if (filters.departmentId) {
      conditions.push(`department_id = $${idx++}`);
      values.push(filters.departmentId);
    }

    const query = `
      SELECT * FROM activity_reminders
      WHERE ${conditions.join(' AND ')}
      ORDER BY 
        CASE 
          WHEN due_date < CURRENT_DATE THEN 0  -- Overdue first
          WHEN due_date = CURRENT_DATE THEN 1  -- Due today second
          ELSE 2                                -- Upcoming last
        END,
        due_date ASC;
    `;
    const { rows } = await pool.query(query, values);
    return rows.map(mapReminderRow);
  }

  // New method to get only overdue reminders
  async findOverdue(filters: DueRemindersQuery): Promise<ActivityReminder[]> {
    const conditions: string[] = [
      `status IN ('pending', 'in_progress')`,
      `due_date < CURRENT_DATE`
    ];
    const values: any[] = [];
    let idx = 1;

    if (filters.staffId) {
      conditions.push(`staff_id = $${idx++}`);
      values.push(filters.staffId);
    }
    if (filters.departmentId) {
      conditions.push(`department_id = $${idx++}`);
      values.push(filters.departmentId);
    }

    const query = `
      SELECT * FROM activity_reminders
      WHERE ${conditions.join(' AND ')}
      ORDER BY due_date ASC;
    `;
    const { rows } = await pool.query(query, values);
    return rows.map(mapReminderRow);
  }

  // New method to update just the status
  async updateStatus(id: string, status: string): Promise<ActivityReminder | null> {
    const query = `
      UPDATE activity_reminders
      SET status = $2, updated_at = now()
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [id, status]);
    return rows[0] ? mapReminderRow(rows[0]) : null;
  }

  // Auto-update statuses based on due date (run daily or on fetch)
  async autoUpdateStatuses(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    // Update upcoming to pending when due date arrives
    await pool.query(
      `UPDATE activity_reminders 
       SET status = 'pending', updated_at = now()
       WHERE status = 'upcoming' AND due_date <= $1`,
      [today]
    );
    
    // Update pending to overdue when past due
    await pool.query(
      `UPDATE activity_reminders 
       SET status = 'overdue', updated_at = now()
       WHERE status = 'pending' AND due_date < $1`,
      [today]
    );
  }

  async update(id: string, input: UpdateReminderInput): Promise<ActivityReminder | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, column] of Object.entries(REMINDER_FIELD_TO_COLUMN)) {
      if (key in input) {
        setClauses.push(`${column} = $${idx++}`);
        values.push((input as any)[key]);
      }
    }

    // If dueDate is being updated, auto-update the status
    if (input.dueDate) {
      const today = new Date().toISOString().split('T')[0];
      let newStatus: string;
      
      if (input.dueDate < today) {
        newStatus = 'overdue';
      } else if (input.dueDate === today) {
        newStatus = 'pending';
      } else {
        newStatus = 'upcoming';
      }
      
      // Only update status if it's not completed or cancelled
      if (!['completed', 'cancelled'].includes(input.status || '')) {
        setClauses.push(`status = $${idx++}`);
        values.push(newStatus);
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE activity_reminders SET ${setClauses.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    return rows[0] ? mapReminderRow(rows[0]) : null;
  }

  async complete(id: string): Promise<ActivityReminder | null> {
    const query = `
      UPDATE activity_reminders
      SET status = 'completed', completed_at = now()
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0] ? mapReminderRow(rows[0]) : null;
  }

  async snooze(id: string, newDueDate: string): Promise<ActivityReminder | null> {
    const query = `
      UPDATE activity_reminders
      SET status = 'snoozed', due_date = $2, notified_at = NULL
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [id, newDueDate]);
    if (rows[0]) {
      const reactivated = await pool.query(
        `UPDATE activity_reminders SET status = 'pending' WHERE id = $1 RETURNING *;`,
        [id]
      );
      return mapReminderRow(reactivated.rows[0]);
    }
    return null;
  }

  async markNotified(id: string): Promise<void> {
    await pool.query(`UPDATE activity_reminders SET notified_at = now() WHERE id = $1;`, [id]);
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await pool.query('DELETE FROM activity_reminders WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }
}

export const ActivityReminderService = new ActivityReminderServiceImpl();