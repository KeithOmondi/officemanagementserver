import { Server as SocketServer, Socket } from 'socket.io';
import { Server } from 'http';
import { pool } from '../config/db';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SocketUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department_id: string | null;
}

interface SendMessageData {
  content: string;
  group_id?: string;
  recipient_id?: string;
  message_type?: 'text' | 'broadcast' | 'announcement';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  parent_message_id?: string;
}

interface TypingData {
  group_id?: string;
  recipient_id?: string;
  is_typing: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function saveMessage(data: SendMessageData, userId: string) {
  const { rows } = await pool.query(
    `INSERT INTO messages (
      sender_id, group_id, recipient_id, content, 
      message_type, priority, parent_message_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,
    [
      userId,
      data.group_id || null,
      data.recipient_id || null,
      data.content,
      data.message_type || 'text',
      data.priority || 'normal',
      data.parent_message_id || null,
    ]
  );

  const messageId = rows[0].id;

  // Get full message with sender info
  const { rows: messageRows } = await pool.query(
    `SELECT m.id, m.sender_id, s.full_name AS sender_name, s.email AS sender_email,
            m.group_id, mg.name AS group_name,
            m.recipient_id, r.full_name AS recipient_name,
            m.content, m.message_type, m.priority,
            m.is_read, m.read_at, m.is_archived, m.parent_message_id,
            m.created_at, m.updated_at
     FROM messages m
     LEFT JOIN users s ON s.id = m.sender_id
     LEFT JOIN message_groups mg ON mg.id = m.group_id
     LEFT JOIN users r ON r.id = m.recipient_id
     WHERE m.id = $1`,
    [messageId]
  );

  const message = messageRows[0];

  // Create message status entries
  if (data.group_id) {
    // Group message - status for all members
    const { rows: members } = await pool.query(
      `SELECT user_id FROM group_members 
       WHERE group_id = $1 AND is_active = true`,
      [data.group_id]
    );

    for (const member of members) {
      await pool.query(
        `INSERT INTO message_status (message_id, user_id, delivered_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (message_id, user_id) DO NOTHING`,
        [messageId, member.user_id]
      );
    }
  } else if (data.recipient_id) {
    // Direct message - status for recipient
    await pool.query(
      `INSERT INTO message_status (message_id, user_id, delivered_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      [messageId, data.recipient_id]
    );
  }

  return message;
}

async function getMessage(messageId: string) {
  const { rows } = await pool.query(
    `SELECT m.id, m.sender_id, s.full_name AS sender_name,
            m.group_id, mg.name AS group_name,
            m.recipient_id, r.full_name AS recipient_name,
            m.content, m.message_type, m.priority,
            m.is_read, m.read_at, m.created_at
     FROM messages m
     LEFT JOIN users s ON s.id = m.sender_id
     LEFT JOIN message_groups mg ON mg.id = m.group_id
     LEFT JOIN users r ON r.id = m.recipient_id
     WHERE m.id = $1`,
    [messageId]
  );
  return rows[0] || null;
}

async function markMessageAsRead(messageId: string, userId: string) {
  await pool.query(
    `UPDATE message_status 
     SET is_read = true, read_at = NOW()
     WHERE message_id = $1 AND user_id = $2`,
    [messageId, userId]
  );

  // Check if all recipients have read the message
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

// ─── Verify Token ────────────────────────────────────────────────────────────

function verifyToken(token: string): SocketUser {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      full_name: decoded.full_name,
      role: decoded.role,
      department_id: decoded.department_id || null,
    };
  } catch (err) {
    throw new Error('Invalid token');
  }
}

// ─── Setup WebSocket ─────────────────────────────────────────────────────────

export function setupWebSocket(server: Server) {
  const io = new SocketServer(server, {
    cors: {
      origin: env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
  });

  // ── Authentication Middleware ──────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const user = verifyToken(token);
      socket.data.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection Handler ──────────────────────────────────────────────────────
  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    console.log(`🔌 User connected: ${user.full_name} (${user.id})`);

    // Join user's personal room for direct messages
    socket.join(`user:${user.id}`);

    // ✅ Fix: Batch join rooms instantly to resolve asynchronous closure allocation leaks
    try {
      const { rows } = await pool.query(
        `SELECT group_id FROM group_members 
         WHERE user_id = $1 AND is_active = true`,
        [user.id]
      );

      if (rows.length > 0) {
        const targetRooms = rows.map((row) => `group:${row.group_id}`);
        await socket.join(targetRooms);
        console.log(`📨 ${user.full_name} batch-joined ${rows.length} group rooms`);
      }
    } catch (err) {
      console.error('Error joining group rooms:', err);
    }

    // ── Send Message ────────────────────────────────────────────────────────
    socket.on('send_message', async (data: SendMessageData, callback) => {
      try {
        if (!data.content) {
          return callback({ success: false, error: 'Message content is required' });
        }

        const message = await saveMessage(data, user.id);

        // Emit to recipients
        if (message.group_id) {
          io.to(`group:${message.group_id}`).emit('new_message', message);
        } else if (message.recipient_id) {
          io.to(`user:${message.recipient_id}`).emit('new_message', message);
          socket.emit('new_message', message);
        }

        callback({ success: true, message });
      } catch (err: any) {
        console.error('Error sending message:', err);
        callback({ success: false, error: err.message || 'Failed to send message' });
      }
    });

    // ── Typing Indicator ────────────────────────────────────────────────────
    socket.on('typing', (data: TypingData) => {
      if (data.group_id) {
        socket.to(`group:${data.group_id}`).emit('typing', {
          user_id: user.id,
          user_name: user.full_name,
          is_typing: data.is_typing,
        });
      } else if (data.recipient_id) {
        io.to(`user:${data.recipient_id}`).emit('typing', {
          user_id: user.id,
          user_name: user.full_name,
          is_typing: data.is_typing,
        });
      }
    });

    // ── Mark Message as Read ────────────────────────────────────────────────
    socket.on('mark_read', async ({ message_id }: { message_id: string }) => {
      try {
        await markMessageAsRead(message_id, user.id);
        
        const message = await getMessage(message_id);
        if (message && message.sender_id) {
          io.to(`user:${message.sender_id}`).emit('message_read', {
            message_id,
            user_id: user.id,
            user_name: user.full_name,
            read_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Error marking message as read:', err);
      }
    });

    // ── Get Unread Count ────────────────────────────────────────────────────
    socket.on('get_unread_count', async (callback) => {
      try {
        const { rows } = await pool.query(
          `SELECT COUNT(*)::int as total
           FROM message_status ms
           JOIN messages m ON m.id = ms.message_id
           WHERE ms.user_id = $1 
           AND ms.is_read = false 
           AND m.is_archived = false`,
          [user.id]
        );

        callback({ success: true, unread: rows[0]?.total || 0 });
      } catch (err) {
        callback({ success: false, error: 'Failed to get unread count' });
      }
    });

    // ── Disconnect ──────────────────────────────────────────────────────────
    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`🔌 User disconnected: ${user.full_name} (${user.id}) | Reason: ${reason}`);
      
      // ✅ Clean up active rooms safely using public API
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.leave(room);
        }
      }
      
      // ✅ Force-remove event tracking maps to eliminate memory leaks
      socket.removeAllListeners();
    });

    // ── Error Handler ──────────────────────────────────────────────────────
    socket.on('error', (error) => {
      console.error(`Socket error for ${user.full_name}:`, error);
      socket.disconnect(true);
    });
  });

  return io;
}