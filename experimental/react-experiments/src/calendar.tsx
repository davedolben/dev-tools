import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import './calendar.css';

interface CalendarProps {
  startDate: Date;
  endDate: Date;
  onDateSelect?: (date: Date) => void;
}

const Calendar: React.FC<CalendarProps> = ({ startDate, endDate, onDateSelect }) => {
  const monthStart = startOfMonth(startDate);
  const monthEnd = endOfMonth(startDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const isDateInRange = (date: Date) => {
    return date >= startDate && date <= endDate;
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
        {daysInMonth.map((day: Date) => (
          <div
            key={day.toString()}
            className={`calendar-day ${
              isDateInRange(day) ? 'selected' : ''
            } ${!isSameMonth(day, startDate) ? 'other-month' : ''}`}
            onClick={() => onDateSelect?.(day)}
          >
            {format(day, 'd')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Calendar;
