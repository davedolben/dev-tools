import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import { BrowserRouter, Link, Outlet, Route, Routes } from "react-router-dom";
import Calendar from "./calendar";
import { addDays } from "date-fns";
import {
  getCalendars,
  createCalendar,
  getCalendarEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  apiEventToFrontendEvent,
  frontendEventToApiEvent,
  Event,
  APIEvent
} from "./calendar-client";

// API types
interface Calendar {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

const Layout = () => {
  return (
    <>
      <div>
        <div className="nav-bar">
          <Link to="/">Home</Link>
          <span> | </span>
          <Link to="/calendar">Calendar</Link>
        </div>
        <hr />
        <Outlet />
      </div>
    </>
  );
};

const Main = () => {
  return (
    <>
      <div>hi!</div>
    </>
  );
};

const CalendarPage = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [calendarId, setCalendarId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculateDateRange = (events: Event[]): { startDate: Date; endDate: Date } => {
    if (events.length === 0) {
      return {
        startDate: addDays(new Date(), -7),
        endDate: addDays(new Date(), 7)
      };
    }

    const earliestDate = events.reduce((earliest, event) => {
      return event.date < earliest ? event.date : earliest;
    }, events[0].date);

    const latestDate = events.reduce((latest, event) => {
      const eventEndDate = addDays(event.date, event.length - 1);
      return eventEndDate > latest ? eventEndDate : latest;
    }, addDays(events[0].date, events[0].length - 1));

    // Add some padding to the date range
    return {
      startDate: addDays(earliestDate, -7), // 1 week before earliest event
      endDate: addDays(latestDate, 7) // 1 week after latest event
    };
  };

  useEffect(() => {
    const initializeCalendar = async () => {
      try {
        // Get all calendars
        const calendars = await getCalendars();
        
        // If no calendars exist, create one
        if (!calendars || calendars.length === 0) {
          const newCalendar = await createCalendar('My Calendar', 'A calendar for my events');
          setCalendarId(newCalendar.id);
        } else {
          setCalendarId(calendars[0].id);
        }
      } catch (err) {
        setError('Failed to initialize calendar');
        console.error(err);
      }
    };

    initializeCalendar();
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      if (!calendarId) return;
      
      try {
        const apiEvents = (await getCalendarEvents(calendarId) ?? []);
        const frontendEvents = apiEvents.map(apiEventToFrontendEvent);
        setEvents(frontendEvents);
      } catch (err) {
        setError('Failed to fetch events');
        console.error(err);
      }
    };

    fetchEvents();
  }, [calendarId]);

  const handleAddEvent = async (eventData: { description: string; date: Date; length: number }) => {
    if (!calendarId) return;

    try {
      const apiEvent = frontendEventToApiEvent({ ...eventData, id: 'temp' }, calendarId);
      await createEvent(calendarId, apiEvent as Omit<APIEvent, 'id' | 'calendar_id' | 'created_at' | 'updated_at'>);
      const apiEvents = await getCalendarEvents(calendarId);
      const frontendEvents = apiEvents.map(apiEventToFrontendEvent);
      setEvents(frontendEvents);
    } catch (err) {
      setError('Failed to add event');
      console.error(err);
    }
  };

  const handleEditEvent = async (updatedEvent: Event) => {
    try {
      const apiEvent = frontendEventToApiEvent(updatedEvent, calendarId!);
      await updateEvent(parseInt(updatedEvent.id), apiEvent);
      const apiEvents = await getCalendarEvents(calendarId!);
      const frontendEvents = apiEvents.map(apiEventToFrontendEvent);
      setEvents(frontendEvents);
    } catch (err) {
      setError('Failed to update event');
      console.error(err);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteEvent(parseInt(eventId));
      const apiEvents = await getCalendarEvents(calendarId!);
      const frontendEvents = apiEvents.map(apiEventToFrontendEvent);
      setEvents(frontendEvents);
    } catch (err) {
      setError('Failed to delete event');
      console.error(err);
    }
  };

  const handleDrop = async (eventId: string, newDate: Date) => {
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) return;

      const updatedEvent = { ...event, date: newDate };
      const apiEvent = frontendEventToApiEvent(updatedEvent, calendarId!);
      await updateEvent(parseInt(eventId), apiEvent);
      const apiEvents = await getCalendarEvents(calendarId!);
      const frontendEvents = apiEvents.map(apiEventToFrontendEvent);
      setEvents(frontendEvents);
    } catch (err) {
      setError('Failed to update event position');
      console.error(err);
    }
  };

  const { startDate, endDate } = calculateDateRange(events);

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <>
      <Calendar 
        startDate={startDate}
        endDate={endDate}
        events={events}
        onAddEvent={handleAddEvent}
        onEditEvent={handleEditEvent}
        onDeleteEvent={handleDeleteEvent}
        onDrop={handleDrop}
      />
    </>
  );
};

const App = () => {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Main />} />
            <Route path="/calendar" element={<CalendarPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
};

const root = document.getElementById('root');
if (!root) {
  throw new Error("failed to find root element");
}
ReactDOM.createRoot(root).render(<App />);
