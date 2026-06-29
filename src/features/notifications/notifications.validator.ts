// src/features/notifications/notifications.validator.ts
import { z } from 'zod';

const priorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);
const emailFrequencyEnum = z.enum(['instant', 'daily', 'weekly']);

// ─── Custom record type that accepts any object ──────────────────────────────
const recordSchema = z.object({}).catchall(z.unknown());

// ─── Create Notification ──────────────────────────────────────────────────────

export const createNotificationSchema = z.object({
    body: z.object({
        user_id: z.string().uuid('User ID must be a valid UUID'),
        type_name: z.string().min(1).max(50),
        title: z.string().min(1).max(255),
        message: z.string().min(1),
        icon: z.string().max(50).optional(),
        color: z.string().max(20).optional(),
        link: z.string().max(500).optional(),
        priority: priorityEnum.default('normal'),
        metadata: recordSchema.optional(),
        send_email: z.boolean().default(true),
    }).strict(),
});

// ─── Update Notification ──────────────────────────────────────────────────────

export const updateNotificationSchema = z.object({
    body: z.object({
        is_read: z.boolean().optional(),
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided' }
    ),
});

// ─── Update Preferences ──────────────────────────────────────────────────────

export const updatePreferencesSchema = z.object({
    body: z.object({
        email_enabled: z.boolean().optional(),
        in_app_enabled: z.boolean().optional(),
        email_frequency: emailFrequencyEnum.optional(),
        preferences: recordSchema.optional(),
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided' }
    ),
});

// ─── Bulk Update Notifications ──────────────────────────────────────────────

export const bulkUpdateNotificationsSchema = z.object({
    body: z.object({
        notification_ids: z.array(z.string().uuid()).min(1),
        is_read: z.boolean(),
    }).strict(),
});

// ─── Filters ──────────────────────────────────────────────────────────────────

export const notificationFiltersSchema = z.object({
    query: z.object({
        user_id: z.string().uuid().optional(),
        type_name: z.string().optional(),
        is_read: z.string().transform((val) => val === 'true').optional(),
        priority: priorityEnum.optional(),
        search: z.string().optional(),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }).strict(),
});

// ─── ID Schemas ──────────────────────────────────────────────────────────────

export const notificationIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Notification ID must be a valid UUID'),
    }),
});

export const userIdSchema = z.object({
    params: z.object({
        userId: z.string().uuid('User ID must be a valid UUID'),
    }),
});

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>['body'];
export type UpdateNotificationInput = z.infer<typeof updateNotificationSchema>['body'];
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>['body'];
export type NotificationFilters = z.infer<typeof notificationFiltersSchema>['query'];
export type BulkUpdateNotificationsInput = z.infer<typeof bulkUpdateNotificationsSchema>['body'];