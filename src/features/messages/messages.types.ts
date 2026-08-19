// src/features/messages/messages.types.ts

export type MessageType = 'text' | 'broadcast' | 'announcement';
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';
export type GroupType = 'department' | 'project' | 'broadcast';
export type GroupRole = 'admin' | 'member';
export type MessageStatusType = 'sent' | 'delivered' | 'read';

export interface User {
    id: string;
    full_name: string;
    email: string;
    department_id: string | null;
    department_name?: string;
    role?: string;
    is_active?: boolean;
    online_status?: 'online' | 'offline' | 'away';
    last_seen?: string;
}

export interface MessageGroup {
    id: string;
    name: string;
    description: string | null;
    group_type: GroupType;
    department_id: string | null;
    department_name?: string;
    created_by: string;
    created_by_name?: string;
    member_count?: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface GroupMember {
    id: string;
    group_id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    role: GroupRole;
    joined_at: string;
    is_active: boolean;
}

export interface MessageAttachment {
    id: string;
    message_id: string;
    file_name: string;
    file_url: string;
    file_size_bytes: number | null;
    mime_type: string | null;
    created_at: string;
}

export interface MessageStatus {
    id: string;
    message_id: string;
    user_id: string;
    user_name?: string;
    status: MessageStatusType;
    read_at: string | null;
    delivered_at: string | null;
    sent_at: string;
}

export interface MessageEditHistory {
    id: string;
    message_id: string;
    old_content: string;
    new_content: string;
    edited_by: string;
    edited_by_name?: string;
    edited_at: string;
}

export interface Message {
    id: string;
    sender_id: string;
    sender_name?: string;
    sender_email?: string;
    group_id: string | null;
    group_name?: string;
    recipient_id: string | null;
    recipient_name?: string;
    content: string;
    message_type: MessageType;
    priority: MessagePriority;
    is_read: boolean;
    read_at: string | null;
    is_archived: boolean;
    parent_message_id: string | null;
    is_edited: boolean;
    edited_at: string | null;
    edit_history: MessageEditHistory[];
    attachments: MessageAttachment[];
    statuses: MessageStatus[];
    created_at: string;
    updated_at: string;
    deleted_for?: string[];  // Users who deleted this message (soft delete per user)
}

export interface CreateGroupInput {
    name: string;
    description?: string | null;
    group_type: GroupType;
    department_id?: string | null;
    member_ids?: string[];
}

export interface UpdateGroupInput {
    name?: string;
    description?: string | null;
    is_active?: boolean;
}

export interface AddGroupMembersInput {
    user_ids: string[];
    role?: GroupRole;
}

export interface SendMessageInput {
    content: string;
    group_id?: string | null;
    recipient_id?: string | null;
    message_type?: MessageType;
    priority?: MessagePriority;
    parent_message_id?: string | null;
    attachments?: File[];
}

export interface EditMessageInput {
    content: string;
}

export interface DeleteMessageInput {
    for_everyone?: boolean;  // If true, delete for everyone (admin only)
}

export interface MessageFilters {
    search?: string;
    group_id?: string;
    recipient_id?: string;
    sender_id?: string;
    message_type?: MessageType;
    priority?: MessagePriority;
    is_read?: boolean;
    is_archived?: boolean;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
}

export interface UnreadCount {
    total: number;
    by_group: { group_id: string; group_name: string; count: number }[];
    by_sender: { sender_id: string; sender_name: string; count: number }[];
}

export interface Conversation {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    last_message: Message | null;
    unread_count: number;
    last_message_at: string | null;
    online_status?: 'online' | 'offline' | 'away';
    last_seen?: string;
}

export interface ConversationGroup {
    id: string;
    group_id: string;
    group_name: string;
    last_message: Message | null;
    unread_count: number;
    last_message_at: string | null;
    member_count: number;
}

// WebSocket Events
export interface WSMessageEvent {
    type: 'message';
    data: Message;
}

export interface WSMessageEditedEvent {
    type: 'message_edited';
    data: {
        message_id: string;
        new_content: string;
        edited_at: string;
        edited_by: string;
        edited_by_name: string;
    };
}

export interface WSMessageDeletedEvent {
    type: 'message_deleted';
    data: {
        message_id: string;
        deleted_by: string;
        deleted_by_name: string;
        for_everyone: boolean;
    };
}

export interface WSReadReceiptEvent {
    type: 'read_receipt';
    data: { 
        message_id: string; 
        user_id: string; 
        user_name: string;
        read_at: string;
    };
}

export interface WSDeliveryReceiptEvent {
    type: 'delivery_receipt';
    data: { 
        message_id: string; 
        user_id: string; 
        delivered_at: string;
    };
}

export interface WSTypingEvent {
    type: 'typing';
    data: { 
        user_id: string; 
        user_name: string;
        group_id?: string; 
        recipient_id?: string; 
        is_typing: boolean;
    };
}

export interface WSGroupEvent {
    type: 'group_update';
    data: { 
        group_id: string; 
        action: 'member_added' | 'member_removed' | 'group_updated' | 'member_joined' | 'member_left';
        user_id?: string;
        user_name?: string;
    };
}

export interface WSOnlineStatusEvent {
    type: 'online_status';
    data: {
        user_id: string;
        status: 'online' | 'offline' | 'away';
        last_seen?: string;
    };
}

export interface WSUnreadUpdateEvent {
    type: 'unread_update';
    data: {
        user_id: string;
        total_unread: number;
    };
}