// src/features/calendar/calendar.types.ts
export type EventType = 'hearing' | 'meeting' | 'deadline' | 'other';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_date: Date;
  start_time?: string;
  end_time?: string;
  location?: string;
  event_type: EventType;
  court_room?: string;
  case_reference?: string;
  judge_name?: string;
  google_event_id?: string;
  google_calendar_id?: string;
  notify_team: boolean;
  notification_sent: boolean;
  is_active: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
  synced_at?: Date;
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  event_date: string; // YYYY-MM-DD
  start_time?: string; // HH:MM:SS
  end_time?: string;
  location?: string;
  event_type: EventType;
  court_room?: string;
  case_reference?: string;
  judge_name?: string;
  notify_team?: boolean;
}

export interface CalendarEventUpdate {
  title?: string;
  description?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  event_type?: EventType;
  court_room?: string;
  case_reference?: string;
  judge_name?: string;
  notify_team?: boolean;
  is_active?: boolean;
}

export interface GoogleCalendarSettings {
  id: string;
  user_id: string;
  google_access_token?: string;
  google_refresh_token?: string;
  google_calendar_id: string;
  google_token_expiry?: Date;
  is_connected: boolean;
  sync_enabled: boolean;
  last_sync_at?: Date;
}

export interface CalendarFilters {
  start_date?: string;
  end_date?: string;
  event_type?: EventType;
  court_room?: string;
  judge_name?: string;
  page?: number;
  limit?: number;
  sort_by?: 'event_date' | 'created_at';
  sort_order?: 'ASC' | 'DESC';
}

export interface CalendarPaginationResponse {
  data: CalendarEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}