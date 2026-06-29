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

const ALLOWED_SORT = new Set(['event_date', 'created_at']);
const DEFAULT_LIMIT = 50;

export class CalendarService {

  // ── Create ────────────────────────────────────────────────────────────────────

  static async createEvent(
    input: CalendarEventInput,
    userId: string
  ): Promise<CalendarEvent> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO calendar_events
           (title, description, event_date, start_time, end_time, location,
            event_type, court_room, case_reference, judge_name, notify_team, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          input.title,
          input.description   ?? null,
          input.event_date,
          input.start_time    ?? null,
          input.end_time      ?? null,
          input.location      ?? null,
          input.event_type,
          input.court_room    ?? null,
          input.case_reference ?? null,
          input.judge_name    ?? null,
          input.notify_team   ?? false,
          userId,
        ]
      );

      const event = rows[0];

      // Sync to the creating user's Google Calendar (if connected)
      const settings = await googleCalendarService.getUserSettings(userId);
      if (settings?.is_connected && settings?.sync_enabled) {
        try {
          const googleResult = await googleCalendarService.createEvent(
            userId,
            event,
            settings.google_calendar_id || 'primary'
          );
          await client.query(
            `UPDATE calendar_events
             SET google_event_id = $1, google_calendar_id = $2, synced_at = $3
             WHERE id = $4`,
            [googleResult.googleEventId, googleResult.googleCalendarId, googleResult.syncedAt, event.id]
          );
          event.google_event_id     = googleResult.googleEventId;
          event.google_calendar_id  = googleResult.googleCalendarId;
          event.synced_at           = googleResult.syncedAt;
        } catch (err) {
          // Google sync failure must never block the local save
          console.error('[Calendar] Google sync on create failed:', err);
        }
      }

      await client.query('COMMIT');
      return this.format(event);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Find all (scoped to requesting user) ──────────────────────────────────────

  static async findAll(
    filters: CalendarFilters,
    userId: string
  ): Promise<CalendarPaginationResponse> {
    const {
      start_date, end_date, event_type, court_room, judge_name,
      page = 1, limit = DEFAULT_LIMIT,
      sort_by = 'event_date', sort_order = 'ASC',
    } = filters;

    const sortCol = ALLOWED_SORT.has(sort_by) ? sort_by : 'event_date';
    const sortDir = sort_order === 'DESC' ? 'DESC' : 'ASC';
    const offset  = (page - 1) * limit;

    // Always scope by the requesting user
    const conditions: string[] = ['is_active = true', 'created_by = $1'];
    const values: unknown[]    = [userId];
    let p = 2;

    if (start_date)  { conditions.push(`event_date >= $${p}`); values.push(start_date);          p++; }
    if (end_date)    { conditions.push(`event_date <= $${p}`); values.push(end_date);             p++; }
    if (event_type)  { conditions.push(`event_type = $${p}`);  values.push(event_type);           p++; }
    if (court_room)  { conditions.push(`court_room ILIKE $${p}`); values.push(`%${court_room}%`); p++; }
    if (judge_name)  { conditions.push(`judge_name ILIKE $${p}`); values.push(`%${judge_name}%`); p++; }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total FROM calendar_events ${where}`, values),
      pool.query(
        `SELECT * FROM calendar_events ${where}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT $${p} OFFSET $${p + 1}`,
        [...values, limit, offset]
      ),
    ]);

    const total = parseInt(countRes.rows[0]?.total ?? '0', 10);
    return {
      data:       dataRes.rows.map((r) => this.format(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Upcoming (scoped to requesting user) ──────────────────────────────────────

  static async getUpcomingEvents(userId: string, limit = 10): Promise<CalendarEvent[]> {
    const { rows } = await pool.query(
      `SELECT * FROM calendar_events
       WHERE is_active = true
         AND created_by = $1
         AND event_date >= CURRENT_DATE
       ORDER BY event_date ASC, start_time ASC
       LIMIT $2`,
      [userId, limit]
    );
    return rows.map((r) => this.format(r));
  }

  // ── Find by ID (owner-gated) ──────────────────────────────────────────────────

  static async findById(id: string, userId: string): Promise<CalendarEvent | null> {
    const { rows } = await pool.query(
      `SELECT * FROM calendar_events
       WHERE id = $1 AND is_active = true AND created_by = $2`,
      [id, userId]
    );
    return rows.length ? this.format(rows[0]) : null;
  }

  // ── Update (owner-gated) ──────────────────────────────────────────────────────

  static async updateEvent(
    id: string,
    input: CalendarEventUpdate,
    userId: string
  ): Promise<CalendarEvent> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await this.findById(id, userId);
      if (!existing) throw new AppError(404, 'Event not found');

      const updates: string[] = [];
      const values: unknown[] = [];
      let p = 1;

      const fields: (keyof CalendarEventUpdate)[] = [
        'title', 'description', 'event_date', 'start_time', 'end_time',
        'location', 'event_type', 'court_room', 'case_reference',
        'judge_name', 'notify_team', 'is_active',
      ];

      for (const field of fields) {
        if (input[field] !== undefined) {
          updates.push(`${field} = $${p}`);
          values.push(input[field]);
          p++;
        }
      }

      if (!updates.length) throw new AppError(400, 'No fields to update');

      values.push(id, userId);
      const { rows } = await client.query(
        `UPDATE calendar_events
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${p} AND created_by = $${p + 1}
         RETURNING *`,
        values
      );

      if (!rows.length) throw new AppError(404, 'Event not found or not yours to update');
      const updated = rows[0];

      // Sync update to Google Calendar if this event was previously synced
      if (updated.google_event_id) {
        const settings = await googleCalendarService.getUserSettings(userId);
        if (settings?.is_connected && settings?.sync_enabled) {
          try {
            await googleCalendarService.updateEvent(
              userId,
              updated.google_event_id,
              { ...existing, ...updated },
              updated.google_calendar_id || 'primary'
            );
            await client.query(
              `UPDATE calendar_events SET synced_at = NOW() WHERE id = $1`,
              [id]
            );
          } catch (err) {
            console.error('[Calendar] Google sync on update failed:', err);
          }
        }
      }

      await client.query('COMMIT');
      return this.format(updated);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Delete (owner-gated) ──────────────────────────────────────────────────────

  static async deleteEvent(id: string, userId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const event = await this.findById(id, userId);
      if (!event) throw new AppError(404, 'Event not found');

      // Remove from Google Calendar if synced
      if (event.google_event_id) {
        const settings = await googleCalendarService.getUserSettings(userId);
        if (settings?.is_connected) {
          try {
            await googleCalendarService.deleteEvent(
              userId,
              event.google_event_id,
              event.google_calendar_id || 'primary'
            );
          } catch (err) {
            console.error('[Calendar] Google delete failed:', err);
          }
        }
      }

      await client.query(
        `UPDATE calendar_events
         SET is_active = false, updated_at = NOW()
         WHERE id = $1 AND created_by = $2`,
        [id, userId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Google sync (scoped to requesting user) ───────────────────────────────────

  static async syncWithGoogle(userId: string): Promise<{ synced: number }> {
    const settings = await googleCalendarService.getUserSettings(userId);
    if (!settings?.is_connected || !settings?.sync_enabled) {
      throw new AppError(400, 'Google Calendar not connected or sync is disabled');
    }
    const events = await googleCalendarService.syncEventsFromGoogle(
      userId,
      settings.google_calendar_id || 'primary'
    );
    return { synced: events.length };
  }

  // ── Private: row formatter ────────────────────────────────────────────────────

  private static format(row: Record<string, unknown>): CalendarEvent {
    return {
      id:                  row.id                  as string,
      title:               row.title               as string,
      description:         row.description         as string | undefined,
      event_date:          row.event_date           as Date,
      start_time:          row.start_time           as string | undefined,
      end_time:            row.end_time             as string | undefined,
      location:            row.location             as string | undefined,
      event_type:          row.event_type           as CalendarEvent['event_type'],
      court_room:          row.court_room           as string | undefined,
      case_reference:      row.case_reference       as string | undefined,
      judge_name:          row.judge_name           as string | undefined,
      google_event_id:     row.google_event_id      as string | undefined,
      google_calendar_id:  row.google_calendar_id   as string | undefined,
      notify_team:         row.notify_team          as boolean,
      notification_sent:   row.notification_sent    as boolean,
      is_active:           row.is_active            as boolean,
      created_by:          row.created_by           as string,
      created_at:          row.created_at           as Date,
      updated_at:          row.updated_at           as Date,
      synced_at:           row.synced_at            as Date | undefined,
    };
  }
}