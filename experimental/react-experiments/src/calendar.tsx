import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import './calendar.css';
import EventModal from './EventModal';

interface Event {
  id: string;
  date: Date;
  description: string;
  length: number; // Number of days the event spans
}

interface CalendarProps {
  startDate: Date;
  endDate: Date;
  onDateSelect?: (date: Date) => void;
}

const Calendar: React.FC<CalendarProps> = ({ startDate, endDate, onDateSelect }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | undefined>(undefined);
  const [draggedEvent, setDraggedEvent] = useState<Event | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(startDate);
  const monthEnd = endOfMonth(startDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const isDateInRange = (date: Date) => {
    return date >= startDate && date <= endDate;
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(undefined);
    setIsModalOpen(true);
    onDateSelect?.(date);
  };

  const handleEventClick = (event: Event, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the date click
    setSelectedEvent(event);
    setSelectedDate(event.date);
    setIsModalOpen(true);
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

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventStart = event.date;
      const eventEnd = new Date(eventStart);
      eventEnd.setDate(eventEnd.getDate() + event.length - 1);
      return date >= eventStart && date <= eventEnd;
    });
  };

  const handleDragStart = (event: React.DragEvent, eventItem: Event) => {
    setDraggedEvent(eventItem);
    event.dataTransfer.setData('text/plain', eventItem.id);
    event.dataTransfer.effectAllowed = 'move';
    const target = event.target as HTMLElement;
    target.classList.add('dragging');
  };

  const handleDragOver = (event: React.DragEvent, date: Date) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverDate(date);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = (event: React.DragEvent, targetDate: Date) => {
    event.preventDefault();
    if (draggedEvent) {
      const updatedEvents = events.map(event => 
        event.id === draggedEvent.id 
          ? { ...event, date: targetDate }
          : event
      );
      setEvents(updatedEvents);
      setDraggedEvent(null);
      setDragOverDate(null);
    }
  };

  const handleDragEnd = (event: React.DragEvent) => {
    const target = event.target as HTMLElement;
    target.classList.remove('dragging');
    setDraggedEvent(null);
    setDragOverDate(null);
  };

  return (
    <div className="calendar">
      <div className="calendar-header">
        <h2>{format(startDate, 'MMMM yyyy')}</h2>
      </div>
      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day: string) => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}
        {daysInMonth.map((day: Date) => {
          const dayEvents = getEventsForDate(day);
          const isDragOver = dragOverDate && isSameDay(day, dragOverDate);
          return (
            <div
              key={day.toString()}
              className={`calendar-day ${
                isDateInRange(day) ? 'selected' : ''
              } ${!isSameMonth(day, startDate) ? 'other-month' : ''} ${
                isDragOver ? 'drag-over' : ''
              }`}
              onClick={() => handleDateClick(day)}
              onDragOver={(e) => handleDragOver(e, day)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, day)}
            >
              <span className="day-number">{format(day, 'd')}</span>
              <div className="day-events">
                {dayEvents.map(event => {
                  const isEventStart = isSameDay(event.date, day);
                  const eventEnd = new Date(event.date);
                  eventEnd.setDate(eventEnd.getDate() + event.length - 1);
                  const isEventEnd = isSameDay(eventEnd, day);
                  const isEventMiddle = !isEventStart && !isEventEnd;
                  
                  return (
                    <div
                      key={event.id}
                      className={`event-item ${isEventStart ? 'event-start' : ''} ${
                        isEventEnd ? 'event-end' : ''
                      } ${isEventMiddle ? 'event-middle' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, event)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => handleEventClick(event, e)}
                    >
                      {isEventStart && event.description}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {selectedDate && (
        <EventModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEvent(undefined);
          }}
          selectedDate={selectedDate}
          onAddEvent={handleAddEvent}
          onEditEvent={handleEditEvent}
          existingEvent={selectedEvent}
        />
      )}
    </div>
  );
};

export default Calendar;
