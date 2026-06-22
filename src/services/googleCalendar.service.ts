// src/services/googleCalendar.service.ts
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../config/db';
import { AppError } from '../utils/response';
import { env } from '../config/env';
import type { CalendarEvent, GoogleCalendarSettings } from '../features/calendar/calendar.types';

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

    if (!this.isConfigured) {
      console.warn('⚠️ Google Calendar API credentials not configured.');
      console.warn('   Google Calendar integration will be disabled.');
      this.oauth2Client = new OAuth2Client('', '', '');
      return;
    }

    const redirectUri = env.GOOGLE_REDIRECT_URI;
    console.log('🔗 OAuth redirect URI:', redirectUri);

    this.oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID!,
      env.GOOGLE_CLIENT_SECRET!,
      redirectUri
    ) as unknown as OAuth2Client;
  }

  // ── Check if configured ──────────────────────────────────────────────────────

  isCalendarConfigured(): boolean {
    return this.isConfigured;
  }

  // ── Get OAuth URL — encodes userId in state param ────────────────────────────

  getAuthUrl(userId: string): string {
    if (!this.isConfigured) {
      throw new AppError(503, 'Google Calendar integration is not configured');
    }

    const state = Buffer.from(userId).toString('base64');

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      prompt: 'consent',
      state, // carry userId through the OAuth redirect
    });
  }

  // ── Decode userId from state param ───────────────────────────────────────────

  decodeState(state: string): string {
    try {
      return Buffer.from(state, 'base64').toString('utf8');
    } catch {
      throw new AppError(400, 'Invalid state parameter');
    }
  }

  // ── Exchange code for tokens ─────────────────────────────────────────────────

  async getTokens(code: string): Promise<{ access_token: string; refresh_token: string; expiry_date: number }> {
    if (!this.isConfigured) {
      throw new AppError(503, 'Google Calendar integration is not configured');
    }

    const { tokens } = await this.oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new AppError(400, 'Failed to get access tokens from Google');
    }

    return {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date:   tokens.expiry_date || Date.now() + 3600000,
    };
  }

  // ── Set credentials for a user ───────────────────────────────────────────────

  async setCredentials(userId: string): Promise<void> {
    if (!this.isConfigured) {
      throw new AppError(503, 'Google Calendar integration is not configured');
    }

    const settings = await this.getUserSettings(userId);
    if (!settings || !settings.google_access_token || !settings.google_refresh_token) {
      throw new AppError(401, 'Google Calendar not connected for this user');
    }

    this.oauth2Client.setCredentials({
      access_token:  settings.google_access_token,
      refresh_token: settings.google_refresh_token,
      expiry_date:   settings.google_token_expiry?.getTime(),
    });

    const credentials = this.oauth2Client.credentials;
    if (credentials.expiry_date) {
      const now    = Date.now();
      const expiry = new Date(credentials.expiry_date).getTime();
      if (expiry - now < 5 * 60 * 1000) {
        await this.refreshAccessToken(userId);
      }
    }
  }

  // ── Refresh access token ─────────────────────────────────────────────────────

  async refreshAccessToken(userId: string): Promise<void> {
    if (!this.isConfigured) {
      throw new AppError(503, 'Google Calendar integration is not configured');
    }

    const settings = await this.getUserSettings(userId);
    if (!settings || !settings.google_refresh_token) {
      throw new AppError(401, 'No refresh token available');
    }

    this.oauth2Client.setCredentials({ refresh_token: settings.google_refresh_token });

    const { credentials } = await this.oauth2Client.refreshAccessToken();

    await pool.query(
      `UPDATE user_calendar_settings
       SET google_access_token = $1, google_token_expiry = $2, updated_at = NOW()
       WHERE user_id = $3`,
      [
        credentials.access_token,
        credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        userId,
      ]
    );
  }

  // ── Get user settings ────────────────────────────────────────────────────────

  async getUserSettings(userId: string): Promise<GoogleCalendarSettings | null> {
    const { rows } = await pool.query(
      `SELECT * FROM user_calendar_settings WHERE user_id = $1`,
      [userId]
    );
    return rows[0] || null;
  }

  // ── Save / update user settings ──────────────────────────────────────────────

  async saveUserSettings(
    userId: string,
    data: { access_token: string; refresh_token: string; expiry_date: number }
  ): Promise<void> {
     await pool.query(
  `INSERT INTO user_calendar_settings
     (user_id, google_access_token, google_refresh_token, google_token_expiry, is_connected, sync_enabled)
   VALUES ($1, $2, $3, $4, true, true)
   ON CONFLICT (user_id)
   DO UPDATE SET
     google_access_token  = $2,
     google_refresh_token = $3,
     google_token_expiry  = $4,
     is_connected         = true,
     sync_enabled         = true,
     updated_at           = NOW()`,
  [userId, data.access_token, data.refresh_token, new Date(data.expiry_date)]
);
  }

  // ── Disconnect ───────────────────────────────────────────────────────────────

  async disconnect(userId: string): Promise<void> {
    await pool.query(
      `UPDATE user_calendar_settings
       SET is_connected = false, sync_enabled = false, updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
  }

  // ── Calendar instance ────────────────────────────────────────────────────────

  private getCalendar() {
    if (!this.isConfigured) {
      throw new AppError(503, 'Google Calendar integration is not configured');
    }
    return google.calendar({ version: 'v3', auth: this.oauth2Client as any });
  }

  // ── Create event ─────────────────────────────────────────────────────────────

  async createEvent(
    userId: string,
    eventData: CalendarEvent,
    calendarId: string = 'primary'
  ): Promise<{ googleEventId: string; googleCalendarId: string; syncedAt: Date }> {
    await this.setCredentials(userId);
    const calendar = this.getCalendar();

    const startDateTime = eventData.start_time
      ? new Date(`${eventData.event_date}T${eventData.start_time}`)
      : new Date(eventData.event_date);

    const endDateTime = eventData.end_time
      ? new Date(`${eventData.event_date}T${eventData.end_time}`)
      : new Date(new Date(startDateTime).setHours(startDateTime.getHours() + 1));

    const event: calendar_v3.Schema$Event = {
      summary:     eventData.title,
      description: this.formatDescription(eventData),
      location:    eventData.location || undefined,
      start: { dateTime: startDateTime.toISOString(), timeZone: 'Africa/Nairobi' },
      end:   { dateTime: endDateTime.toISOString(),   timeZone: 'Africa/Nairobi' },
      colorId: this.getEventColor(eventData.event_type),
      reminders: {
        useDefault: false,
        overrides: eventData.notify_team
          ? [{ method: 'email', minutes: 24 * 60 }, { method: 'popup', minutes: 30 }]
          : undefined,
      },
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
      sendNotifications: eventData.notify_team,
    });

    return {
      googleEventId:    response.data.id!,
      googleCalendarId: calendarId,
      syncedAt:         new Date(),
    };
  }

  // ── Update event ─────────────────────────────────────────────────────────────

  async updateEvent(
    userId: string,
    googleEventId: string,
    eventData: CalendarEvent,
    calendarId: string = 'primary'
  ): Promise<{ syncedAt: Date }> {
    await this.setCredentials(userId);
    const calendar = this.getCalendar();

    const startDateTime = eventData.start_time
      ? new Date(`${eventData.event_date}T${eventData.start_time}`)
      : new Date(eventData.event_date);

    const endDateTime = eventData.end_time
      ? new Date(`${eventData.event_date}T${eventData.end_time}`)
      : new Date(new Date(startDateTime).setHours(startDateTime.getHours() + 1));

    const event: calendar_v3.Schema$Event = {
      summary:     eventData.title,
      description: this.formatDescription(eventData),
      location:    eventData.location || undefined,
      start: { dateTime: startDateTime.toISOString(), timeZone: 'Africa/Nairobi' },
      end:   { dateTime: endDateTime.toISOString(),   timeZone: 'Africa/Nairobi' },
      colorId: this.getEventColor(eventData.event_type),
    };

    await calendar.events.update({
      calendarId,
      eventId:      googleEventId,
      requestBody:  event,
      sendNotifications: eventData.notify_team,
    });

    return { syncedAt: new Date() };
  }

  // ── Delete event ─────────────────────────────────────────────────────────────

  async deleteEvent(
    userId: string,
    googleEventId: string,
    calendarId: string = 'primary'
  ): Promise<void> {
    await this.setCredentials(userId);
    const calendar = this.getCalendar();

    await calendar.events.delete({
      calendarId,
      eventId:           googleEventId,
      sendNotifications: false,
    });
  }

  // ── Sync from Google ─────────────────────────────────────────────────────────

  async syncEventsFromGoogle(
  userId: string,
  calendarId: string = 'primary',
  timeMin?: Date,
  timeMax?: Date
): Promise<CalendarEvent[]> {
  try {
    await this.setCredentials(userId);
    console.log('✅ Credentials set for user:', userId);
  } catch (err: any) {
    console.error('❌ setCredentials failed:', err.message);
    throw err;
  }

  const calendar = this.getCalendar();

  let response;
  try {
    response = await calendar.events.list({
      calendarId,
      timeMin:      timeMin?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      timeMax:      timeMax?.toISOString() || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: true,
      orderBy:      'startTime',
    });
    console.log('✅ Google events fetched:', response.data.items?.length ?? 0);
  } catch (err: any) {
    console.error('❌ Google API call failed:', err.message);
    console.error('   Response:', JSON.stringify(err.response?.data, null, 2));
    throw err;
  }

  const events = response.data.items || [];
  const syncedEvents: CalendarEvent[] = [];

  for (const googleEvent of events) {
    if (!googleEvent.id || !googleEvent.summary) continue;

    try {
      const { rows } = await pool.query(
        `SELECT id FROM calendar_events WHERE google_event_id = $1`,
        [googleEvent.id]
      );

      const eventData = this.parseGoogleEvent(googleEvent);

      if (rows.length > 0) {
        await pool.query(
          `UPDATE calendar_events
           SET title = $1, description = $2, event_date = $3, start_time = $4,
               end_time = $5, location = $6, event_type = $7, court_room = $8,
               case_reference = $9, judge_name = $10, synced_at = NOW()
           WHERE google_event_id = $11`,
          [
            eventData.title, eventData.description || null, eventData.event_date,
            eventData.start_time || null, eventData.end_time || null,
            eventData.location || null, eventData.event_type,
            eventData.court_room || null, eventData.case_reference || null,
            eventData.judge_name || null, googleEvent.id,
          ]
        );
      } else {
        await pool.query(
          `INSERT INTO calendar_events
             (title, description, event_date, start_time, end_time, location,
              event_type, court_room, case_reference, judge_name, google_event_id,
              google_calendar_id, synced_at, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13)`,
          [
            eventData.title, eventData.description || null, eventData.event_date,
            eventData.start_time || null, eventData.end_time || null,
            eventData.location || null, eventData.event_type,
            eventData.court_room || null, eventData.case_reference || null,
            eventData.judge_name || null, googleEvent.id, calendarId, userId,
          ]
        );
      }

      syncedEvents.push(eventData);
    } catch (err: any) {
      console.error('❌ DB insert/update failed for event:', googleEvent.id, err.message);
      throw err;
    }
  }

  await pool.query(
    `UPDATE user_calendar_settings SET last_sync_at = NOW(), updated_at = NOW() WHERE user_id = $1`,
    [userId]
  );

  console.log('✅ Sync complete. Total synced:', syncedEvents.length);
  return syncedEvents;
}

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private formatDescription(event: CalendarEvent): string {
    let desc = '';
    if (event.description)    desc += `${event.description}\n\n`;
    if (event.case_reference) desc += `Case: ${event.case_reference}\n`;
    if (event.court_room)     desc += `Courtroom: ${event.court_room}\n`;
    if (event.judge_name)     desc += `Judge: ${event.judge_name}\n`;
    if (event.event_type)     desc += `Type: ${event.event_type}\n`;
    desc += `Created: ${new Date().toLocaleString()}`;
    return desc.trim();
  }

  private getEventColor(eventType: string): string {
    const colors: Record<string, string> = {
      hearing:  '2',
      meeting:  '5',
      deadline: '11',
      other:    '1',
    };
    return colors[eventType] || '1';
  }

  private parseGoogleEvent(googleEvent: calendar_v3.Schema$Event): CalendarEvent {
    const start = googleEvent.start?.dateTime || googleEvent.start?.date;
    const end   = googleEvent.end?.dateTime   || googleEvent.end?.date;

    const startDate = start ? new Date(start) : new Date();
    const endDate   = end   ? new Date(end)   : new Date();

    const description  = googleEvent.description || '';
    const caseMatch    = description.match(/Case:\s*(.+)/);
    const courtMatch   = description.match(/Courtroom:\s*(.+)/);
    const judgeMatch   = description.match(/Judge:\s*(.+)/);
    const typeMatch    = description.match(/Type:\s*(.+)/);

    return {
      id:               googleEvent.id!,
      title:            googleEvent.summary!,
      description:      description.split('\n\n')[0] || description,
      event_date:       startDate,
      start_time:       startDate.toTimeString().split(' ')[0],
      end_time:         endDate.toTimeString().split(' ')[0],
      location:         googleEvent.location || undefined,
      event_type:       (typeMatch?.[1]?.toLowerCase() || 'other') as any,
      court_room:       courtMatch?.[1]  || undefined,
      case_reference:   caseMatch?.[1]   || undefined,
      judge_name:       judgeMatch?.[1]  || undefined,
      google_event_id:  googleEvent.id   || undefined,
      notify_team:      false,
      notification_sent: false,
      is_active:        true,
      created_at:       new Date(),
      updated_at:       new Date(),
      synced_at:        new Date(),
    };
  }
}

export default new GoogleCalendarService();