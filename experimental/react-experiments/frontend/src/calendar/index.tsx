import React, { useState, useEffect } from 'react';
import { addDays } from 'date-fns';
import Calendar from './calendar';
import { getCalendars, createCalendar, updateCalendar, getCalendarEvents, createEvent, updateEvent, deleteEvent, apiEventToFrontendEvent, frontendEventToApiEvent, Event, APIEvent, Calendar as CalendarType, CalendarSettings } from './calendar-client';
import CalendarSidebar from './CalendarSidebar';
import { CALENDAR_COLORS } from './constants';

// Keep track of which colors have been used
const getAvailableColor = (usedColors: string[]) => {
  // Filter out colors that are already in use
  const availableColors = CALENDAR_COLORS.filter(color => !usedColors.includes(color));
  
  // If all colors are used, cycle through them by picking the least used one
  if (availableColors.length === 0) {
    // Count occurrences of each color
    const colorCounts = CALENDAR_COLORS.reduce((counts, color) => {
      counts[color] = usedColors.filter(c => c === color).length;
      return counts;
    }, {} as Record<string, number>);
    
    // Find the color with the lowest count
    return Object.entries(colorCounts).sort((a, b) => a[1] - b[1])[0][0];
  }
  
  // Return a random available color
  return availableColors[Math.floor(Math.random() * availableColors.length)];
};

const CalendarPage = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [activeCalendars, setActiveCalendars] = useState<number[]>([]);
  const [lastActiveCalendarId, setLastActiveCalendarId] = useState<number | null>(null);
  const [calendars, setCalendars] = useState<CalendarType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
        
        // If no calendars exist, create one with a random color
        if (!fetchedCalendars || fetchedCalendars.length === 0) {
          const newCalendar = await createCalendar({
            name: 'My Calendar',
            description: 'A calendar for my events',
            color: CALENDAR_COLORS[0],
            skip_weekends: false
          });

          // Refresh all calendars from the server now that we've created a new one
          const updatedCalendars = await getCalendars();
          setCalendars(updatedCalendars);

          setActiveCalendars([newCalendar.id]);
          setLastActiveCalendarId(newCalendar.id);
        } else {
          // Check for calendars without colors and assign unique ones
          const usedColors = fetchedCalendars
            .filter(cal => cal.color)
            .map(cal => cal.color as string);
            
          const calendarsWithColors = fetchedCalendars.map(cal => {
            if (!cal.color) {
              return { ...cal, color: getAvailableColor(usedColors) };
            }
            return cal;
          });
          
          setCalendars(calendarsWithColors);
          // Activate all calendars by default
          const allCalendarIds = calendarsWithColors.map(cal => cal.id);
          setActiveCalendars(allCalendarIds);
          // Set the first calendar as the last active one
          setLastActiveCalendarId(calendarsWithColors[0].id);
        }
      } catch (err) {
        setError('Failed to fetch calendars');
        console.error(err);
      }
    };

    fetchCalendars();
  }, []);

  useEffect(() => {
    const fetchAllEvents = async () => {
      if (activeCalendars.length === 0) {
        setEvents([]);
        return;
      }
      
      try {
        // Fetch events from all active calendars
        const allEvents: Event[] = [];
        
        for (const calendarId of activeCalendars) {
          const calendar = calendars.find(cal => cal.id === calendarId);
          if (!calendar) continue;
          
          const apiEvents = await getCalendarEvents(calendarId) || [];
          const calendarEvents = apiEvents.map(apiEvent => 
            apiEventToFrontendEvent(apiEvent, calendar)
          );
          
          allEvents.push(...calendarEvents);
        }
        
        setEvents(allEvents);
      } catch (err) {
        setError('Failed to fetch events');
        console.error(err);
      }
    };

    fetchAllEvents();
  }, [activeCalendars, calendars]);

  const handleToggleCalendar = (calendarId: number) => {
    setActiveCalendars(prevActiveCalendars => {
      if (prevActiveCalendars.includes(calendarId)) {
        // Prevent deactivating the last calendar
        if (prevActiveCalendars.length === 1) {
          return prevActiveCalendars;
        }
        
        // If we're deactivating the last active calendar, set a new one
        if (lastActiveCalendarId === calendarId) {
          // Find another active calendar to set as last active
          const remainingCalendars = prevActiveCalendars.filter(id => id !== calendarId);
          // Set the first remaining active calendar as the last active
          if (remainingCalendars.length > 0) {
            setLastActiveCalendarId(remainingCalendars[0]);
          }
        }
        
        return prevActiveCalendars.filter(id => id !== calendarId);
      } else {
        // If activating a calendar, set it as the last active
        setLastActiveCalendarId(calendarId);
        return [...prevActiveCalendars, calendarId];
      }
    });
  };

  const handleAddEvent = async (eventData: { description: string; date: Date; length: number }) => {
    // Find a valid calendar ID to use
    let targetCalendarId = lastActiveCalendarId;
    
    if (!targetCalendarId || !activeCalendars.includes(targetCalendarId)) {
      if (activeCalendars.length > 0) {
        // Use the first active calendar if the last active one isn't available
        targetCalendarId = activeCalendars[0];
        // Update the last active calendar ID
        setLastActiveCalendarId(targetCalendarId);
      } else {
        setError('Cannot add event: No active calendars');
        return;
      }
    }

    try {
      const apiEvent = frontendEventToApiEvent({ ...eventData, id: 'temp', calendarId: targetCalendarId }, targetCalendarId);
      await createEvent(targetCalendarId, apiEvent as Omit<APIEvent, 'id' | 'calendar_id' | 'created_at' | 'updated_at'>);
      
      // Refresh events
      await refreshEvents();
    } catch (err) {
      setError('Failed to add event');
      console.error(err);
    }
  };

  // Helper function to refresh events from all active calendars
  const refreshEvents = async () => {
    try {
      const allEvents: Event[] = [];
      
      for (const calendarId of activeCalendars) {
        const calendar = calendars.find(cal => cal.id === calendarId);
        if (!calendar) continue;
        
        const apiEvents = await getCalendarEvents(calendarId) || [];
        const calendarEvents = apiEvents.map(apiEvent => 
          apiEventToFrontendEvent(apiEvent, calendar)
        );
        
        allEvents.push(...calendarEvents);
      }
      
      setEvents(allEvents);
    } catch (err) {
      console.error('Failed to refresh events', err);
      throw err;
    }
  };

  const handleEditEvent = async (updatedEvent: Event) => {
    try {
      // Find a valid calendar ID to use
      let targetCalendarId = updatedEvent.calendarId || lastActiveCalendarId;
      
      if (!targetCalendarId || !activeCalendars.includes(targetCalendarId)) {
        if (activeCalendars.length > 0) {
          // Use the first active calendar if needed
          targetCalendarId = activeCalendars[0];
          // Update the last active calendar ID
          setLastActiveCalendarId(targetCalendarId);
        } else {
          setError('Cannot edit event: No active calendars');
          return;
        }
      }
      
      const apiEvent = frontendEventToApiEvent(updatedEvent, targetCalendarId);
      await updateEvent(parseInt(updatedEvent.id), apiEvent);
      
      // Refresh events
      await refreshEvents();
    } catch (err) {
      setError('Failed to update event');
      console.error(err);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteEvent(parseInt(eventId));
      
      // Refresh events
      await refreshEvents();
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
      
      // Find a valid calendar ID to use
      let targetCalendarId = updatedEvent.calendarId || lastActiveCalendarId;
      
      if (!targetCalendarId || !activeCalendars.includes(targetCalendarId)) {
        if (activeCalendars.length > 0) {
          // Use the first active calendar if needed
          targetCalendarId = activeCalendars[0];
          // Update the last active calendar ID
          setLastActiveCalendarId(targetCalendarId);
        } else {
          setError('Cannot update event: No active calendars');
          return;
        }
      }
      
      const apiEvent = frontendEventToApiEvent(updatedEvent, targetCalendarId);
      await updateEvent(parseInt(eventId), apiEvent);
      
      // Refresh events
      await refreshEvents();
    } catch (err) {
      setError('Failed to update event position');
      console.error(err);
    }
  };

  const handleCreateCalendar = async (settings: CalendarSettings) => {
    try {
      // Get currently used colors from existing calendars
      const usedColors = calendars
        .filter(cal => cal.color)
        .map(cal => cal.color as string);
      
      // Assign a unique color to the new calendar
      const color = getAvailableColor(usedColors);
      const newCalendar = await createCalendar({ ...settings, color });

      // Refresh all calendars from the server
      const updatedCalendars = await getCalendars();
      setCalendars(updatedCalendars);
      
      // Automatically activate the new calendar and set as last active
      setActiveCalendars(prev => [...prev, newCalendar.id]);
      setLastActiveCalendarId(newCalendar.id);
    } catch (err) {
      setError('Failed to create calendar');
      console.error(err);
    }
  };

  const handleUpdateCalendarSettings = async (calendarId: number, settings: CalendarSettings) => {
    try {
      await updateCalendar(calendarId, settings);
      
      // Refresh all calendars from the server
      const updatedCalendars = await getCalendars();
      setCalendars(updatedCalendars);
    } catch (err) {
      setError('Failed to update calendar settings');
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

  return (
    <div className="calendar-app">
      <CalendarSidebar
        calendars={calendars}
        activeCalendars={activeCalendars}
        lastActiveCalendarId={lastActiveCalendarId}
        onToggleCalendar={handleToggleCalendar}
        onCreateCalendar={handleCreateCalendar}
        onUpdateCalendarSettings={handleUpdateCalendarSettings}
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      />

      <div className={`calendar-container`}>
        <div className="calendar-header">
          <h2>My Calendars</h2>
          {activeCalendars.length > 0 && (
            <p>
              Showing {activeCalendars.length} calendar{activeCalendars.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        <Calendar 
          startDate={startDate}
          endDate={endDate}
          events={events}
          onAddEvent={handleAddEvent}
          onEditEvent={handleEditEvent}
          onDeleteEvent={handleDeleteEvent}
          onDrop={handleDrop}
          lastActiveCalendarId={
            lastActiveCalendarId && activeCalendars.includes(lastActiveCalendarId) 
              ? lastActiveCalendarId 
              : activeCalendars.length > 0 
                ? activeCalendars[0] 
                : 1
          }
        />
      </div>
    </div>
  );
};

export default CalendarPage;