// src/utils/notifications.ts
import { NotificationsService } from '../features/notifications/notifications.service';
import type { CreateNotificationInput } from '../features/notifications/notifications.types';

export const notifyUser = async (
    userId: string,
    typeName: string,
    title: string,
    message: string,
    options?: {
        icon?: string;
        color?: string;
        link?: string;
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        metadata?: Record<string, unknown>;
        sendEmail?: boolean;
    },
    io?: any
) => {
    const input: CreateNotificationInput = {
        user_id: userId,
        type_name: typeName,
        title,
        message,
        icon: options?.icon,
        color: options?.color,
        link: options?.link,
        priority: options?.priority || 'normal',
        metadata: options?.metadata,
        send_email: options?.sendEmail !== false,
    };

    return NotificationsService.createNotification(input, io);
};

// ─── Convenience Functions ────────────────────────────────────────────────────

export const notifyDocumentMarked = (userId: string, documentTitle: string, department: string, io?: any) => {
    return notifyUser(
        userId,
        'document_marked',
        `Document Marked: ${documentTitle}`,
        `A document has been marked to ${department} for action.`,
        {
            icon: '📌',
            color: '#8b5cf6',
            metadata: { document_title: documentTitle, department },
        },
        io
    );
};

export const notifyMessageReceived = (userId: string, senderName: string, messagePreview: string, io?: any) => {
    return notifyUser(
        userId,
        'message_received',
        `New Message from ${senderName}`,
        messagePreview,
        {
            icon: '💬',
            color: '#3b82f6',
            metadata: { sender: senderName },
        },
        io
    );
};

export const notifyRequestApproved = (userId: string, itemName: string, io?: any) => {
    return notifyUser(
        userId,
        'request_approved',
        `Request Approved: ${itemName}`,
        `Your request for ${itemName} has been approved.`,
        {
            icon: '✅',
            color: '#10b981',
            priority: 'high',
            metadata: { item: itemName },
        },
        io
    );
};

export const notifyStockLow = (userId: string, itemName: string, quantity: number, threshold: number, io?: any) => {
    return notifyUser(
        userId,
        'stock_low',
        `⚠️ Low Stock Alert: ${itemName}`,
        `${itemName} is running low (${quantity} remaining, threshold: ${threshold}). Please restock soon.`,
        {
            icon: '⚠️',
            color: '#f59e0b',
            priority: 'urgent',
            metadata: { item: itemName, quantity, threshold },
        },
        io
    );
};