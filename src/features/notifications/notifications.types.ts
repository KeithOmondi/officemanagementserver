export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationChannel = 'email' | 'in_app' | 'push';
export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'delivered' | 'read';
export type EmailFrequency = 'instant' | 'daily' | 'weekly';

export interface NotificationType {
    id: string;
    name: string;
    description: string | null;
    default_icon: string | null;
    default_color: string | null;
    is_active: boolean;
    created_at: string;
}

export interface Notification {
    id: string;
    user_id: string;
    type_id: string | null;
    type_name: string;
    title: string;
    message: string;
    icon: string | null;
    color: string | null;
    link: string | null;
    is_read: boolean;
    read_at: string | null;
    is_email_sent: boolean;
    email_sent_at: string | null;
    priority: NotificationPriority;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

export interface NotificationPreferences {
    id: string;
    user_id: string;
    email_enabled: boolean;
    in_app_enabled: boolean;
    email_frequency: EmailFrequency;
    preferences: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface NotificationDeliveryLog {
    id: string;
    notification_id: string;
    channel: NotificationChannel;
    status: DeliveryStatus;
    error_message: string | null;
    delivered_at: string | null;
    created_at: string;
}

export interface NotificationStats {
    total: number;
    unread: number;
    read: number;
    by_priority: { priority: NotificationPriority; count: number }[];
    by_type: { type_name: string; count: number }[];
}

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface CreateNotificationInput {
    user_id: string;
    type_name: string;
    title: string;
    message: string;
    icon?: string;
    color?: string;
    link?: string;
    priority?: NotificationPriority;
    metadata?: Record<string, unknown>;
    send_email?: boolean;
}

export interface UpdateNotificationInput {
    is_read?: boolean;
}

export interface UpdatePreferencesInput {
    email_enabled?: boolean;
    in_app_enabled?: boolean;
    email_frequency?: EmailFrequency;
    preferences?: Record<string, unknown>;
}

export interface NotificationFilters {
    user_id?: string;
    type_name?: string;
    is_read?: boolean;
    priority?: NotificationPriority;
    search?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
}

// ─── Event Types for WebSocket ──────────────────────────────────────────────

export interface NotificationEvent {
    type: 'notification';
    data: Notification;
}

export interface NotificationCountEvent {
    type: 'unread_count';
    data: { count: number };
}