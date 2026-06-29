// src/features/messages/messages.validator.ts
import { z } from 'zod';

// ─── Groups ───────────────────────────────────────────────────────────────────

export const createGroupSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100).trim(),
        description: z.string().nullable().optional(),
        group_type: z.enum(['department', 'project', 'broadcast']),
        department_id: z.string().uuid().nullable().optional(),
        member_ids: z.array(z.string().uuid()).optional(),
    }).strict(),
});

export const updateGroupSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100).trim().optional(),
        description: z.string().nullable().optional(),
        is_active: z.boolean().optional(),
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided' }
    ),
});

export const addGroupMembersSchema = z.object({
    body: z.object({
        user_ids: z.array(z.string().uuid()).min(1),
        role: z.enum(['admin', 'member']).default('member'),
    }).strict(),
});

export const removeGroupMemberSchema = z.object({
    params: z.object({
        groupId: z.string().uuid('Group ID must be a valid UUID'),
        userId: z.string().uuid('User ID must be a valid UUID'),
    }),
});

// ─── Messages ──────────────────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
    body: z.object({
        content: z.string().min(1).max(10000),
        group_id: z.string().uuid().nullable().optional(),
        recipient_id: z.string().uuid().nullable().optional(),
        message_type: z.enum(['text', 'broadcast', 'announcement']).default('text'),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
        parent_message_id: z.string().uuid().nullable().optional(),
    }).strict().refine(
        (data) => data.group_id || data.recipient_id,
        { message: 'Either group_id or recipient_id must be provided' }
    ),
});

export const messageFiltersSchema = z.object({
    query: z.object({
        search: z.string().optional(),
        group_id: z.string().uuid().optional(),
        recipient_id: z.string().uuid().optional(),
        sender_id: z.string().uuid().optional(),
        message_type: z.enum(['text', 'broadcast', 'announcement']).optional(),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
        is_read: z.string().transform((val) => val === 'true').optional(),
        is_archived: z.string().transform((val) => val === 'true').optional(),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }).strict(),
});

export const messageIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Message ID must be a valid UUID'),
    }),
});

export const groupIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Group ID must be a valid UUID'),
    }),
});

// ─── NEW: Conversation params ─────────────────────────────────────────────────

export const conversationParamsSchema = z.object({
    params: z.object({
        userId: z.string().uuid('User ID must be a valid UUID'),
    }),
    query: z.object({
        limit: z.string().regex(/^\d+$/).default('50').transform(Number),
        offset: z.string().regex(/^\d+$/).default('0').transform(Number),
    }),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateGroupInput   = z.infer<typeof createGroupSchema>['body'];
export type UpdateGroupInput   = z.infer<typeof updateGroupSchema>['body'];
export type AddGroupMembersInput = z.infer<typeof addGroupMembersSchema>['body'];
export type SendMessageInput   = z.infer<typeof sendMessageSchema>['body'];
export type MessageFilters     = z.infer<typeof messageFiltersSchema>['query'];
export type ConversationParams = z.infer<typeof conversationParamsSchema>;