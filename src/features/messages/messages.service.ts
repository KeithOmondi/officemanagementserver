import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
    MessageGroup,
    GroupMember,
    Message,
    MessageAttachment,
    MessageStatus,
    CreateGroupInput,
    UpdateGroupInput,
    AddGroupMembersInput,
    SendMessageInput,
    MessageFilters,
    UnreadCount,
} from './messages.types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const GROUP_SELECT = `
    mg.id, mg.name, mg.description, mg.group_type, mg.department_id,
    d.name AS department_name,
    mg.created_by, u.full_name AS created_by_name,
    mg.is_active, mg.created_at, mg.updated_at,
    COUNT(DISTINCT gm.id) AS member_count
`;

const MESSAGE_SELECT = `
    m.id, m.sender_id, s.full_name AS sender_name, s.email AS sender_email,
    m.group_id, mg.name AS group_name,
    m.recipient_id, r.full_name AS recipient_name,
    m.content, m.message_type, m.priority,
    m.is_read, m.read_at, m.is_archived, m.parent_message_id,
    m.created_at, m.updated_at
`;

// ─── Service Class ────────────────────────────────────────────────────────────

export class MessagesService {

    // ─── Groups ──────────────────────────────────────────────────────────────

    static async createGroup(
        input: CreateGroupInput,
        userId: string
    ): Promise<MessageGroup> {
        const { rows } = await pool.query(
            `INSERT INTO message_groups (
                name, description, group_type, department_id, created_by
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id`,
            [input.name.trim(), input.description || null, input.group_type, input.department_id || null, userId]
        );

        const group = await this.findGroupById(rows[0].id);
        if (!group) throw new AppError(500, 'Failed to create message group');

        // Add creator as admin
        await pool.query(
            `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'admin')`,
            [group.id, userId]
        );

        // Add initial members if provided
        if (input.member_ids?.length) {
            const uniqueMembers = [...new Set(input.member_ids)];
            for (const memberId of uniqueMembers) {
                if (memberId !== userId) {
                    await pool.query(
                        `INSERT INTO group_members (group_id, user_id) 
                         VALUES ($1, $2) 
                         ON CONFLICT (group_id, user_id) DO NOTHING`,
                        [group.id, memberId]
                    );
                }
            }
        }

        return this.findGroupById(group.id) as Promise<MessageGroup>;
    }

    static async findGroupById(id: string): Promise<MessageGroup | null> {
        const { rows } = await pool.query(
            `SELECT ${GROUP_SELECT}
             FROM message_groups mg
             LEFT JOIN users u ON u.id = mg.created_by
             LEFT JOIN departments d ON d.id = mg.department_id
             LEFT JOIN group_members gm ON gm.group_id = mg.id AND gm.is_active = true
             WHERE mg.id = $1 AND mg.is_active = true
             GROUP BY mg.id, u.full_name, d.name`,
            [id]
        );
        return rows[0] || null;
    }

    static async findAllGroups(
        userId?: string,
        groupType?: string
    ): Promise<MessageGroup[]> {
        let query = `
            SELECT ${GROUP_SELECT}
            FROM message_groups mg
            LEFT JOIN users u ON u.id = mg.created_by
            LEFT JOIN departments d ON d.id = mg.department_id
            LEFT JOIN group_members gm ON gm.group_id = mg.id AND gm.is_active = true
            WHERE mg.is_active = true
        `;
        const params: unknown[] = [];
        let paramCount = 1;

        if (userId) {
            query += ` AND EXISTS (
                SELECT 1 FROM group_members gm2 
                WHERE gm2.group_id = mg.id 
                AND gm2.user_id = $${paramCount} 
                AND gm2.is_active = true
            )`;
            params.push(userId);
            paramCount++;
        }

        if (groupType) {
            query += ` AND mg.group_type = $${paramCount}`;
            params.push(groupType);
            paramCount++;
        }

        query += ` GROUP BY mg.id, u.full_name, d.name ORDER BY mg.name ASC`;

        const { rows } = await pool.query(query, params);
        return rows;
    }

    static async updateGroup(
        id: string,
        input: UpdateGroupInput
    ): Promise<MessageGroup> {
        const existing = await this.findGroupById(id);
        if (!existing) {
            throw new AppError(404, 'Message group not found');
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (input.name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(input.name.trim());
        }
        if (input.description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(input.description);
        }
        if (input.is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(input.is_active);
        }

        if (updates.length === 0) return existing;

        values.push(id);

        await pool.query(
            `UPDATE message_groups SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        const updated = await this.findGroupById(id);
        if (!updated) throw new AppError(500, 'Failed to update message group');
        return updated;
    }

    static async deleteGroup(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE message_groups 
             SET is_active = false
             WHERE id = $1 AND is_active = true
             RETURNING id`,
            [id]
        );

        if (rows.length === 0) {
            throw new AppError(404, 'Message group not found');
        }
    }

    // ─── Group Members ──────────────────────────────────────────────────────

    static async getGroupMembers(groupId: string): Promise<GroupMember[]> {
        const { rows } = await pool.query(
            `SELECT gm.id, gm.group_id, gm.user_id, u.full_name AS user_name,
                    u.email AS user_email, gm.role, gm.joined_at, gm.is_active
             FROM group_members gm
             JOIN users u ON u.id = gm.user_id
             WHERE gm.group_id = $1 AND gm.is_active = true
             ORDER BY u.full_name ASC`,
            [groupId]
        );
        return rows;
    }

    static async addGroupMembers(
        groupId: string,
        input: AddGroupMembersInput,
        userId: string
    ): Promise<GroupMember[]> {
        const group = await this.findGroupById(groupId);
        if (!group) {
            throw new AppError(404, 'Message group not found');
        }

        const { rows: adminCheck } = await pool.query(
            `SELECT id FROM group_members 
             WHERE group_id = $1 AND user_id = $2 AND role = 'admin' AND is_active = true`,
            [groupId, userId]
        );

        if (adminCheck.length === 0) {
            throw new AppError(403, 'Only group admins can add members');
        }

        const uniqueUsers = [...new Set(input.user_ids)];
        const added: GroupMember[] = [];

        for (const memberId of uniqueUsers) {
            const { rows } = await pool.query(
                `INSERT INTO group_members (group_id, user_id, role) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (group_id, user_id) DO UPDATE SET is_active = true, role = $3
                 RETURNING id`,
                [groupId, memberId, input.role || 'member']
            );

            if (rows.length > 0) {
                const { rows: memberRows } = await pool.query(
                    `SELECT gm.id, gm.group_id, gm.user_id, u.full_name AS user_name,
                            u.email AS user_email, gm.role, gm.joined_at, gm.is_active
                     FROM group_members gm
                     JOIN users u ON u.id = gm.user_id
                     WHERE gm.id = $1`,
                    [rows[0].id]
                );
                added.push(memberRows[0]);
            }
        }

        return added;
    }

    static async removeGroupMember(
        groupId: string,
        memberId: string,
        userId: string
    ): Promise<void> {
        const group = await this.findGroupById(groupId);
        if (!group) {
            throw new AppError(404, 'Message group not found');
        }

        const { rows: adminCheck } = await pool.query(
            `SELECT id, user_id FROM group_members 
             WHERE group_id = $1 AND user_id = $2 AND role = 'admin' AND is_active = true`,
            [groupId, userId]
        );

        const isAdmin = adminCheck.length > 0;
        const isSelf  = userId === memberId;

        if (!isAdmin && !isSelf) {
            throw new AppError(403, 'Only group admins can remove members');
        }

        await pool.query(
            `UPDATE group_members 
             SET is_active = false
             WHERE group_id = $1 AND user_id = $2 AND is_active = true`,
            [groupId, memberId]
        );
    }

    // ─── Messages ───────────────────────────────────────────────────────────

    static async sendMessage(
        input: SendMessageInput,
        userId: string
    ): Promise<Message> {
        const { rows } = await pool.query(
            `INSERT INTO messages (
                sender_id, group_id, recipient_id, content, 
                message_type, priority, parent_message_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [
                userId,
                input.group_id || null,
                input.recipient_id || null,
                input.content,
                input.message_type || 'text',
                input.priority || 'normal',
                input.parent_message_id || null,
            ]
        );

        const message = await this.findMessageById(rows[0].id);
        if (!message) throw new AppError(500, 'Failed to send message');

        if (input.group_id) {
            const { rows: members } = await pool.query(
                `SELECT user_id FROM group_members 
                 WHERE group_id = $1 AND is_active = true`,
                [input.group_id]
            );

            for (const member of members) {
                await pool.query(
                    `INSERT INTO message_status (message_id, user_id, delivered_at)
                     VALUES ($1, $2, NOW())
                     ON CONFLICT (message_id, user_id) DO NOTHING`,
                    [message.id, member.user_id]
                );
            }
        } else if (input.recipient_id) {
            await pool.query(
                `INSERT INTO message_status (message_id, user_id, delivered_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (message_id, user_id) DO NOTHING`,
                [message.id, input.recipient_id]
            );
        }

        return message;
    }

    static async findMessageById(id: string): Promise<Message | null> {
        const { rows } = await pool.query(
            `SELECT ${MESSAGE_SELECT}
             FROM messages m
             LEFT JOIN users s ON s.id = m.sender_id
             LEFT JOIN message_groups mg ON mg.id = m.group_id
             LEFT JOIN users r ON r.id = m.recipient_id
             WHERE m.id = $1`,
            [id]
        );

        if (rows.length === 0) return null;

        const message = rows[0];

        const { rows: attachments } = await pool.query(
            `SELECT * FROM message_attachments WHERE message_id = $1`,
            [id]
        );
        message.attachments = attachments;

        const { rows: statuses } = await pool.query(
            `SELECT ms.*, u.full_name AS user_name
             FROM message_status ms
             LEFT JOIN users u ON u.id = ms.user_id
             WHERE ms.message_id = $1`,
            [id]
        );
        message.statuses = statuses;

        return message;
    }

    static async getMessages(
        filters: MessageFilters = {},
        userId?: string
    ): Promise<{ messages: Message[]; total: number }> {
        let query = `
            SELECT ${MESSAGE_SELECT}
            FROM messages m
            LEFT JOIN users s ON s.id = m.sender_id
            LEFT JOIN message_groups mg ON mg.id = m.group_id
            LEFT JOIN users r ON r.id = m.recipient_id
            WHERE m.is_archived = false
        `;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND m.content ILIKE $${paramCount}`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }

        if (filters.group_id) {
            query += ` AND m.group_id = $${paramCount}`;
            params.push(filters.group_id);
            paramCount++;
        }

        if (filters.recipient_id) {
            query += ` AND m.recipient_id = $${paramCount}`;
            params.push(filters.recipient_id);
            paramCount++;
        }

        if (filters.sender_id) {
            query += ` AND m.sender_id = $${paramCount}`;
            params.push(filters.sender_id);
            paramCount++;
        }

        if (filters.message_type) {
            query += ` AND m.message_type = $${paramCount}`;
            params.push(filters.message_type);
            paramCount++;
        }

        if (filters.priority) {
            query += ` AND m.priority = $${paramCount}`;
            params.push(filters.priority);
            paramCount++;
        }

        if (filters.is_read !== undefined) {
            query += ` AND m.is_read = $${paramCount}`;
            params.push(filters.is_read);
            paramCount++;
        }

        if (filters.start_date) {
            query += ` AND m.created_at >= $${paramCount}`;
            params.push(filters.start_date);
            paramCount++;
        }

        if (filters.end_date) {
            query += ` AND m.created_at <= $${paramCount}::date + interval '1 day'`;
            params.push(filters.end_date);
            paramCount++;
        }

        if (userId) {
            query += ` AND (
                m.sender_id = $${paramCount} 
                OR m.recipient_id = $${paramCount}
                OR m.group_id IN (
                    SELECT group_id FROM group_members 
                    WHERE user_id = $${paramCount} AND is_active = true
                )
            )`;
            params.push(userId);
            paramCount++;
        }

        const countQuery = query.replace(
            `SELECT ${MESSAGE_SELECT}`,
            'SELECT COUNT(DISTINCT m.id) as total'
        );
        const { rows: countRows } = await pool.query(countQuery, params);
        const total = parseInt(countRows[0]?.total || '0');

        query += ` ORDER BY m.created_at DESC`;

        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }

        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
            paramCount++;
        }

        const { rows } = await pool.query(query, params);

        for (const message of rows) {
            const { rows: attachments } = await pool.query(
                `SELECT * FROM message_attachments WHERE message_id = $1`,
                [message.id]
            );
            message.attachments = attachments;

            const { rows: statuses } = await pool.query(
                `SELECT ms.*, u.full_name AS user_name
                 FROM message_status ms
                 LEFT JOIN users u ON u.id = ms.user_id
                 WHERE ms.message_id = $1`,
                [message.id]
            );
            message.statuses = statuses;
        }

        return { messages: rows, total };
    }

    // ─── NEW: Get bidirectional DM conversation between two users ────────────

    static async getConversation(
        currentUserId: string,
        otherUserId: string,
        limit = 50,
        offset = 0
    ): Promise<{ messages: Message[]; total: number }> {
        // Count total messages in this conversation
        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM messages m
             WHERE m.is_archived = false
               AND m.group_id IS NULL
               AND (
                 (m.sender_id = $1 AND m.recipient_id = $2)
                 OR
                 (m.sender_id = $2 AND m.recipient_id = $1)
               )`,
            [currentUserId, otherUserId]
        );
        const total = countRows[0]?.total ?? 0;

        // Fetch paginated messages ordered oldest → newest for chat layout
        const { rows } = await pool.query(
            `SELECT ${MESSAGE_SELECT}
             FROM messages m
             LEFT JOIN users s  ON s.id  = m.sender_id
             LEFT JOIN message_groups mg ON mg.id = m.group_id
             LEFT JOIN users r  ON r.id  = m.recipient_id
             WHERE m.is_archived = false
               AND m.group_id IS NULL
               AND (
                 (m.sender_id = $1 AND m.recipient_id = $2)
                 OR
                 (m.sender_id = $2 AND m.recipient_id = $1)
               )
             ORDER BY m.created_at ASC
             LIMIT $3 OFFSET $4`,
            [currentUserId, otherUserId, limit, offset]
        );

        // Hydrate attachments + statuses
        for (const message of rows) {
            const { rows: attachments } = await pool.query(
                `SELECT * FROM message_attachments WHERE message_id = $1`,
                [message.id]
            );
            message.attachments = attachments;

            const { rows: statuses } = await pool.query(
                `SELECT ms.*, u.full_name AS user_name
                 FROM message_status ms
                 LEFT JOIN users u ON u.id = ms.user_id
                 WHERE ms.message_id = $1`,
                [message.id]
            );
            message.statuses = statuses;
        }

        return { messages: rows, total };
    }

    // ─── Read / Archive ──────────────────────────────────────────────────────

    static async getUnreadCount(userId: string): Promise<UnreadCount> {
        const { rows: totalRows } = await pool.query(
            `SELECT COUNT(*)::int as total
             FROM message_status ms
             JOIN messages m ON m.id = ms.message_id
             WHERE ms.user_id = $1 
             AND ms.is_read = false 
             AND m.is_archived = false`,
            [userId]
        );

        const { rows: groupRows } = await pool.query(
            `SELECT mg.id as group_id, mg.name as group_name, COUNT(*)::int as count
             FROM message_status ms
             JOIN messages m ON m.id = ms.message_id
             JOIN message_groups mg ON mg.id = m.group_id
             WHERE ms.user_id = $1 
             AND ms.is_read = false 
             AND m.is_archived = false
             AND m.group_id IS NOT NULL
             GROUP BY mg.id, mg.name
             ORDER BY mg.name ASC`,
            [userId]
        );

        return {
            total: parseInt(totalRows[0]?.total || '0'),
            by_group: groupRows,
        };
    }

    static async markMessageAsRead(
        messageId: string,
        userId: string
    ): Promise<void> {
        await pool.query(
            `UPDATE message_status 
             SET is_read = true, read_at = NOW()
             WHERE message_id = $1 AND user_id = $2`,
            [messageId, userId]
        );

        const { rows } = await pool.query(
            `SELECT COUNT(*) as total, 
                    SUM(CASE WHEN is_read THEN 1 ELSE 0 END) as read_count
             FROM message_status
             WHERE message_id = $1`,
            [messageId]
        );

        if (rows[0].total > 0 && rows[0].total === rows[0].read_count) {
            await pool.query(
                `UPDATE messages SET is_read = true, read_at = NOW()
                 WHERE id = $1`,
                [messageId]
            );
        }
    }

    static async markAllRead(userId: string, groupId?: string): Promise<void> {
        let query = `
            UPDATE message_status 
            SET is_read = true, read_at = NOW()
            WHERE user_id = $1 AND is_read = false
        `;
        const params: unknown[] = [userId];

        if (groupId) {
            query += ` AND message_id IN (
                SELECT id FROM messages WHERE group_id = $2
            )`;
            params.push(groupId);
        }

        await pool.query(query, params);
    }

    static async archiveMessage(messageId: string, userId: string): Promise<void> {
        const message = await this.findMessageById(messageId);
        if (!message) {
            throw new AppError(404, 'Message not found');
        }

        const isAuthorized =
            message.sender_id    === userId ||
            message.recipient_id === userId ||
            (message.group_id && await this.isGroupMember(message.group_id, userId));

        if (!isAuthorized) {
            throw new AppError(403, 'You are not authorized to archive this message');
        }

        await pool.query(
            `UPDATE messages SET is_archived = true WHERE id = $1`,
            [messageId]
        );
    }

    static async isGroupMember(groupId: string, userId: string): Promise<boolean> {
        const { rows } = await pool.query(
            `SELECT id FROM group_members 
             WHERE group_id = $1 AND user_id = $2 AND is_active = true`,
            [groupId, userId]
        );
        return rows.length > 0;
    }

    // ─── Attachments ──────────────────────────────────────────────────────

    static async addAttachment(
        messageId: string,
        file: { filename: string; url: string; size?: number; mimeType?: string }
    ): Promise<MessageAttachment> {
        const { rows } = await pool.query(
            `INSERT INTO message_attachments (
                message_id, file_name, file_url, file_size_bytes, mime_type
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [messageId, file.filename, file.url, file.size || null, file.mimeType || null]
        );
        return rows[0];
    }

    static async removeAttachment(id: string): Promise<void> {
        await pool.query(
            `DELETE FROM message_attachments WHERE id = $1`,
            [id]
        );
    }
}