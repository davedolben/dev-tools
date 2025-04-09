import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addDays, isWeekend, getDay } from 'date-fns';
import './calendar.css';
import EventModal from './EventModal';

interface Event {
  id: string;
  date: Date;
  description: string;
  length: number; // Number of days the event spans
}

interface ProcessedEvent extends Event {
  endDate: Date;
  isEventStart: boolean;
  isEventEnd: boolean;
  isEventMiddle: boolean;
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
  const firstDayOfWeek = getDay(monthStart); // Get the day of week (0-6) for the first of the month

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

  const calculateBusinessDaysEndDate = (startDate: Date, businessDays: number): Date => {
    let currentDate = new Date(startDate);
    let remainingDays = businessDays - (isWeekend(startDate) ? 0 : 1);

    while (remainingDays > 0) {
      currentDate = addDays(currentDate, 1);
      if (!isWeekend(currentDate)) {
        remainingDays--;
      }
    }

    return currentDate;
  };

  const processAllEvents = (events: Event[], daysInMonth: Date[]): Map<string, ProcessedEvent[]> => {
    const processedEventsMap = new Map<string, ProcessedEvent[]>();
    const firstDayIndices = new Map<string, number>();

    // Initialize the map with empty arrays for all days
    daysInMonth.forEach(day => {
      processedEventsMap.set(format(day, 'yyyy-MM-dd'), []);
    });

    // Process each event
    events.forEach(event => {
      const eventStart = event.date;
      const eventEnd = calculateBusinessDaysEndDate(eventStart, event.length);
      
      // Get all days this event spans
      const eventDays = eachDayOfInterval({ start: eventStart, end: eventEnd });
      
      eventDays.forEach(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        if (processedEventsMap.has(dayKey)) {
          const processedEvent: ProcessedEvent = {
            ...event,
            endDate: eventEnd,
            isEventStart: isSameDay(eventStart, day),
            isEventEnd: isSameDay(eventEnd, day),
            isEventMiddle: !isSameDay(eventStart, day) && !isSameDay(eventEnd, day)
          };
          processedEventsMap.get(dayKey)?.push(processedEvent);
        }
      });
    });

    daysInMonth.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      if (processedEventsMap.has(dayKey)) {
        const dayEvents = processedEventsMap.get(dayKey)!;
        let index = 0;
        while (index < dayEvents.length) {
          const event = dayEvents[index];
          if (firstDayIndices.has(event.id)) {
            const wantIndex = firstDayIndices.get(event.id)!;
            if (index !== wantIndex) {
              dayEvents.splice(index, 0, ...Array(wantIndex - index).fill(null));
              index = wantIndex;
            }
          }
          index++;
        }
        dayEvents.forEach(event => {
          if (event && event.isEventStart) {
            firstDayIndices.set(event.id, dayEvents.indexOf(event));
          }
        });
      }
    });
    

    return processedEventsMap;
  };

  // Process all events once
  const processedEventsMap = processAllEvents(events, daysInMonth);

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
        {/* Add empty cells for days before the first of the month */}
        {Array.from({ length: firstDayOfWeek }).map((_, index) => (
          <div key={`empty-${index}`} className="calendar-day empty"></div>
        ))}
        {daysInMonth.map((day: Date) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEvents = processedEventsMap.get(dayKey) || [];
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
                {dayEvents.map(event => (
                  event ? (
                    <div
                      key={event.id}
                      className={`event-item ${event.isEventStart ? 'event-start' : ''} ${
                        event.isEventEnd ? 'event-end' : ''
                      } ${event.isEventMiddle ? 'event-middle' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, event)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => handleEventClick(event, e)}
                    >
                      {event.isEventStart && event.description}
                    </div>
                  ) : (
                    <div className="event-item empty"></div>
                  )
                ))}
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
