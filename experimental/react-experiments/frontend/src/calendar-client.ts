export interface Event {
  id: string;
  date: Date;
  description: string;
  length: number; // Number of days the event spans
}

// API types
export interface Calendar {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface APIEvent {
  id: number;
  calendar_id: number;
  title: string;
  description: string;
  start_time: string;
  length: number;
  created_at: string;
  updated_at: string;
}

const API_BASE_URL = '/api';

// Helper function to convert API event to frontend event
export function apiEventToFrontendEvent(apiEvent: APIEvent): Event {
  return {
    id: apiEvent.id.toString(),
    description: apiEvent.title,
    date: new Date(apiEvent.start_time),
    length: apiEvent.length,
  };
}

// Helper function to convert frontend event to API event
export function frontendEventToApiEvent(event: Event, calendarId: number): Partial<APIEvent> {
  return {
    calendar_id: calendarId,
    title: event.description,
    description: event.description,
    start_time: event.date.toISOString(),
    length: event.length,
  };
}

export async function getCalendars(): Promise<Calendar[]> {
  const response = await fetch(`${API_BASE_URL}/calendars`);
  if (!response.ok) throw new Error('Failed to fetch calendars');
  return response.json();
}

export async function createCalendar(name: string, description: string): Promise<Calendar> {
  const response = await fetch(`${API_BASE_URL}/calendars`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  if (!response.ok) throw new Error('Failed to create calendar');
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
