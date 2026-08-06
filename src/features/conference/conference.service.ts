// src/services/conference.service.ts

import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
  CreateConferenceRequestInput,
  UpdateConferenceRequestInput,
  ConferenceRequestFilters,
  ConferenceRequest,
  ConferenceStats,
  ConferenceStatus,
} from './conference.types';

// ─── SELECT fragments ──────────────────────────────────────────────────────────

const CONFERENCE_SELECT = `
  cr.id, cr.serial_number, cr.particulars,
  cr.start_date, cr.end_date, cr.number_of_pax,
  cr.status,
  cr.created_by, u.full_name AS created_by_name,
  cr.created_at, cr.updated_at
`;

const CONFERENCE_JOIN = `
  FROM conference_requests cr
  LEFT JOIN users u ON u.id = cr.created_by
`;

const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'start_date', 'end_date', 'serial_number']);

// ─── Custom Error Classes ─────────────────────────────────────────────────────

export class ConferenceRequestNotFoundError extends AppError {
  constructor(id: string) {
    super(404, `Conference request with ID "${id}" not found`);
    this.name = 'ConferenceRequestNotFoundError';
  }
}

export class ConferenceRequestInvalidStatusError extends AppError {
  constructor(currentStatus: string, targetStatus: string) {
    super(400, `Cannot transition from "${currentStatus}" to "${targetStatus}"`);
    this.name = 'ConferenceRequestInvalidStatusError';
  }
}

export class ConferenceDateError extends AppError {
  constructor(message: string) {
    super(400, message);
    this.name = 'ConferenceDateError';
  }
}

// ─── Conference Service ──────────────────────────────────────────────────────

export class ConferenceService {
  // ─── Conference Create ──────────────────────────────────────────────────────

  /**
   * Create a new conference request
   */
  static async createConferenceRequest(
    data: CreateConferenceRequestInput,
    userId: string,
    userName: string
  ): Promise<ConferenceRequest> {
    console.log('[ConferenceService] Creating conference request...');

    // Validate date range
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    if (startDate > endDate) {
      throw new ConferenceDateError('Start date must be before or equal to end date');
    }

    try {
      // Get the next serial number
      const serialResult = await pool.query(
        `SELECT COALESCE(MAX(serial_number), 0) + 1 as next_serial FROM conference_requests`
      );
      const nextSerial = serialResult.rows[0].next_serial;

      const { rows } = await pool.query(
        `INSERT INTO conference_requests
          (serial_number, particulars, start_date, end_date,
           number_of_pax, status, created_by, created_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          nextSerial,
          data.particulars.trim(),
          startDate,
          endDate,
          data.number_of_pax,
          'draft',
          userId,
          userName,
        ]
      );

      console.log(`[ConferenceService] Conference request created with ID: ${rows[0].id}, Serial: ${nextSerial}`);
      const result = await this.findConferenceById(rows[0].id);
      if (!result) {
        throw new AppError(500, 'Failed to retrieve created conference request');
      }
      return result;
    } catch (error: any) {
      console.error('[ConferenceService] Error creating conference request:', error);
      throw error;
    }
  }

  // ─── Conference Read ──────────────────────────────────────────────────────

  /**
   * Get all conference requests with pagination and filters
   */
  static async getConferenceRequests(
    filters: ConferenceRequestFilters
  ): Promise<{
    data: ConferenceRequest[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      status,
      start_date_from,
      start_date_to,
      page = 1,
      limit = 20,
      sort_by = 'serial_number',
      sort_order = 'DESC',
    } = filters;

    const sortCol = ALLOWED_SORT.has(sort_by) ? `cr.${sort_by}` : 'cr.serial_number';
    const sortDir = sort_order === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const conditions: string[] = ['cr.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (status) {
      conditions.push(`cr.status = $${p}`);
      values.push(status);
      p++;
    }

    if (start_date_from) {
      conditions.push(`cr.start_date >= $${p}`);
      values.push(new Date(start_date_from));
      p++;
    }

    if (start_date_to) {
      conditions.push(`cr.start_date <= $${p}`);
      values.push(new Date(start_date_to));
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult, dataResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total ${CONFERENCE_JOIN} ${where}`,
        values
      ),
      pool.query(
        `SELECT ${CONFERENCE_SELECT} ${CONFERENCE_JOIN}
         ${where}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT $${p} OFFSET $${p + 1}`,
        [...values, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
    return {
      data: dataResult.rows.map(this.mapToConferenceRequest),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single conference request by ID
   */
  static async findConferenceById(id: string): Promise<ConferenceRequest | null> {
    const { rows } = await pool.query(
      `SELECT ${CONFERENCE_SELECT} ${CONFERENCE_JOIN}
       WHERE cr.id = $1 AND cr.is_active = true`,
      [id]
    );
    return rows[0] ? this.mapToConferenceRequest(rows[0]) : null;
  }

  /**
   * Get a single conference request by ID (throws if not found)
   */
  static async findConferenceByIdOrThrow(id: string): Promise<ConferenceRequest> {
    const result = await this.findConferenceById(id);
    if (!result) {
      throw new ConferenceRequestNotFoundError(id);
    }
    return result;
  }

  // ─── Conference Update ────────────────────────────────────────────────────

  /**
   * Update a conference request
   */
  static async updateConferenceRequest(
    id: string,
    data: UpdateConferenceRequestInput
  ): Promise<ConferenceRequest> {
    console.log(`[ConferenceService] Updating conference request ${id}`);

    // Check if exists
    const existing = await this.findConferenceByIdOrThrow(id);

    // Prevent updates to completed or cancelled conferences
    if (existing.status === 'completed' || existing.status === 'cancelled') {
      throw new AppError(400, `Cannot update a ${existing.status} conference request`);
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (data.particulars !== undefined) {
      updates.push(`particulars = $${p++}`);
      values.push(data.particulars.trim());
    }
    if (data.start_date !== undefined) {
      const startDate = new Date(data.start_date);
      if (isNaN(startDate.getTime())) {
        throw new AppError(400, 'Invalid start date');
      }
      updates.push(`start_date = $${p++}`);
      values.push(startDate);
    }
    if (data.end_date !== undefined) {
      const endDate = new Date(data.end_date);
      if (isNaN(endDate.getTime())) {
        throw new AppError(400, 'Invalid end date');
      }
      updates.push(`end_date = $${p++}`);
      values.push(endDate);
    }
    if (data.number_of_pax !== undefined) {
      updates.push(`number_of_pax = $${p++}`);
      values.push(data.number_of_pax);
    }
    if (data.status !== undefined) {
      // Validate status transition
      this.validateStatusTransition(existing.status, data.status);
      updates.push(`status = $${p++}`);
      values.push(data.status);
    }

    if (!updates.length) {
      throw new AppError(400, 'No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE conference_requests SET ${updates.join(', ')} WHERE id = $${p}`,
      values
    );

    console.log(`[ConferenceService] Conference request ${id} updated successfully`);
    const result = await this.findConferenceById(id);
    if (!result) {
      throw new AppError(500, 'Failed to retrieve updated conference request');
    }
    return result;
  }

  // ─── Conference Approve ────────────────────────────────────────────────────

  /**
   * Approve a conference request (Super Admin only)
   * Transitions status from 'pending' to 'approved'
   */
  static async approveConferenceRequest(
    id: string,
    comments?: string
  ): Promise<ConferenceRequest> {
    console.log(`[ConferenceService] Approving conference request ${id}`);

    const existing = await this.findConferenceByIdOrThrow(id);

    if (existing.status !== 'pending') {
      throw new ConferenceRequestInvalidStatusError(existing.status, 'approved');
    }

    await pool.query(
      `UPDATE conference_requests 
       SET status = 'approved', 
           updated_at = NOW() 
       WHERE id = $1`,
      [id]
    );

    console.log(`[ConferenceService] Conference request ${id} approved successfully`);
    const result = await this.findConferenceById(id);
    if (!result) {
      throw new AppError(500, 'Failed to retrieve approved conference request');
    }
    return result;
  }

  // ─── Conference Return ─────────────────────────────────────────────────────

  /**
   * Return a conference request to the requester (Super Admin only)
   * Transitions status from 'pending' to 'rejected'
   */
  static async returnConferenceRequest(
    id: string,
    reason: string
  ): Promise<ConferenceRequest> {
    console.log(`[ConferenceService] Returning conference request ${id}`);

    const existing = await this.findConferenceByIdOrThrow(id);

    if (existing.status !== 'pending') {
      throw new ConferenceRequestInvalidStatusError(existing.status, 'rejected');
    }

    await pool.query(
      `UPDATE conference_requests 
       SET status = 'rejected', 
           updated_at = NOW() 
       WHERE id = $1`,
      [id]
    );

    console.log(`[ConferenceService] Conference request ${id} returned successfully`);
    const result = await this.findConferenceById(id);
    if (!result) {
      throw new AppError(500, 'Failed to retrieve returned conference request');
    }
    return result;
  }

  // ─── Conference Complete ──────────────────────────────────────────────────

  /**
   * Mark a conference as completed
   * Transitions status from 'approved' to 'completed'
   */
  static async completeConference(
    id: string,
    feedback?: string
  ): Promise<ConferenceRequest> {
    console.log(`[ConferenceService] Completing conference request ${id}`);

    const existing = await this.findConferenceByIdOrThrow(id);

    if (existing.status !== 'approved') {
      throw new ConferenceRequestInvalidStatusError(existing.status, 'completed');
    }

    await pool.query(
      `UPDATE conference_requests 
       SET status = 'completed', 
           updated_at = NOW() 
       WHERE id = $1`,
      [id]
    );

    console.log(`[ConferenceService] Conference request ${id} marked as completed`);
    const result = await this.findConferenceById(id);
    if (!result) {
      throw new AppError(500, 'Failed to retrieve completed conference request');
    }
    return result;
  }

  // ─── Conference Cancel ────────────────────────────────────────────────────

  /**
   * Cancel a conference request
   * Transitions status to 'cancelled'
   */
  static async cancelConference(
    id: string,
    reason: string
  ): Promise<ConferenceRequest> {
    console.log(`[ConferenceService] Cancelling conference request ${id}`);

    const existing = await this.findConferenceByIdOrThrow(id);

    // Can cancel from draft, pending, or approved
    if (!['draft', 'pending', 'approved'].includes(existing.status)) {
      throw new AppError(400, `Cannot cancel a ${existing.status} conference request`);
    }

    await pool.query(
      `UPDATE conference_requests 
       SET status = 'cancelled', 
           updated_at = NOW() 
       WHERE id = $1`,
      [id]
    );

    console.log(`[ConferenceService] Conference request ${id} cancelled successfully`);
    const result = await this.findConferenceById(id);
    if (!result) {
      throw new AppError(500, 'Failed to retrieve cancelled conference request');
    }
    return result;
  }

  // ─── Conference Submit ────────────────────────────────────────────────────

  /**
   * Submit a conference request for approval
   * Transitions status from 'draft' to 'pending'
   */
  static async submitConferenceRequest(id: string): Promise<ConferenceRequest> {
    console.log(`[ConferenceService] Submitting conference request ${id}`);

    const existing = await this.findConferenceByIdOrThrow(id);

    if (existing.status !== 'draft') {
      throw new ConferenceRequestInvalidStatusError(existing.status, 'pending');
    }

    await pool.query(
      `UPDATE conference_requests 
       SET status = 'pending', 
           updated_at = NOW() 
       WHERE id = $1`,
      [id]
    );

    console.log(`[ConferenceService] Conference request ${id} submitted for approval`);
    const result = await this.findConferenceById(id);
    if (!result) {
      throw new AppError(500, 'Failed to retrieve submitted conference request');
    }
    return result;
  }

  // ─── Conference Delete ────────────────────────────────────────────────────

  /**
   * Delete a conference request (soft delete)
   */
  static async deleteConferenceRequest(id: string): Promise<void> {
    console.log(`[ConferenceService] Deleting conference request ${id}`);

    const existing = await this.findConferenceById(id);
    if (!existing) {
      throw new ConferenceRequestNotFoundError(id);
    }

    // Only allow deletion of draft, pending, or rejected
    if (!['draft', 'pending', 'rejected'].includes(existing.status)) {
      throw new AppError(400, `Cannot delete a ${existing.status} conference request`);
    }

    const { rowCount } = await pool.query(
      `UPDATE conference_requests SET is_active = false, updated_at = NOW() WHERE id = $1 AND is_active = true`,
      [id]
    );

    if (rowCount === 0) {
      throw new ConferenceRequestNotFoundError(id);
    }

    console.log(`[ConferenceService] Conference request ${id} deleted successfully`);
  }

  // ─── Conference Stats ──────────────────────────────────────────────────────

  /**
   * Get statistics for conference requests
   */
  static async getConferenceStats(startDate?: string, endDate?: string): Promise<ConferenceStats> {
    const conditions: string[] = ['cr.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (startDate) {
      conditions.push(`cr.created_at >= $${p}`);
      values.push(new Date(startDate));
      p++;
    }

    if (endDate) {
      conditions.push(`cr.created_at <= $${p}`);
      values.push(new Date(endDate));
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total and status breakdown
    const [totalResult, statusResult, paxResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total ${CONFERENCE_JOIN} ${where}`, values),
      pool.query(
        `SELECT status, COUNT(*) AS count ${CONFERENCE_JOIN} ${where}
         GROUP BY status`,
        values
      ),
      pool.query(
        `SELECT SUM(number_of_pax) AS total_pax ${CONFERENCE_JOIN} ${where}`,
        values
      ),
    ]);

    const total = parseInt(totalResult.rows[0]?.total ?? '0', 10);
    const totalPax = parseInt(paxResult.rows[0]?.total_pax ?? '0', 10);

    const statusMap = statusResult.rows.reduce((acc: Record<string, number>, row) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    }, {});

    // Calculate upcoming and ongoing
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const [upcomingResult, ongoingResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS count ${CONFERENCE_JOIN}
         WHERE cr.is_active = true AND cr.status = 'approved'
         AND cr.start_date > $1 AND cr.start_date <= $2`,
        [now, sevenDaysFromNow]
      ),
      pool.query(
        `SELECT COUNT(*) AS count ${CONFERENCE_JOIN}
         WHERE cr.is_active = true AND cr.status = 'approved'
         AND cr.start_date <= $1 AND cr.end_date >= $1`,
        [now]
      ),
    ]);

    return {
      total,
      draft: statusMap['draft'] || 0,
      pending: statusMap['pending'] || 0,
      approved: statusMap['approved'] || 0,
      rejected: statusMap['rejected'] || 0,
      completed: statusMap['completed'] || 0,
      cancelled: statusMap['cancelled'] || 0,
      total_pax: totalPax,
      upcoming: parseInt(upcomingResult.rows[0]?.count ?? '0', 10),
      ongoing: parseInt(ongoingResult.rows[0]?.count ?? '0', 10),
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Validate status transition
   */
  private static validateStatusTransition(current: ConferenceStatus, target: ConferenceStatus): void {
    const validTransitions: Record<ConferenceStatus, ConferenceStatus[]> = {
      draft: ['pending', 'cancelled'],
      pending: ['approved', 'rejected', 'cancelled'],
      approved: ['completed', 'cancelled'],
      rejected: ['draft', 'cancelled'],
      completed: [],
      cancelled: ['draft'],
    };

    const allowed = validTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new ConferenceRequestInvalidStatusError(current, target);
    }
  }

  /**
   * Map database row to ConferenceRequest type
   */
  private static mapToConferenceRequest(row: any): ConferenceRequest {
    return {
      id: row.id,
      serial_number: row.serial_number,
      particulars: row.particulars,
      start_date: row.start_date,
      end_date: row.end_date,
      number_of_pax: row.number_of_pax,
      status: row.status as ConferenceStatus,
      created_by: row.created_by,
      created_by_name: row.created_by_name,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export default new ConferenceService();