import React, { useState, useEffect } from 'react';
import { addDays } from 'date-fns';
import Calendar from './calendar';
import { getCalendars, createCalendar, getCalendarEvents, createEvent, updateEvent, deleteEvent, apiEventToFrontendEvent, frontendEventToApiEvent, Event, APIEvent, Calendar as CalendarType } from './calendar-client';
import CalendarSidebar from './CalendarSidebar';

const CalendarPage = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [calendarId, setCalendarId] = useState<number | null>(null);
  const [calendars, setCalendars] = useState<CalendarType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
    const fetchCalendars = async () => {
      try {
        // Get all calendars
        const fetchedCalendars = await getCalendars();
        
        // If no calendars exist, create one
        if (!fetchedCalendars || fetchedCalendars.length === 0) {
          const newCalendar = await createCalendar('My Calendar', 'A calendar for my events');
          setCalendars([newCalendar]);
          setCalendarId(newCalendar.id);
        } else {
          setCalendars(fetchedCalendars);
          setCalendarId(fetchedCalendars[0].id);
        }
      } catch (err) {
        setError('Failed to fetch calendars');
        console.error(err);
      }
    };

    fetchCalendars();
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
      
      // Refresh events for the selected calendar
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
      
      // Refresh events for the selected calendar
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
      
      // Refresh events for the selected calendar
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
      
      // Refresh events for the selected calendar
      const apiEvents = await getCalendarEvents(calendarId!);
      const frontendEvents = apiEvents.map(apiEventToFrontendEvent);
      setEvents(frontendEvents);
    } catch (err) {
      setError('Failed to update event position');
      console.error(err);
    }
  };

  const handleCreateCalendar = async (name: string, description: string) => {
    try {
      const newCalendar = await createCalendar(name, description);
      setCalendars([...calendars, newCalendar]);
      
      // Automatically select the new calendar
      setCalendarId(newCalendar.id);
    } catch (err) {
      setError('Failed to create calendar');
      console.error(err);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const { startDate, endDate } = calculateDateRange(events);

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  const selectedCalendar = calendars.find(cal => cal.id === calendarId);

  return (
    <div className="calendar-app">
      <CalendarSidebar
        calendars={calendars}
        selectedCalendarId={calendarId}
        onSelectCalendar={setCalendarId}
        onCreateCalendar={handleCreateCalendar}
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      />

      <div className={`calendar-container`}>
        {selectedCalendar && (
          <div className="calendar-header">
            <h2>{selectedCalendar.name}</h2>
            <p>{selectedCalendar.description}</p>
          </div>
        )}

        <Calendar 
          startDate={startDate}
          endDate={endDate}
          events={events}
          onAddEvent={handleAddEvent}
          onEditEvent={handleEditEvent}
          onDeleteEvent={handleDeleteEvent}
          onDrop={handleDrop}
        />
      </div>
    </div>
  );
};

export default CalendarPage;