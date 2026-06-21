// src/features/calendar/calendar.service.ts
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import googleCalendarService from '../../services/googleCalendar.service';
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarEventUpdate,
  CalendarFilters,
  CalendarPaginationResponse,
} from './calendar.types';

const ALLOWED_SORT_FIELDS = new Set(['event_date', 'created_at']);
const DEFAULT_LIMIT = 100;

export class CalendarService {
  // ── Create Event ──
  static async createEvent(
    input: CalendarEventInput,
    userId: string
  ): Promise<CalendarEvent> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Insert event into database
      const { rows } = await client.query(
        `INSERT INTO calendar_events 
         (title, description, event_date, start_time, end_time, location, 
          event_type, court_room, case_reference, judge_name, notify_team, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          input.title,
          input.description || null,
          input.event_date,
          input.start_time || null,
          input.end_time || null,
          input.location || null,
          input.event_type,
          input.court_room || null,
          input.case_reference || null,
          input.judge_name || null,
          input.notify_team || false,
          userId,
        ]
      );

      const event = rows[0];

      // Sync with Google Calendar if user is connected
      const settings = await googleCalendarService.getUserSettings(userId);
      if (settings?.is_connected && settings?.sync_enabled) {
        try {
          const googleResult = await googleCalendarService.createEvent(
            userId,
            event,
            settings.google_calendar_id || 'primary'
          );

          // Update event with Google IDs
          await client.query(
            `UPDATE calendar_events 
             SET google_event_id = $1, google_calendar_id = $2, synced_at = $3
             WHERE id = $4`,
            [
              googleResult.googleEventId,
              googleResult.googleCalendarId,
              googleResult.syncedAt,
              event.id,
            ]
          );

          event.google_event_id = googleResult.googleEventId;
          event.google_calendar_id = googleResult.googleCalendarId;
          event.synced_at = googleResult.syncedAt;
        } catch (error) {
          console.error('Failed to sync with Google Calendar:', error);
          // Don't fail the operation if Google sync fails
        }
      }

      await client.query('COMMIT');
      return this.formatEvent(event);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ── Get All Events ──
  static async findAll(filters: CalendarFilters): Promise<CalendarPaginationResponse> {
    const {
      start_date,
      end_date,
      event_type,
      court_room,
      judge_name,
      page = 1,
      limit = DEFAULT_LIMIT,
      sort_by = 'event_date',
      sort_order = 'ASC',
    } = filters;

    const sortCol = ALLOWED_SORT_FIELDS.has(sort_by) ? sort_by : 'event_date';
    const sortDir = sort_order === 'DESC' ? 'DESC' : 'ASC';
    const offset = (page - 1) * limit;

    const conditions: string[] = ['is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (start_date) {
      conditions.push(`event_date >= $${p}`);
      values.push(start_date);
      p++;
    }
    if (end_date) {
      conditions.push(`event_date <= $${p}`);
      values.push(end_date);
      p++;
    }
    if (event_type) {
      conditions.push(`event_type = $${p}`);
      values.push(event_type);
      p++;
    }
    if (court_room) {
      conditions.push(`court_room ILIKE $${p}`);
      values.push(`%${court_room}%`);
      p++;
    }
    if (judge_name) {
      conditions.push(`judge_name ILIKE $${p}`);
      values.push(`%${judge_name}%`);
      p++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total FROM calendar_events ${where}`, values),
      pool.query(
        `SELECT * FROM calendar_events ${where}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT $${p} OFFSET $${p + 1}`,
        [...values, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    return {
      data: dataResult.rows.map((row) => this.formatEvent(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Get Upcoming Events ──
  static async getUpcomingEvents(limit: number = 10): Promise<CalendarEvent[]> {
    const { rows } = await pool.query(
      `SELECT * FROM calendar_events 
       WHERE is_active = true AND event_date >= CURRENT_DATE
       ORDER BY event_date ASC, start_time ASC
       LIMIT $1`,
      [limit]
    );

    return rows.map((row) => this.formatEvent(row));
  }

  // ── Get Event By ID ──
  static async findById(id: string): Promise<CalendarEvent | null> {
    const { rows } = await pool.query(
      `SELECT * FROM calendar_events WHERE id = $1 AND is_active = true`,
      [id]
    );
    return rows.length ? this.formatEvent(rows[0]) : null;
  }

  // ── Update Event ──
  static async updateEvent(
    id: string,
    input: CalendarEventUpdate,
    userId: string
  ): Promise<CalendarEvent> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get existing event
      const existing = await this.findById(id);
      if (!existing) {
        throw new AppError(404, 'Event not found');
      }

      // Build update query
      const updates: string[] = [];
      const values: unknown[] = [];
      let p = 1;

      if (input.title !== undefined) {
        updates.push(`title = $${p}`);
        values.push(input.title);
        p++;
      }
      if (input.description !== undefined) {
        updates.push(`description = $${p}`);
        values.push(input.description);
        p++;
      }
      if (input.event_date !== undefined) {
        updates.push(`event_date = $${p}`);
        values.push(input.event_date);
        p++;
      }
      if (input.start_time !== undefined) {
        updates.push(`start_time = $${p}`);
        values.push(input.start_time);
        p++;
      }
      if (input.end_time !== undefined) {
        updates.push(`end_time = $${p}`);
        values.push(input.end_time);
        p++;
      }
      if (input.location !== undefined) {
        updates.push(`location = $${p}`);
        values.push(input.location);
        p++;
      }
      if (input.event_type !== undefined) {
        updates.push(`event_type = $${p}`);
        values.push(input.event_type);
        p++;
      }
      if (input.court_room !== undefined) {
        updates.push(`court_room = $${p}`);
        values.push(input.court_room);
        p++;
      }
      if (input.case_reference !== undefined) {
        updates.push(`case_reference = $${p}`);
        values.push(input.case_reference);
        p++;
      }
      if (input.judge_name !== undefined) {
        updates.push(`judge_name = $${p}`);
        values.push(input.judge_name);
        p++;
      }
      if (input.notify_team !== undefined) {
        updates.push(`notify_team = $${p}`);
        values.push(input.notify_team);
        p++;
      }
      if (input.is_active !== undefined) {
        updates.push(`is_active = $${p}`);
        values.push(input.is_active);
        p++;
      }

      if (updates.length === 0) {
        throw new AppError(400, 'No fields to update');
      }

      values.push(id);
      const query = `
        UPDATE calendar_events 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${p}
        RETURNING *
      `;

      const { rows } = await client.query(query, values);
      const updatedEvent = rows[0];

      // Sync with Google Calendar if event has a Google ID
      if (updatedEvent.google_event_id) {
        const settings = await googleCalendarService.getUserSettings(userId);
        if (settings?.is_connected && settings?.sync_enabled) {
          try {
            const mergedEvent = { ...existing, ...updatedEvent };
            await googleCalendarService.updateEvent(
              userId,
              updatedEvent.google_event_id,
              mergedEvent,
              updatedEvent.google_calendar_id || 'primary'
            );

            await client.query(
              `UPDATE calendar_events SET synced_at = NOW() WHERE id = $1`,
              [id]
            );
          } catch (error) {
            console.error('Failed to sync update with Google Calendar:', error);
          }
        }
      }

      await client.query('COMMIT');
      return this.formatEvent(rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ── Delete Event ──
  static async deleteEvent(id: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const event = await this.findById(id);
      if (!event) {
        throw new AppError(404, 'Event not found');
      }

      // Delete from Google Calendar if exists
      if (event.google_event_id) {
        const settings = await googleCalendarService.getUserSettings(userId);
        if (settings?.is_connected) {
          try {
            await googleCalendarService.deleteEvent(
              userId,
              event.google_event_id,
              event.google_calendar_id || 'primary'
            );
          } catch (error) {
            console.error('Failed to delete from Google Calendar:', error);
          }
        }
      }

      // Soft delete from database
      await client.query(
        `UPDATE calendar_events SET is_active = false, updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ── Sync All Events with Google ──
  static async syncWithGoogle(userId: string): Promise<{ synced: number }> {
    const settings = await googleCalendarService.getUserSettings(userId);
    if (!settings?.is_connected || !settings?.sync_enabled) {
      throw new AppError(400, 'Google Calendar not connected or sync disabled');
    }

    const events = await googleCalendarService.syncEventsFromGoogle(
      userId,
      settings.google_calendar_id || 'primary'
    );

    return { synced: events.length };
  }

  // ── Format Event ──
  private static formatEvent(row: any): CalendarEvent {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      event_date: row.event_date,
      start_time: row.start_time,
      end_time: row.end_time,
      location: row.location,
      event_type: row.event_type,
      court_room: row.court_room,
      case_reference: row.case_reference,
      judge_name: row.judge_name,
      google_event_id: row.google_event_id,
      google_calendar_id: row.google_calendar_id,
      notify_team: row.notify_team,
      notification_sent: row.notification_sent,
      is_active: row.is_active,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      synced_at: row.synced_at,
    };
  }
}