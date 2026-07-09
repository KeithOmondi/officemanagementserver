// src/features/tickets/tickets.service.ts
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import { sendMail } from '../../utils/sendMail';
import type {
  Ticket,
  TicketWithHistory,
  TicketPaginationResponse,
  TicketApprovalStep,
  TicketComment,
  TicketStatus,
} from './tickets.types';
import type {
  CreateTicketInput,
  UpdateTicketInput,
  ApproveTicketInput,
  RejectTicketInput,
  ReturnTicketInput,
  BookTicketInput,
  AddCommentInput,
  TicketFilters,
} from './tickets.validator';

// ── SELECT fragments ──────────────────────────────────────────────────────────

const TICKET_SELECT = `
  t.id, t.reference_no, t.title, t.description,
  t.department_id, d.name AS department_name,
  t.date_of_travel, t.return_date,
  t.departure_from, t.destination,
  t.preferred_flight_time, t.remarks,
  t.judge_name, t.pj_number,
  t.travel_class, t.number_of_passengers, t.special_requests,
  t.status, t.priority,
  t.assigned_to, au.full_name AS assigned_to_name,
  t.created_by, cu.full_name AS created_by_name,
  t.approved_by, ap.full_name AS approved_by_name,
  t.approved_at,
  t.rejected_reason,
  t.booked_by, bu.full_name AS booked_by_name,
  t.booked_at, t.booking_reference,
  t.is_active, t.created_at, t.updated_at
`;

const TICKET_JOIN = `
  FROM tickets t
  LEFT JOIN departments d ON d.id = t.department_id
  LEFT JOIN users au ON au.id = t.assigned_to
  LEFT JOIN users cu ON cu.id = t.created_by
  LEFT JOIN users ap ON ap.id = t.approved_by
  LEFT JOIN users bu ON bu.id = t.booked_by
`;

const APPROVAL_HISTORY_SELECT = `
  h.id, h.ticket_id, h.action,
  h.from_user_id, fu.full_name AS from_user_name,
  h.to_user_id, tu.full_name AS to_user_name,
  h.comments, h.created_at
`;

const APPROVAL_HISTORY_JOIN = `
  FROM ticket_approval_history h
  LEFT JOIN users fu ON fu.id = h.from_user_id
  LEFT JOIN users tu ON tu.id = h.to_user_id
`;

const COMMENT_SELECT = `
  c.id, c.ticket_id, c.user_id, u.full_name AS user_name,
  c.comment, c.is_internal, c.created_at
`;

const COMMENT_JOIN = `
  FROM ticket_comments c
  LEFT JOIN users u ON u.id = c.user_id
`;

const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'date_of_travel', 'priority', 'status']);

// ── Service ───────────────────────────────────────────────────────────────────

export class TicketService {

  // ── Helper: Generate Reference Number ───────────────────────────────────────

  private static async generateReference(): Promise<string> {
    const { rows } = await pool.query(
      `SELECT reference_no FROM tickets ORDER BY created_at DESC LIMIT 1`
    );
    const lastRef = rows[0]?.reference_no || 'TKT-0000';
    const lastNum = parseInt(lastRef.split('-')[1], 10);
    const newNum = String(lastNum + 1).padStart(4, '0');
    return `TKT-${newNum}`;
  }

  // ── Helper: Add Approval History Step (now accepts optional client) ────────

  private static async addApprovalHistory(
    ticketId: string,
    action: TicketApprovalStep['action'],
    fromUserId: string,
    toUserId: string | null,
    comments: string | null = null,
    client?: any // optional transaction client
  ): Promise<void> {
    const db = client || pool;
    await db.query(
      `INSERT INTO ticket_approval_history
         (ticket_id, action, from_user_id, to_user_id, comments)
       VALUES ($1, $2, $3, $4, $5)`,
      [ticketId, action, fromUserId, toUserId, comments]
    );
  }

  // ── Helper: Validate department & assignment for dept_head ─────────────────

  private static async validateDepartmentScope(
    userId: string,
    proposedDepartmentId: string | null | undefined,
    proposedAssigneeId: string | null | undefined
  ): Promise<{ departmentId: string | null; assigneeId: string | null }> {
    const userResult = await pool.query(
      `SELECT role, department_id FROM users WHERE id = $1 AND is_active = true`,
      [userId]
    );
    if (userResult.rows.length === 0) {
      throw new AppError(404, 'User not found');
    }
    const user = userResult.rows[0];
    const isDeptHead = user.role === 'dept_head';
    const isSuperAdmin = user.role === 'super_admin';

    let finalDepartmentId: string | null = null;
    let finalAssigneeId: string | null = proposedAssigneeId ?? null;

    if (isDeptHead) {
      finalDepartmentId = user.department_id;
      if (!finalDepartmentId) {
        throw new AppError(400, 'Department head has no department assigned');
      }
      if (proposedDepartmentId && proposedDepartmentId !== finalDepartmentId) {
        throw new AppError(403, 'You cannot create tickets for another department');
      }
    } else if (isSuperAdmin) {
      finalDepartmentId = proposedDepartmentId ?? null;
    } else {
      throw new AppError(403, 'You do not have permission to create/update tickets');
    }

    if (finalAssigneeId) {
      const assigneeResult = await pool.query(
        `SELECT department_id FROM users WHERE id = $1 AND is_active = true`,
        [finalAssigneeId]
      );
      if (assigneeResult.rows.length === 0) {
        throw new AppError(404, 'Assigned user not found');
      }
      const assigneeDept = assigneeResult.rows[0].department_id;
      if (finalDepartmentId !== null && assigneeDept !== finalDepartmentId) {
        throw new AppError(400, 'Assigned user does not belong to the selected department');
      }
    }

    return { departmentId: finalDepartmentId, assigneeId: finalAssigneeId };
  }

  // ── Create Ticket ───────────────────────────────────────────────────────────

  static async createTicket(
    input: CreateTicketInput,
    createdBy: string
  ): Promise<Ticket> {
    const { departmentId, assigneeId } = await this.validateDepartmentScope(
      createdBy,
      input.department_id,
      input.assigned_to
    );

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const referenceNo = await this.generateReference();
      const status: TicketStatus = input.is_draft ? 'draft' : 'pending_approval';

      const { rows } = await client.query(
        `INSERT INTO tickets
           (reference_no, title, description, department_id,
            date_of_travel, return_date, departure_from, destination,
            preferred_flight_time, remarks,
            judge_name, pj_number,
            travel_class, number_of_passengers, special_requests,
            status, priority, assigned_to, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         RETURNING id`,
        [
          referenceNo,
          input.title.trim(),
          input.description?.trim() ?? null,
          departmentId,
          new Date(input.date_of_travel),
          input.return_date ? new Date(input.return_date) : null,
          input.departure_from.trim(),
          input.destination.trim(),
          input.preferred_flight_time,
          input.remarks?.trim() ?? null,
          input.judge_name?.trim() ?? null,
          input.pj_number?.trim() ?? null,
          input.travel_class,
          input.number_of_passengers,
          input.special_requests?.trim() ?? null,
          status,
          input.priority,
          assigneeId,
          createdBy,
        ]
      );

      const ticketId = rows[0].id;

      // Pass the transaction client
      await this.addApprovalHistory(
        ticketId,
        'submitted',
        createdBy,
        assigneeId ?? null,
        input.is_draft ? 'Saved as draft' : 'Ticket submitted for approval',
        client
      );

      await client.query('COMMIT');
      return (await this.findById(ticketId))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Find All ─────────────────────────────────────────────────────────────────

  static async findAll(
    filters: TicketFilters,
    requestingUserId: string
  ): Promise<TicketPaginationResponse> {
    const {
      search, status, priority, department_id, assigned_to, created_by,
      date_from, date_to, departure_from, destination,
      judge_name, pj_number,
      for_my_action,
      page = 1, limit = 20,
      sort_by = 'created_at', sort_order = 'DESC',
    } = filters;

    const sortCol = ALLOWED_SORT.has(sort_by ?? '') ? `t.${sort_by}` : 't.created_at';
    const sortDir = sort_order === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const conditions: string[] = ['t.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (search) {
      conditions.push(`(t.title ILIKE $${p} OR t.reference_no ILIKE $${p} OR t.departure_from ILIKE $${p} OR t.destination ILIKE $${p} OR t.judge_name ILIKE $${p} OR t.pj_number ILIKE $${p})`);
      values.push(`%${search}%`); p++;
    }
    if (status) { conditions.push(`t.status = $${p}`); values.push(status); p++; }
    if (priority) { conditions.push(`t.priority = $${p}`); values.push(priority); p++; }
    if (department_id) { conditions.push(`t.department_id = $${p}`); values.push(department_id); p++; }
    if (assigned_to) { conditions.push(`t.assigned_to = $${p}`); values.push(assigned_to); p++; }
    if (created_by) { conditions.push(`t.created_by = $${p}`); values.push(created_by); p++; }
    if (departure_from) { conditions.push(`t.departure_from ILIKE $${p}`); values.push(`%${departure_from}%`); p++; }
    if (destination) { conditions.push(`t.destination ILIKE $${p}`); values.push(`%${destination}%`); p++; }
    if (judge_name) { conditions.push(`t.judge_name ILIKE $${p}`); values.push(`%${judge_name}%`); p++; }
    if (pj_number) { conditions.push(`t.pj_number ILIKE $${p}`); values.push(`%${pj_number}%`); p++; }
    if (date_from) { conditions.push(`t.date_of_travel >= $${p}`); values.push(new Date(date_from)); p++; }
    if (date_to) { conditions.push(`t.date_of_travel <= $${p}`); values.push(new Date(date_to)); p++; }
    if (for_my_action) {
      conditions.push(`(t.assigned_to = $${p} OR t.created_by = $${p})`);
      values.push(requestingUserId);
      p++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total ${TICKET_JOIN} ${where}`, values),
      pool.query(
        `SELECT ${TICKET_SELECT}
         ${TICKET_JOIN}
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

  // ── Find Single ─────────────────────────────────────────────────────────────

  static async findById(id: string): Promise<Ticket | null> {
    const { rows } = await pool.query(
      `SELECT ${TICKET_SELECT} ${TICKET_JOIN} WHERE t.id = $1 AND t.is_active = true`,
      [id]
    );
    return rows[0] ?? null;
  }

  static async findByIdWithHistory(id: string): Promise<TicketWithHistory | null> {
    const [ticketResult, historyResult, commentsResult] = await Promise.all([
      pool.query(
        `SELECT ${TICKET_SELECT} ${TICKET_JOIN} WHERE t.id = $1 AND t.is_active = true`,
        [id]
      ),
      pool.query(
        `SELECT ${APPROVAL_HISTORY_SELECT} ${APPROVAL_HISTORY_JOIN}
         WHERE h.ticket_id = $1
         ORDER BY h.created_at ASC`,
        [id]
      ),
      pool.query(
        `SELECT ${COMMENT_SELECT} ${COMMENT_JOIN}
         WHERE c.ticket_id = $1
         ORDER BY c.created_at ASC`,
        [id]
      ),
    ]);

    if (!ticketResult.rows[0]) return null;

    return {
      ...ticketResult.rows[0],
      approval_history: historyResult.rows,
      comments: commentsResult.rows,
    };
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  static async update(id: string, input: UpdateTicketInput, userId: string): Promise<Ticket> {
    const existing = await this.findById(id);
    if (!existing) throw new AppError(404, 'Ticket not found');
    if (existing.status === 'booked' || existing.status === 'completed') {
      throw new AppError(409, 'Booked or completed tickets cannot be edited');
    }
    if (existing.status === 'approved') {
      throw new AppError(409, 'Approved tickets cannot be edited');
    }

    const { departmentId, assigneeId } = await this.validateDepartmentScope(
      userId,
      input.department_id ?? existing.department_id,
      input.assigned_to ?? existing.assigned_to
    );

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.title !== undefined) { updates.push(`title = $${p++}`); values.push(input.title.trim()); }
    if (input.description !== undefined) { updates.push(`description = $${p++}`); values.push(input.description?.trim() ?? null); }
    if (input.department_id !== undefined) { updates.push(`department_id = $${p++}`); values.push(departmentId); }
    if (input.date_of_travel !== undefined) { updates.push(`date_of_travel = $${p++}`); values.push(new Date(input.date_of_travel)); }
    if (input.return_date !== undefined) { updates.push(`return_date = $${p++}`); values.push(input.return_date ? new Date(input.return_date) : null); }
    if (input.departure_from !== undefined) { updates.push(`departure_from = $${p++}`); values.push(input.departure_from.trim()); }
    if (input.destination !== undefined) { updates.push(`destination = $${p++}`); values.push(input.destination.trim()); }
    if (input.preferred_flight_time !== undefined) { updates.push(`preferred_flight_time = $${p++}`); values.push(input.preferred_flight_time); }
    if (input.remarks !== undefined) { updates.push(`remarks = $${p++}`); values.push(input.remarks?.trim() ?? null); }
    if (input.judge_name !== undefined) { updates.push(`judge_name = $${p++}`); values.push(input.judge_name?.trim() ?? null); }
    if (input.pj_number !== undefined) { updates.push(`pj_number = $${p++}`); values.push(input.pj_number?.trim() ?? null); }
    if (input.travel_class !== undefined) { updates.push(`travel_class = $${p++}`); values.push(input.travel_class); }
    if (input.number_of_passengers !== undefined) { updates.push(`number_of_passengers = $${p++}`); values.push(input.number_of_passengers); }
    if (input.special_requests !== undefined) { updates.push(`special_requests = $${p++}`); values.push(input.special_requests?.trim() ?? null); }
    if (input.priority !== undefined) { updates.push(`priority = $${p++}`); values.push(input.priority); }
    if (input.assigned_to !== undefined) { updates.push(`assigned_to = $${p++}`); values.push(assigneeId); }

    if (!updates.length) return existing;

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${p}`,
      values
    );
    return (await this.findById(id))!;
  }

  // ── Submit for Approval ─────────────────────────────────────────────────────

  static async submitForApproval(id: string, userId: string): Promise<Ticket> {
    const ticket = await this.findById(id);
    if (!ticket) throw new AppError(404, 'Ticket not found');
    if (ticket.status !== 'draft') {
      throw new AppError(400, 'Only draft tickets can be submitted');
    }

    const { rows: adminRows } = await pool.query(
      `SELECT id, email, full_name FROM users 
       WHERE role = 'super_admin' AND is_active = true LIMIT 1`
    );
    if (!adminRows.length) throw new AppError(400, 'No active super admin found');

    const superAdmin = adminRows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tickets
         SET status = 'pending_approval', 
             assigned_to = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [superAdmin.id, id]
      );

      // Pass the transaction client
      await this.addApprovalHistory(
        id,
        'submitted',
        userId,
        superAdmin.id,
        'Ticket submitted for approval',
        client
      );

      await client.query('COMMIT');

      await sendMail({
        to: superAdmin.email,
        subject: `New Travel Request: ${ticket.reference_no}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px;">
            <h2 style="color:#1E4620;margin-bottom:4px;">New Travel Request</h2>
            <p style="color:#555;font-size:14px;">A new travel request has been submitted for approval:</p>
            <p style="font-weight:bold;color:#333;font-size:16px;">${ticket.title}</p>
            <p style="color:#555;font-size:14px;">Reference: ${ticket.reference_no}</p>
            <p style="color:#555;font-size:14px;">Travel Date: ${new Date(ticket.date_of_travel).toLocaleDateString()}</p>
            <p style="color:#555;font-size:14px;">From: ${ticket.departure_from} → ${ticket.destination}</p>
            ${ticket.judge_name ? `<p style="color:#555;font-size:14px;">Judge: ${ticket.judge_name}</p>` : ''}
            ${ticket.pj_number ? `<p style="color:#555;font-size:14px;">PJ Number: ${ticket.pj_number}</p>` : ''}
            <p style="font-size:12px;color:#999;margin-top:16px;">Please log in to review and take action.</p>
          </div>
        `,
      }).catch(console.error);

      return (await this.findById(id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Approve Ticket ──────────────────────────────────────────────────────────

  static async approveTicket(
    id: string,
    input: ApproveTicketInput,
    userId: string
  ): Promise<Ticket> {
    const ticket = await this.findById(id);
    if (!ticket) throw new AppError(404, 'Ticket not found');
    if (ticket.status !== 'pending_approval') {
      throw new AppError(400, 'Only pending tickets can be approved');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tickets
         SET status = 'approved',
             approved_by = $1,
             approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [userId, id]
      );

      // Pass the transaction client
      await this.addApprovalHistory(
        id,
        'approved',
        userId,
        ticket.created_by,
        input.comments ?? null,
        client
      );

      await client.query('COMMIT');

      // Notify requester
      const { rows: userRows } = await pool.query(
        `SELECT email FROM users WHERE id = $1`,
        [ticket.created_by]
      );
      if (userRows.length) {
        await sendMail({
          to: userRows[0].email,
          subject: `Travel Request Approved: ${ticket.reference_no}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px;">
              <h2 style="color:#1E4620;">Travel Request Approved</h2>
              <p style="color:#555;font-size:14px;">Your travel request has been approved:</p>
              <p style="font-weight:bold;color:#333;">${ticket.title}</p>
              <p style="color:#555;font-size:14px;">Reference: ${ticket.reference_no}</p>
              ${input.comments ? `<p style="color:#555;">Comments: ${input.comments}</p>` : ''}
            </div>
          `,
        }).catch(console.error);
      }

      return (await this.findById(id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Reject Ticket ───────────────────────────────────────────────────────────

  static async rejectTicket(
    id: string,
    input: RejectTicketInput,
    userId: string
  ): Promise<Ticket> {
    const ticket = await this.findById(id);
    if (!ticket) throw new AppError(404, 'Ticket not found');
    if (ticket.status !== 'pending_approval') {
      throw new AppError(400, 'Only pending tickets can be rejected');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tickets
         SET status = 'rejected',
             rejected_reason = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [input.reason, id]
      );

      // Pass the transaction client
      await this.addApprovalHistory(
        id,
        'rejected',
        userId,
        ticket.created_by,
        input.reason,
        client
      );

      await client.query('COMMIT');

      // Notify requester
      const { rows: userRows } = await pool.query(
        `SELECT email FROM users WHERE id = $1`,
        [ticket.created_by]
      );
      if (userRows.length) {
        await sendMail({
          to: userRows[0].email,
          subject: `Travel Request Rejected: ${ticket.reference_no}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px;">
              <h2 style="color:#1E4620;">Travel Request Rejected</h2>
              <p style="color:#555;font-size:14px;">Your travel request has been rejected:</p>
              <p style="font-weight:bold;color:#333;">${ticket.title}</p>
              <p style="color:#555;font-size:14px;">Reference: ${ticket.reference_no}</p>
              <p style="color:#d32f2f;">Reason: ${input.reason}</p>
            </div>
          `,
        }).catch(console.error);
      }

      return (await this.findById(id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Return Ticket ───────────────────────────────────────────────────────────

  static async returnTicket(
    id: string,
    input: ReturnTicketInput,
    userId: string
  ): Promise<Ticket> {
    const ticket = await this.findById(id);
    if (!ticket) throw new AppError(404, 'Ticket not found');
    if (ticket.status !== 'pending_approval') {
      throw new AppError(400, 'Only pending tickets can be returned');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tickets
         SET status = 'draft',
             assigned_to = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [ticket.created_by, id]
      );

      // Pass the transaction client
      await this.addApprovalHistory(
        id,
        'returned',
        userId,
        ticket.created_by,
        `${input.reason}${input.instructions ? ` - Instructions: ${input.instructions}` : ''}`,
        client
      );

      await client.query('COMMIT');
      return (await this.findById(id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Book Ticket ─────────────────────────────────────────────────────────────

  static async bookTicket(
    id: string,
    input: BookTicketInput,
    userId: string
  ): Promise<Ticket> {
    const ticket = await this.findById(id);
    if (!ticket) throw new AppError(404, 'Ticket not found');
    if (ticket.status !== 'approved') {
      throw new AppError(400, 'Only approved tickets can be booked');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tickets
         SET status = 'booked',
             booked_by = $1,
             booked_at = NOW(),
             booking_reference = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [userId, input.booking_reference, id]
      );

      // Pass the transaction client
      await this.addApprovalHistory(
        id,
        'booked',
        userId,
        ticket.created_by,
        input.comments ?? null,
        client
      );

      await client.query('COMMIT');
      return (await this.findById(id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Cancel Ticket ───────────────────────────────────────────────────────────

  static async cancelTicket(id: string, userId: string): Promise<Ticket> {
    const ticket = await this.findById(id);
    if (!ticket) throw new AppError(404, 'Ticket not found');
    if (ticket.status === 'cancelled' || ticket.status === 'completed') {
      throw new AppError(409, 'Ticket is already cancelled or completed');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tickets
         SET status = 'cancelled',
             updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      // Pass the transaction client
      await this.addApprovalHistory(
        id,
        'cancelled',
        userId,
        ticket.created_by,
        'Ticket cancelled',
        client
      );

      await client.query('COMMIT');
      return (await this.findById(id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Complete Ticket ─────────────────────────────────────────────────────────

  static async completeTicket(id: string, userId: string): Promise<Ticket> {
    const ticket = await this.findById(id);
    if (!ticket) throw new AppError(404, 'Ticket not found');
    if (ticket.status !== 'booked') {
      throw new AppError(400, 'Only booked tickets can be completed');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tickets
         SET status = 'completed',
             updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      await client.query('COMMIT');
      return (await this.findById(id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Comments ─────────────────────────────────────────────────────────────────

  static async addComment(
    ticketId: string,
    input: AddCommentInput,
    userId: string
  ): Promise<TicketComment> {
    const ticket = await this.findById(ticketId);
    if (!ticket) throw new AppError(404, 'Ticket not found');

    const { rows } = await pool.query(
      `INSERT INTO ticket_comments
         (ticket_id, user_id, comment, is_internal)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [ticketId, userId, input.comment.trim(), input.is_internal]
    );

    const { rows: result } = await pool.query(
      `SELECT ${COMMENT_SELECT} ${COMMENT_JOIN} WHERE c.id = $1`,
      [rows[0].id]
    );
    return result[0];
  }

  static async deleteComment(
    ticketId: string,
    commentId: string,
    userId: string
  ): Promise<void> {
    const { rows } = await pool.query(
      `SELECT id, user_id FROM ticket_comments
       WHERE id = $1 AND ticket_id = $2`,
      [commentId, ticketId]
    );
    if (!rows.length) throw new AppError(404, 'Comment not found');
    if (rows[0].user_id !== userId) {
      throw new AppError(403, 'You can only delete your own comments');
    }
    await pool.query(`DELETE FROM ticket_comments WHERE id = $1`, [commentId]);
  }

  // ── Delete Ticket ───────────────────────────────────────────────────────────

  static async softDelete(id: string): Promise<void> {
    const ticket = await this.findById(id);
    if (!ticket) throw new AppError(404, 'Ticket not found');

    await pool.query(
      `UPDATE tickets SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }
}