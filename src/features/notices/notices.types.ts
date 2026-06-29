// src/features/notices/notices.types.ts
export type AudienceType = 'All Staff' | 'Registry Staff Only' | 'Judicial Officers' | 'Administrative Staff';
export type DeliveryOption = 'In-App + Email' | 'In-App Only' | 'Email + SMS' | 'All Channels';
export type NoticeCategory = 'General Notice' | 'Court Vacation' | 'Administrative Circular' | 'Urgent Notice' | 'Staff Information';
export type BroadcastTag = { label: string; icon: 'users' | 'check' | 'urgent' };

export interface Broadcast {
    id: string;
    title: string;
    body: string;
    audience: AudienceType;
    delivery_method: DeliveryOption;
    is_urgent: boolean;
    is_sent: boolean;
    sent_at: string | null;
    created_by: string | null;
    created_by_name: string | null;
    created_at: string;
    updated_at: string;
    read_count?: number;
    total_recipients?: number;
    tag?: BroadcastTag;
}

export interface Notice {
    id: string;
    title: string;
    body: string;
    category: NoticeCategory;
    visibility: AudienceType;
    is_published: boolean;
    published_at: string | null;
    expires_at: string | null;
    created_by: string | null;
    created_by_name: string | null;
    created_at: string;
    updated_at: string;
    read_count?: number;
}

export interface BroadcastRead {
    id: string;
    broadcast_id: string;
    user_id: string;
    read_at: string;
}

export interface NoticeRead {
    id: string;
    notice_id: string;
    user_id: string;
    read_at: string;
}

export interface AuditEntry {
    id: string;
    actor: string | null;
    actor_name: string | null;
    action: string;
    detail: string | null;
    entity_type: string | null;
    entity_id: string | null;
    timestamp: string;
}

export interface NoticesStats {
    total_broadcasts: number;
    total_notices: number;
    unread_broadcasts: number;
    unread_notices: number;
    pending_broadcasts: number;
}

// Input types
export interface CreateBroadcastInput {
    title: string;
    body: string;
    audience: AudienceType;
    delivery_method?: DeliveryOption;
    is_urgent?: boolean;
}

export interface UpdateBroadcastInput {
    title?: string;
    body?: string;
    audience?: AudienceType;
    delivery_method?: DeliveryOption;
    is_urgent?: boolean;
    is_sent?: boolean;
}

export interface CreateNoticeInput {
    title: string;
    body: string;
    category: NoticeCategory;
    visibility?: AudienceType;
    expires_at?: string | null;  // Allow null
}

export interface UpdateNoticeInput {
    title?: string;
    body?: string;
    category?: NoticeCategory;
    visibility?: AudienceType;
    is_published?: boolean;
    expires_at?: string | null;  // Allow null
}

export interface NoticesFilters {
    search?: string;
    audience?: AudienceType;
    category?: NoticeCategory;
    is_sent?: boolean;
    is_published?: boolean;
    limit?: number;
    offset?: number;
}