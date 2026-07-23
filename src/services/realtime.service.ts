// src/services/realtime.service.ts

import { Server as SocketServer } from 'socket.io';

type EntityType = 'document' | 'aide' | 'user' | 'message' | 'notification';

interface RealtimeEvent {
  entity: EntityType;
  action: 'created' | 'updated' | 'deleted' | 'status_changed';
  data: any;
  targetUserId?: string;
  targetRoom?: string;
}

export class RealtimeService {
  private io: SocketServer;

  constructor(io: SocketServer) {
    this.io = io;
  }

  /**
   * Emit an event to a specific user
   */
  emitToUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit an event to a specific room
   */
  emitToRoom(room: string, event: string, data: any): void {
    this.io.to(room).emit(event, data);
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcast(event: string, data: any): void {
    this.io.emit(event, data);
  }

  /**
   * Emit a document event
   */
  documentUpdated(document: any, userId?: string): void {
    if (userId) {
      this.emitToUser(userId, 'document_updated', document);
    }
    if (document.id) {
      this.emitToRoom(`document:${document.id}`, 'document_updated', document);
    }
    this.broadcast('document_updated', document);
  }

  documentCreated(document: any): void {
    this.broadcast('document_created', document);
  }

  documentDeleted(documentId: string): void {
    this.broadcast('document_deleted', documentId);
  }

  /**
   * Emit a mark event
   */
  markUpdated(markData: any, userId: string): void {
    this.emitToUser(userId, 'mark_updated', markData);
    if (markData.document_id) {
      this.emitToRoom(`document:${markData.document_id}`, 'mark_updated', markData);
    }
  }

  /**
   * Emit an aide event
   */
  aideUpdated(aide: any): void {
    this.broadcast('aide_updated', aide);
    if (aide.id) {
      this.emitToRoom(`aide:${aide.id}`, 'aide_updated', aide);
    }
  }

  aideCreated(aide: any): void {
    this.broadcast('aide_created', aide);
  }

  aideDeleted(aideId: string): void {
    this.broadcast('aide_deleted', aideId);
  }

  /**
   * Emit a notification
   */
  sendNotification(userId: string, notification: any): void {
    this.emitToUser(userId, 'notification', notification);
  }

  sendBroadcastNotification(notification: any): void {
    this.broadcast('broadcast_notification', notification);
  }

  /**
   * Emit user status
   */
  userStatusChanged(userId: string, status: 'online' | 'offline' | 'away'): void {
    this.broadcast('user_status', { userId, status });
  }

  /**
   * Emit new message
   */
  newMessage(message: any): void {
    if (message.group_id) {
      this.emitToRoom(`group:${message.group_id}`, 'new_message', message);
    } else if (message.recipient_id) {
      this.emitToUser(message.recipient_id, 'new_message', message);
      this.emitToUser(message.sender_id, 'new_message', message);
    }
  }

  /**
   * Emit typing indicator
   */
  typing(userId: string, userName: string, isTyping: boolean, targetId: string, isGroup: boolean = false): void {
    const data = { user_id: userId, user_name: userName, is_typing: isTyping };
    if (isGroup) {
      this.emitToRoom(`group:${targetId}`, 'typing', data);
    } else {
      this.emitToUser(targetId, 'typing', data);
    }
  }

  /**
   * Emit message read status
   */
  messageRead(messageId: string, userId: string, userName: string): void {
    this.broadcast('message_read', {
      message_id: messageId,
      user_id: userId,
      user_name: userName,
      read_at: new Date().toISOString(),
    });
  }
}

export default RealtimeService;