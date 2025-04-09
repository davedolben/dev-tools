import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import { BrowserRouter, Link, Outlet, Route, Routes } from "react-router-dom";
import Calendar, { Event } from "./calendar";
import { addDays } from "date-fns";

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

  const handleAddEvent = (eventData: Omit<Event, 'id'>) => {
    const newEvent: Event = {
      ...eventData,
      id: Math.random().toString(36).substr(2, 9),
    };
    setEvents([...events, newEvent]);
  };

  const handleEditEvent = (updatedEvent: Event) => {
    setEvents(events.map(event => 
      event.id === updatedEvent.id ? updatedEvent : event
    ));
  };

  const handleDrop = (eventId: string, newDate: Date) => {
    setEvents(events.map(event =>
      event.id === eventId
        ? { ...event, date: newDate }
        : event
    ));
  };

  const { startDate, endDate } = calculateDateRange(events);

  return (
    <>
      <Calendar 
        startDate={startDate}
        endDate={endDate}
        events={events}
        onAddEvent={handleAddEvent}
        onEditEvent={handleEditEvent}
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
