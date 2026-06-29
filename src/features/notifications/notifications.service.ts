import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import { sendMail } from '../../utils/sendMail';
import type {
    Notification,
    NotificationPreferences,
    NotificationDeliveryLog,
    NotificationStats,
    CreateNotificationInput,
    UpdateNotificationInput,
    UpdatePreferencesInput,
    NotificationFilters,
    NotificationPriority,
} from './notifications.types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const NOTIFICATION_SELECT = `
    n.id, n.user_id, n.type_id, n.type_name, n.title, n.message,
    n.icon, n.color, n.link, n.is_read, n.read_at,
    n.is_email_sent, n.email_sent_at, n.priority, n.metadata,
    n.created_at, n.updated_at
`;

// ─── Email Templates ──────────────────────────────────────────────────────────

function buildNotificationEmail(
    title: string,
    message: string,
    typeName: string,
    link?: string,
    metadata?: Record<string, unknown>
): string {
    const typeColors: Record<string, string> = {
        document_signed: '#10b981',
        document_sent: '#3b82f6',
        document_marked: '#8b5cf6',
        document_acknowledged: '#10b981',
        document_completed: '#10b981',
        message_received: '#3b82f6',
        broadcast_received: '#f59e0b',
        notice_posted: '#6366f1',
        task_assigned: '#8b5cf6',
        task_updated: '#3b82f6',
        request_approved: '#10b981',
        request_rejected: '#ef4444',
        procurement_approved: '#10b981',
        procurement_rejected: '#ef4444',
        stock_low: '#f59e0b',
        stock_out: '#ef4444',
        system_alert: '#ef4444',
    };

    const color = typeColors[typeName] || '#1d3331';

    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid ${color};">
                <h2 style="color: #1d3331; font-size: 20px; margin: 0;">Office of the Registrar</h2>
                <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0;">Notification</p>
            </div>
            
            <div style="padding: 20px 0;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <span style="font-size: 28px;">${metadata?.icon || '📬'}</span>
                    <h3 style="color: #1d3331; font-size: 18px; margin: 0;">${title}</h3>
                </div>
                
                <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                    ${message}
                </p>
                
                ${link ? `
                    <div style="margin: 20px 0;">
                        <a href="${link}" style="display: inline-block; background-color: ${color}; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px;">
                            View Details
                        </a>
                    </div>
                ` : ''}
                
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                        This is an automated notification from the Office of the Registrar.
                        ${typeName === 'system_alert' ? ' Please take immediate action if required.' : ''}
                    </p>
                </div>
            </div>
        </div>
    `;
}

// ─── Service Class ────────────────────────────────────────────────────────────

export class NotificationsService {

    // ─── Create Notification ──────────────────────────────────────────────────

    static async createNotification(
        input: CreateNotificationInput,
        io?: any // Socket.IO instance
    ): Promise<Notification> {
        // Get user's preferences
        const { rows: prefRows } = await pool.query(
            `SELECT * FROM notification_preferences WHERE user_id = $1`,
            [input.user_id]
        );
        const preferences = prefRows[0] || { email_enabled: true, in_app_enabled: true };

        // Insert notification
        const { rows } = await pool.query(
            `INSERT INTO notifications (
                user_id, type_name, title, message, icon, color, link, priority, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id`,
            [
                input.user_id,
                input.type_name,
                input.title,
                input.message,
                input.icon || null,
                input.color || null,
                input.link || null,
                input.priority || 'normal',
                input.metadata || null,
            ]
        );

        const notification = await this.findNotificationById(rows[0].id);
        if (!notification) throw new AppError(500, 'Failed to create notification');

        // ── Send email if enabled ────────────────────────────────────────────
        if (preferences.email_enabled !== false && input.send_email !== false) {
            try {
                // Get user email
                const { rows: userRows } = await pool.query(
                    `SELECT email, full_name FROM users WHERE id = $1`,
                    [input.user_id]
                );
                const user = userRows[0];

                if (user) {
                    await sendMail({
                        to: user.email,
                        subject: input.title,
                        html: buildNotificationEmail(
                            input.title,
                            input.message,
                            input.type_name,
                            input.link,
                            input.metadata
                        ),
                    });

                    // Mark email as sent
                    await pool.query(
                        `UPDATE notifications SET is_email_sent = true, email_sent_at = NOW()
                         WHERE id = $1`,
                        [notification.id]
                    );

                    // Log delivery
                    await pool.query(
                        `INSERT INTO notification_delivery_log (notification_id, channel, status, delivered_at)
                         VALUES ($1, 'email', 'delivered', NOW())`,
                        [notification.id]
                    );
                }
            } catch (error) {
                console.error(`Failed to send email notification ${notification.id}:`, error);
                // Log failure
                await pool.query(
                    `INSERT INTO notification_delivery_log (notification_id, channel, status, error_message)
                     VALUES ($1, 'email', 'failed', $2)`,
                    [notification.id, String(error)]
                );
            }
        }

        // ── Log in-app delivery ──────────────────────────────────────────────
        if (preferences.in_app_enabled !== false) {
            await pool.query(
                `INSERT INTO notification_delivery_log (notification_id, channel, status, delivered_at)
                 VALUES ($1, 'in_app', 'delivered', NOW())`,
                [notification.id]
            );
        }

        // ── Emit via WebSocket ──────────────────────────────────────────────
        if (io) {
            // Send to user's room
            io.to(`user:${input.user_id}`).emit('notification', notification);
            
            // Also send updated unread count
            const unreadCount = await this.getUnreadCount(input.user_id);
            io.to(`user:${input.user_id}`).emit('unread_count', { count: unreadCount });
        }

        // Get updated notification with delivery status
        return this.findNotificationById(notification.id) as Promise<Notification>;
    }

    // ─── Find Notification by ID ─────────────────────────────────────────────

    static async findNotificationById(id: string): Promise<Notification | null> {
        const { rows } = await pool.query(
            `SELECT ${NOTIFICATION_SELECT}
             FROM notifications n
             WHERE n.id = $1`,
            [id]
        );
        return rows[0] || null;
    }

    // ─── Get User Notifications ─────────────────────────────────────────────

    static async getUserNotifications(
        userId: string,
        filters: NotificationFilters = {}
    ): Promise<{ notifications: Notification[]; total: number }> {
        let query = `
            SELECT ${NOTIFICATION_SELECT}
            FROM notifications n
            WHERE n.user_id = $1
        `;
        const params: unknown[] = [userId];
        let paramCount = 2;

        if (filters.type_name) {
            query += ` AND n.type_name = $${paramCount++}`;
            params.push(filters.type_name);
        }

        if (filters.is_read !== undefined) {
            query += ` AND n.is_read = $${paramCount++}`;
            params.push(filters.is_read);
        }

        if (filters.priority) {
            query += ` AND n.priority = $${paramCount++}`;
            params.push(filters.priority);
        }

        if (filters.search) {
            query += ` AND (n.title ILIKE $${paramCount} OR n.message ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }

        if (filters.start_date) {
            query += ` AND n.created_at >= $${paramCount++}`;
            params.push(filters.start_date);
        }

        if (filters.end_date) {
            query += ` AND n.created_at <= $${paramCount}::date + interval '1 day'`;
            params.push(filters.end_date);
            paramCount++;
        }

        // Get total count
        const countQuery = query.replace(
            `SELECT ${NOTIFICATION_SELECT}`,
            'SELECT COUNT(*) as total'
        );
        const { rows: countRows } = await pool.query(countQuery, params.slice(0, paramCount - 1));
        const total = parseInt(countRows[0]?.total || '0');

        // Order and pagination
        query += ` ORDER BY n.created_at DESC`;

        if (filters.limit) {
            query += ` LIMIT $${paramCount++}`;
            params.push(filters.limit);
        }

        if (filters.offset) {
            query += ` OFFSET $${paramCount++}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);

        return { notifications: rows, total };
    }

    // ─── Get Unread Count ────────────────────────────────────────────────────

    static async getUnreadCount(userId: string): Promise<number> {
        const { rows } = await pool.query(
            `SELECT COUNT(*)::int as count
             FROM notifications
             WHERE user_id = $1 AND is_read = false`,
            [userId]
        );
        return rows[0]?.count || 0;
    }

    // ─── Mark Notification as Read ──────────────────────────────────────────

    static async markAsRead(
        id: string,
        userId: string,
        io?: any
    ): Promise<Notification> {
        const existing = await this.findNotificationById(id);
        if (!existing) {
            throw new AppError(404, 'Notification not found');
        }

        if (existing.user_id !== userId) {
            throw new AppError(403, 'You do not have permission to update this notification');
        }

        await pool.query(
            `UPDATE notifications
             SET is_read = true, read_at = NOW()
             WHERE id = $1`,
            [id]
        );

        // Update delivery log
        await pool.query(
            `INSERT INTO notification_delivery_log (notification_id, channel, status, delivered_at)
             VALUES ($1, 'in_app', 'read', NOW())`,
            [id]
        );

        const updated = await this.findNotificationById(id);
        if (!updated) throw new AppError(500, 'Failed to update notification');

        // Emit updated unread count
        if (io) {
            const unreadCount = await this.getUnreadCount(userId);
            io.to(`user:${userId}`).emit('unread_count', { count: unreadCount });
        }

        return updated;
    }

    // ─── Mark All as Read ──────────────────────────────────────────────────

    static async markAllAsRead(userId: string, io?: any): Promise<void> {
        await pool.query(
            `UPDATE notifications
             SET is_read = true, read_at = NOW()
             WHERE user_id = $1 AND is_read = false`,
            [userId]
        );

        if (io) {
            const unreadCount = await this.getUnreadCount(userId);
            io.to(`user:${userId}`).emit('unread_count', { count: unreadCount });
        }
    }

    // ─── Delete Notification ──────────────────────────────────────────────────

    static async deleteNotification(id: string, userId: string): Promise<void> {
        const existing = await this.findNotificationById(id);
        if (!existing) {
            throw new AppError(404, 'Notification not found');
        }

        if (existing.user_id !== userId) {
            throw new AppError(403, 'You do not have permission to delete this notification');
        }

        await pool.query(
            `DELETE FROM notifications WHERE id = $1`,
            [id]
        );
    }

    // ─── Get Notification Stats ──────────────────────────────────────────────

    static async getStats(userId: string): Promise<NotificationStats> {
        const { rows: totalRows } = await pool.query(
            `SELECT COUNT(*)::int as total
             FROM notifications WHERE user_id = $1`,
            [userId]
        );

        const { rows: unreadRows } = await pool.query(
            `SELECT COUNT(*)::int as unread
             FROM notifications WHERE user_id = $1 AND is_read = false`,
            [userId]
        );

        const { rows: priorityRows } = await pool.query(
            `SELECT priority, COUNT(*)::int as count
             FROM notifications
             WHERE user_id = $1
             GROUP BY priority
             ORDER BY
                 CASE priority
                     WHEN 'urgent' THEN 1
                     WHEN 'high' THEN 2
                     WHEN 'normal' THEN 3
                     WHEN 'low' THEN 4
                 END`,
            [userId]
        );

        const { rows: typeRows } = await pool.query(
            `SELECT type_name, COUNT(*)::int as count
             FROM notifications
             WHERE user_id = $1
             GROUP BY type_name
             ORDER BY count DESC
             LIMIT 5`,
            [userId]
        );

        return {
            total: totalRows[0]?.total || 0,
            unread: unreadRows[0]?.unread || 0,
            read: (totalRows[0]?.total || 0) - (unreadRows[0]?.unread || 0),
            by_priority: priorityRows,
            by_type: typeRows,
        };
    }

    // ─── Get / Update Preferences ──────────────────────────────────────────────

    static async getPreferences(userId: string): Promise<NotificationPreferences> {
        const { rows } = await pool.query(
            `SELECT * FROM notification_preferences WHERE user_id = $1`,
            [userId]
        );

        if (rows.length === 0) {
            // Create default preferences
            const { rows: inserted } = await pool.query(
                `INSERT INTO notification_preferences (user_id)
                 VALUES ($1)
                 RETURNING *`,
                [userId]
            );
            return inserted[0];
        }

        return rows[0];
    }

    static async updatePreferences(
        userId: string,
        input: UpdatePreferencesInput
    ): Promise<NotificationPreferences> {
        const updates: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (input.email_enabled !== undefined) {
            updates.push(`email_enabled = $${paramCount++}`);
            values.push(input.email_enabled);
        }
        if (input.in_app_enabled !== undefined) {
            updates.push(`in_app_enabled = $${paramCount++}`);
            values.push(input.in_app_enabled);
        }
        if (input.email_frequency !== undefined) {
            updates.push(`email_frequency = $${paramCount++}`);
            values.push(input.email_frequency);
        }
        if (input.preferences !== undefined) {
            updates.push(`preferences = $${paramCount++}`);
            values.push(JSON.stringify(input.preferences));
        }

        if (updates.length === 0) {
            return this.getPreferences(userId);
        }

        updates.push(`updated_at = NOW()`);
        values.push(userId);

        await pool.query(
            `UPDATE notification_preferences
             SET ${updates.join(', ')}
             WHERE user_id = $${paramCount}`,
            values
        );

        return this.getPreferences(userId);
    }

    // ─── Delete Old Notifications ──────────────────────────────────────────────

    static async cleanupOldNotifications(days: number = 90): Promise<number> {
        const { rows } = await pool.query(
            `DELETE FROM notifications
             WHERE created_at < NOW() - interval '1 day' * $1
             AND is_read = true
             RETURNING id`,
            [days]
        );
        return rows.length;
    }
}