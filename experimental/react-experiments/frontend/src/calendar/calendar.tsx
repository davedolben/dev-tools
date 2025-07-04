import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addDays, isWeekend, getDay, addMonths, isBefore, isAfter } from 'date-fns';
import './calendar.css';
import EventModal from './EventModal';
import { Event } from './calendar-client';

interface ProcessedEvent extends Event {
  endDate: Date;
  isEventStart: boolean;
  isEventEnd: boolean;
  isEventMiddle: boolean;
}

interface MonthViewProps {
  monthDate: Date;
  processedEventsMap: Map<string, ProcessedEvent[]>;
  onDateClick: (date: Date) => void;
  onEventClick: (event: Event, e: React.MouseEvent) => void;
  onDragStart: (event: React.DragEvent, eventItem: Event) => void;
  onDragOver: (event: React.DragEvent, date: Date) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent, date: Date) => void;
  onDragEnd: (event: React.DragEvent) => void;
  dragOverDate: Date | null;
}

const MonthView: React.FC<MonthViewProps> = ({
  monthDate,
  processedEventsMap,
  onDateClick,
  onEventClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  dragOverDate,
}) => {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = getDay(monthStart);

  return (
    <div className="month-view">
      <div className="calendar-header">
        <h2>{format(monthDate, 'MMMM yyyy')}</h2>
      </div>
      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day: string) => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}
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
                isSameDay(day, new Date()) ? 'selected' : ''
              } ${!isSameMonth(day, monthDate) ? 'other-month' : ''} ${
                isDragOver ? 'drag-over' : ''
              } ${isWeekend(day) ? 'weekend' : ''}`}
              onClick={() => onDateClick(day)}
              onDragOver={(e) => onDragOver(e, day)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, day)}
            >
              <span className="day-number">{format(day, 'd')}</span>
              <div className="day-events">
                {dayEvents.map(event => (
                  event ? (
                    <div
                      key={event.id}
                      className={`event-item ${event.isEventStart ? 'event-start' : ''} ${
                        event.isEventEnd ? 'event-end' : ''
                      } ${event.isEventMiddle ? 'event-middle' : ''} ${
                        isWeekend(day) ? 'weekend-event' : ''
                      }`}
                      style={event.color ? { '--event-color': event.color } as React.CSSProperties : undefined}
                      draggable
                      onDragStart={(e) => onDragStart(e, event)}
                      onDragEnd={onDragEnd}
                      onClick={(e) => onEventClick(event, e)}
                    >
                      {event.isEventStart && (
                        <div className="event-content">
                          <span className="event-description">{event.description}</span>
                        </div>
                      )}
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
    </div>
  );
};

interface CalendarProps {
  startDate: Date;
  endDate: Date;
  events: Event[];
  onDateSelect?: (date: Date) => void;
  onAddEvent?: (eventData: Omit<Event, 'id'>) => void;
  onEditEvent?: (updatedEvent: Event) => void;
  onDeleteEvent?: (eventId: string) => void;
  onEventClick?: (event: Event, e: React.MouseEvent) => void;
  onDrop?: (eventId: string, newDate: Date) => void;
  lastActiveCalendarId?: number;
}

const Calendar: React.FC<CalendarProps> = ({ 
  startDate, 
  endDate, 
  events,
  onDateSelect,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onEventClick,
  onDrop,
  lastActiveCalendarId = 1
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | undefined>(undefined);
  const [draggedEvent, setDraggedEvent] = useState<Event | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(undefined);
    setIsModalOpen(true);
    onDateSelect?.(date);
  };

  const handleEventClick = (event: Event, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setSelectedDate(event.date);
    setIsModalOpen(true);
    onEventClick?.(event, e);
  };

  const handleAddEvent = (eventData: Omit<Event, 'id'>) => {
    // If the eventData doesn't have a calendarId, 
    // the parent component is responsible for adding it
    onAddEvent?.(eventData);
  };

  const handleEditEvent = (updatedEvent: Event) => {
    onEditEvent?.(updatedEvent);
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

  const processAllEvents = (events: Event[], startDate: Date, endDate: Date): Map<string, ProcessedEvent[]> => {
    const processedEventsMap = new Map<string, ProcessedEvent[]>();
    const firstDayIndices = new Map<string, number>();

    // Get all days in the date range
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    // Initialize the map with empty arrays for all days
    allDays.forEach(day => {
      processedEventsMap.set(format(day, 'yyyy-MM-dd'), []);
    });

    // Sort events by start date
    events.sort((a, b) => {
      if (isSameDay(a.date, b.date)) {
        // Sort descending by length
        return b.length - a.length;
      }
      return a.date.getTime() - b.date.getTime();
    });

    // Process each event
    events.forEach(event => {
      const eventStart = event.date;
      const eventEnd =
        event.skipWeekends ?
          calculateBusinessDaysEndDate(eventStart, event.length) :
          addDays(eventStart, event.length - 1);
      
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

    allDays.forEach(day => {
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
      onDrop?.(draggedEvent.id, targetDate);
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

  // Calculate the months to display
  const monthsToDisplay: Date[] = [];
  let currentMonth = startOfMonth(startDate);
  const lastMonth = startOfMonth(endDate);

  while (!isAfter(currentMonth, lastMonth)) {
    monthsToDisplay.push(currentMonth);
    currentMonth = addMonths(currentMonth, 1);
  }

  // Process all events for the entire date range
  const processedEventsMap = processAllEvents(events, startDate, endDate);

  return (
    <div className="calendar-container">
      <div className="months-grid">
        {monthsToDisplay.map((monthDate) => (
          <MonthView
            key={format(monthDate, 'yyyy-MM')}
            monthDate={monthDate}
            processedEventsMap={processedEventsMap}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            dragOverDate={dragOverDate}
          />
        ))}
      </div>
      {isModalOpen && selectedDate && (
        <EventModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          selectedDate={selectedDate}
          onAddEvent={handleAddEvent}
          onEditEvent={handleEditEvent}
          onDeleteEvent={onDeleteEvent}
          existingEvent={selectedEvent}
          activeCalendarId={lastActiveCalendarId}
        />
      )}
    </div>
  );
};

export default Calendar;
