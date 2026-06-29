import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
    Broadcast,
    Notice,
    BroadcastRead,
    NoticeRead,
    AuditEntry,
    NoticesStats,
    CreateBroadcastInput,
    UpdateBroadcastInput,
    CreateNoticeInput,
    UpdateNoticeInput,
    NoticesFilters,
} from './notices.types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const BROADCAST_SELECT = `
    b.id, b.title, b.body, b.audience, b.delivery_method, b.is_urgent,
    b.is_sent, b.sent_at, b.created_by, b.created_by_name, b.created_at, b.updated_at
`;

const NOTICE_SELECT = `
    n.id, n.title, n.body, n.category, n.visibility,
    n.is_published, n.published_at, n.expires_at,
    n.created_by, n.created_by_name, n.created_at, n.updated_at
`;

// ─── Service Class ────────────────────────────────────────────────────────────

export class NoticesService {

    // ─── Statistics ──────────────────────────────────────────────────────────

    static async getStats(userId: string): Promise<NoticesStats> {
        const { rows } = await pool.query(`
            SELECT
                (SELECT COUNT(*)::int FROM broadcasts WHERE is_active = true) AS total_broadcasts,
                (SELECT COUNT(*)::int FROM notices WHERE is_active = true) AS total_notices,
                (SELECT COUNT(*)::int FROM broadcasts b 
                 WHERE b.is_active = true AND b.is_sent = true
                 AND NOT EXISTS (
                     SELECT 1 FROM broadcast_reads br 
                     WHERE br.broadcast_id = b.id AND br.user_id = $1
                 )) AS unread_broadcasts,
                (SELECT COUNT(*)::int FROM notices n 
                 WHERE n.is_active = true AND n.is_published = true
                 AND NOT EXISTS (
                     SELECT 1 FROM notice_reads nr 
                     WHERE nr.notice_id = n.id AND nr.user_id = $1
                 )) AS unread_notices,
                (SELECT COUNT(*)::int FROM broadcasts 
                 WHERE is_active = true AND is_sent = false) AS pending_broadcasts
        `, [userId]);
        return rows[0];
    }

    // ─── Audit Log ────────────────────────────────────────────────────────────

    static async getAuditLog(limit: number = 50): Promise<AuditEntry[]> {
        const { rows } = await pool.query(
            `SELECT * FROM notices_audit_log 
             WHERE is_active = true
             ORDER BY timestamp DESC
             LIMIT $1`,
            [limit]
        );
        return rows;
    }

    // ─── Broadcasts ──────────────────────────────────────────────────────────

    static async findAllBroadcasts(filters: NoticesFilters = {}): Promise<Broadcast[]> {
        let query = `SELECT ${BROADCAST_SELECT} FROM broadcasts b WHERE b.is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (b.title ILIKE $${paramCount} OR b.body ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.audience) {
            query += ` AND b.audience = $${paramCount}`;
            params.push(filters.audience);
            paramCount++;
        }
        if (filters.is_sent !== undefined) {
            query += ` AND b.is_sent = $${paramCount}`;
            params.push(filters.is_sent);
            paramCount++;
        }

        query += ` ORDER BY b.created_at DESC`;

        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);
        return rows;
    }

    static async findBroadcastById(id: string): Promise<Broadcast | null> {
        const { rows } = await pool.query(
            `SELECT ${BROADCAST_SELECT} FROM broadcasts b WHERE b.id = $1 AND b.is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    static async findBroadcastWithReads(id: string, userId: string): Promise<Broadcast | null> {
        const { rows } = await pool.query(
            `SELECT ${BROADCAST_SELECT},
                    COALESCE(br.is_read, false) AS is_read
             FROM broadcasts b
             LEFT JOIN broadcast_reads br ON br.broadcast_id = b.id AND br.user_id = $2
             WHERE b.id = $1 AND b.is_active = true`,
            [id, userId]
        );
        return rows[0] || null;
    }

    static async createBroadcast(
        input: CreateBroadcastInput,
        userId: string,
        userName: string
    ): Promise<Broadcast> {
        const { rows } = await pool.query(
            `INSERT INTO broadcasts (
                title, body, audience, delivery_method, is_urgent, created_by, created_by_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [
                input.title.trim(),
                input.body.trim(),
                input.audience,
                input.delivery_method || 'In-App + Email',
                input.is_urgent || false,
                userId,
                userName,
            ]
        );

        const broadcast = await this.findBroadcastById(rows[0].id);
        if (!broadcast) throw new AppError(500, 'Failed to create broadcast');
        return broadcast;
    }

    static async updateBroadcast(
        id: string,
        input: UpdateBroadcastInput
    ): Promise<Broadcast> {
        const existing = await this.findBroadcastById(id);
        if (!existing) {
            throw new AppError(404, 'Broadcast not found');
        }

        if (existing.is_sent) {
            throw new AppError(400, 'Cannot update a sent broadcast');
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (input.title !== undefined) {
            updates.push(`title = $${paramCount++}`);
            values.push(input.title.trim());
        }
        if (input.body !== undefined) {
            updates.push(`body = $${paramCount++}`);
            values.push(input.body.trim());
        }
        if (input.audience !== undefined) {
            updates.push(`audience = $${paramCount++}`);
            values.push(input.audience);
        }
        if (input.delivery_method !== undefined) {
            updates.push(`delivery_method = $${paramCount++}`);
            values.push(input.delivery_method);
        }
        if (input.is_urgent !== undefined) {
            updates.push(`is_urgent = $${paramCount++}`);
            values.push(input.is_urgent);
        }
        if (input.is_sent !== undefined) {
            updates.push(`is_sent = $${paramCount++}`);
            values.push(input.is_sent);
            if (input.is_sent === true) {
                updates.push(`sent_at = NOW()`);
            }
        }

        if (updates.length === 0) {
            return existing;
        }

        values.push(id);

        await pool.query(
            `UPDATE broadcasts SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        const updated = await this.findBroadcastById(id);
        if (!updated) throw new AppError(500, 'Failed to update broadcast');
        return updated;
    }

    static async deleteBroadcast(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE broadcasts SET is_active = false WHERE id = $1 RETURNING id`,
            [id]
        );
        if (rows.length === 0) {
            throw new AppError(404, 'Broadcast not found');
        }
    }

    // ─── Notices ──────────────────────────────────────────────────────────────

    static async findAllNotices(filters: NoticesFilters = {}): Promise<Notice[]> {
        let query = `SELECT ${NOTICE_SELECT} FROM notices n WHERE n.is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (n.title ILIKE $${paramCount} OR n.body ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.category) {
            query += ` AND n.category = $${paramCount}`;
            params.push(filters.category);
            paramCount++;
        }
        if (filters.is_published !== undefined) {
            query += ` AND n.is_published = $${paramCount}`;
            params.push(filters.is_published);
            paramCount++;
        }

        query += ` ORDER BY n.created_at DESC`;

        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);
        return rows;
    }

    static async findNoticeById(id: string): Promise<Notice | null> {
        const { rows } = await pool.query(
            `SELECT ${NOTICE_SELECT} FROM notices n WHERE n.id = $1 AND n.is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    static async findNoticeWithReads(id: string, userId: string): Promise<Notice | null> {
        const { rows } = await pool.query(
            `SELECT ${NOTICE_SELECT},
                    COALESCE(nr.is_read, false) AS is_read
             FROM notices n
             LEFT JOIN notice_reads nr ON nr.notice_id = n.id AND nr.user_id = $2
             WHERE n.id = $1 AND n.is_active = true`,
            [id, userId]
        );
        return rows[0] || null;
    }

    static async createNotice(
        input: CreateNoticeInput,
        userId: string,
        userName: string
    ): Promise<Notice> {
        const { rows } = await pool.query(
            `INSERT INTO notices (
                title, body, category, visibility, expires_at, created_by, created_by_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [
                input.title.trim(),
                input.body.trim(),
                input.category,
                input.visibility || 'All Staff',
                input.expires_at || null,
                userId,
                userName,
            ]
        );

        const notice = await this.findNoticeById(rows[0].id);
        if (!notice) throw new AppError(500, 'Failed to create notice');
        return notice;
    }

    // src/features/notices/notices.service.ts

static async updateNotice(
    id: string,
    input: UpdateNoticeInput
): Promise<Notice> {
    const existing = await this.findNoticeById(id);
    if (!existing) {
        throw new AppError(404, 'Notice not found');
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (input.title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        values.push(input.title.trim());
    }
    if (input.body !== undefined) {
        updates.push(`body = $${paramCount++}`);
        values.push(input.body.trim());
    }
    if (input.category !== undefined) {
        updates.push(`category = $${paramCount++}`);
        values.push(input.category);
    }
    if (input.visibility !== undefined) {
        updates.push(`visibility = $${paramCount++}`);
        values.push(input.visibility);
    }
    if (input.is_published !== undefined) {
        updates.push(`is_published = $${paramCount++}`);
        values.push(input.is_published);
        if (input.is_published === true) {
            updates.push(`published_at = NOW()`);
        }
    }
    if (input.expires_at !== undefined) {
        updates.push(`expires_at = $${paramCount++}`);
        values.push(input.expires_at); // Now accepts null
    }

    if (updates.length === 0) {
        return existing;
    }

    values.push(id);

    await pool.query(
        `UPDATE notices SET ${updates.join(', ')} WHERE id = $${paramCount}`,
        values
    );

    const updated = await this.findNoticeById(id);
    if (!updated) throw new AppError(500, 'Failed to update notice');
    return updated;
}

    static async deleteNotice(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE notices SET is_active = false WHERE id = $1 RETURNING id`,
            [id]
        );
        if (rows.length === 0) {
            throw new AppError(404, 'Notice not found');
        }
    }

    // ─── Read Receipts ──────────────────────────────────────────────────────

    static async markBroadcastRead(broadcastId: string, userId: string): Promise<void> {
        // Check if broadcast exists and is sent
        const { rows: broadcastRows } = await pool.query(
            `SELECT id FROM broadcasts WHERE id = $1 AND is_sent = true AND is_active = true`,
            [broadcastId]
        );
        if (broadcastRows.length === 0) {
            throw new AppError(404, 'Broadcast not found or not sent');
        }

        await pool.query(
            `INSERT INTO broadcast_reads (broadcast_id, user_id, read_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (broadcast_id, user_id) DO UPDATE SET read_at = NOW()`,
            [broadcastId, userId]
        );
    }

    static async markNoticeRead(noticeId: string, userId: string): Promise<void> {
        // Check if notice exists and is published
        const { rows: noticeRows } = await pool.query(
            `SELECT id FROM notices WHERE id = $1 AND is_published = true AND is_active = true`,
            [noticeId]
        );
        if (noticeRows.length === 0) {
            throw new AppError(404, 'Notice not found or not published');
        }

        await pool.query(
            `INSERT INTO notice_reads (notice_id, user_id, read_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (notice_id, user_id) DO UPDATE SET read_at = NOW()`,
            [noticeId, userId]
        );
    }

    static async getBroadcastReadCount(broadcastId: string): Promise<number> {
        const { rows } = await pool.query(
            `SELECT COUNT(*)::int as count FROM broadcast_reads WHERE broadcast_id = $1`,
            [broadcastId]
        );
        return rows[0]?.count || 0;
    }

    static async getNoticeReadCount(noticeId: string): Promise<number> {
        const { rows } = await pool.query(
            `SELECT COUNT(*)::int as count FROM notice_reads WHERE notice_id = $1`,
            [noticeId]
        );
        return rows[0]?.count || 0;
    }

    // ─── Get unread count for user ──────────────────────────────────────────

    static async getUnreadCount(userId: string): Promise<{ broadcasts: number; notices: number }> {
        const { rows: broadcastRows } = await pool.query(
            `SELECT COUNT(*)::int as count
             FROM broadcasts b
             WHERE b.is_active = true AND b.is_sent = true
             AND NOT EXISTS (
                 SELECT 1 FROM broadcast_reads br 
                 WHERE br.broadcast_id = b.id AND br.user_id = $1
             )`,
            [userId]
        );

        const { rows: noticeRows } = await pool.query(
            `SELECT COUNT(*)::int as count
             FROM notices n
             WHERE n.is_active = true AND n.is_published = true
             AND NOT EXISTS (
                 SELECT 1 FROM notice_reads nr 
                 WHERE nr.notice_id = n.id AND nr.user_id = $1
             )`,
            [userId]
        );

        return {
            broadcasts: broadcastRows[0]?.count || 0,
            notices: noticeRows[0]?.count || 0,
        };
    }
}