export interface Event {
  id: string;
  date: Date;
  description: string;
  length: number; // Number of days the event spans
  calendarId: number;
  color?: string;
  skipWeekends?: boolean;
}

export interface CalendarSettings {
  name: string;
  description: string;
  color: string;
  skip_weekends: boolean;
}

// API types
export interface Calendar extends CalendarSettings {
  id: number;
  created_at: string;
  updated_at: string;
}
export interface APIEvent {
  id: number;
  calendar_id: number;
  title: string;
  description: string;
  start_date: string;
  length: number;
  created_at: string;
  updated_at: string;
}

const API_BASE_URL = '/api';

// Helper function to convert API event to frontend event
export function apiEventToFrontendEvent(apiEvent: APIEvent, calendarSettings: CalendarSettings): Event {
  return {
    id: apiEvent.id.toString(),
    description: apiEvent.title,
    // start_date is in the format YYYY-MM-DD, convert it to a Date object at midnight on that date in the local timezone
    date: new Date(apiEvent.start_date + 'T00:00:00'),
    length: apiEvent.length,
    calendarId: apiEvent.calendar_id,
    color: calendarSettings.color,
    skipWeekends: calendarSettings.skip_weekends,
  };
}

// Helper function to convert frontend event to API event
export function frontendEventToApiEvent(event: Event, calendarId: number): Partial<APIEvent> {
  return {
    calendar_id: calendarId,
    title: event.description,
    description: event.description,
    // Format the date as YYYY-MM-DD
    start_date: event.date.toISOString().split('T')[0],
    length: event.length,
  };
}

export async function getCalendars(): Promise<Calendar[]> {
  const response = await fetch(`${API_BASE_URL}/calendars`);
  if (!response.ok) throw new Error('Failed to fetch calendars');
  return response.json();
}

export async function createCalendar(settings: CalendarSettings): Promise<Calendar> {
  const response = await fetch(`${API_BASE_URL}/calendars`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw new Error('Failed to create calendar');
  return response.json();
}

export async function updateCalendar(calendarId: number, settings: CalendarSettings): Promise<Calendar> {
  const response = await fetch(`${API_BASE_URL}/calendars/${calendarId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw new Error('Failed to update calendar');
  return response.json();
}

export async function getCalendarEvents(calendarId: number): Promise<APIEvent[]> {
  const response = await fetch(`${API_BASE_URL}/calendars/${calendarId}/events`);
  if (!response.ok) throw new Error('Failed to fetch events');
  return response.json();
}

export async function createEvent(calendarId: number, event: Omit<APIEvent, 'id' | 'calendar_id' | 'created_at' | 'updated_at'>): Promise<APIEvent> {
  const response = await fetch(`${API_BASE_URL}/calendars/${calendarId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error('Failed to create event');
  return response.json();
}

export async function updateEvent(eventId: number, event: Partial<APIEvent>): Promise<APIEvent> {
  const response = await fetch(`${API_BASE_URL}/calendars/events/${eventId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error('Failed to update event');
  return response.json();
}

export async function deleteEvent(eventId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/calendars/events/${eventId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete event');
}
