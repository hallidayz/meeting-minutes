import { invoke } from '@tauri-apps/api/core';

export type CalendarPermissionStatus =
  | 'granted'
  | 'denied'
  | 'not_determined'
  | 'restricted'
  | 'unsupported_platform';

export interface CalendarInfo {
  id: string;
  title: string;
  source?: string | null;
}

export interface CalendarEvent {
  id: string;
  calendar_id: string;
  title: string;
  start: number;
  end: number;
  location?: string | null;
  meeting_url?: string | null;
}

export interface CalendarSettings {
  integration_enabled: boolean;
  enabled_calendar_ids: string[];
  lookahead_hours: number;
}

export async function getCalendarIntegrationEnabled(): Promise<boolean> {
  return invoke<boolean>('calendar_get_integration_enabled');
}

export async function setCalendarIntegrationEnabled(enabled: boolean): Promise<void> {
  return invoke('calendar_set_integration_enabled', { enabled });
}

export async function getCalendarPermissionStatus(): Promise<CalendarPermissionStatus> {
  return invoke<CalendarPermissionStatus>('calendar_get_permission_status');
}

export async function requestCalendarPermission(): Promise<CalendarPermissionStatus> {
  return invoke<CalendarPermissionStatus>('calendar_request_permission');
}

export async function listCalendars(): Promise<CalendarInfo[]> {
  return invoke<CalendarInfo[]>('calendar_list_calendars');
}

export async function getUpcomingCalendarEvents(): Promise<CalendarEvent[]> {
  return invoke<CalendarEvent[]>('calendar_get_upcoming_events');
}

export async function getCalendarSettings(): Promise<CalendarSettings> {
  return invoke<CalendarSettings>('calendar_get_calendar_settings');
}

export async function setCalendarSettings(settings: CalendarSettings): Promise<void> {
  return invoke('calendar_set_calendar_settings', { settings });
}

export async function openSystemCalendarSettings(): Promise<void> {
  return invoke('calendar_open_system_calendar_settings');
}

/** Session storage keys used when starting a recording from a calendar event */
export const CALENDAR_EVENT_TITLE_KEY = 'calendarEventTitle';
export const CALENDAR_EVENT_ID_KEY = 'calendarEventId';

export function setCalendarRecordingContext(title: string, eventId?: string) {
  sessionStorage.setItem(CALENDAR_EVENT_TITLE_KEY, title);
  if (eventId) {
    sessionStorage.setItem(CALENDAR_EVENT_ID_KEY, eventId);
  }
  sessionStorage.setItem('autoStartRecording', 'true');
}

export function clearCalendarRecordingContext() {
  sessionStorage.removeItem(CALENDAR_EVENT_TITLE_KEY);
  sessionStorage.removeItem(CALENDAR_EVENT_ID_KEY);
}

export function readCalendarRecordingTitle(): string | null {
  return sessionStorage.getItem(CALENDAR_EVENT_TITLE_KEY);
}
