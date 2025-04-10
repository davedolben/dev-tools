import React, { useState } from 'react';
import { Calendar, createCalendar } from './calendar-client';
import './calendar-sidebar.css';

interface CalendarSidebarProps {
  calendars: Calendar[];
  selectedCalendarId: number | null;
  onSelectCalendar: (calendarId: number) => void;
  onCreateCalendar: (name: string, description: string) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}

const CalendarSidebar: React.FC<CalendarSidebarProps> = ({
  calendars,
  selectedCalendarId,
  onSelectCalendar,
  onCreateCalendar,
  isOpen,
  toggleSidebar
}) => {
  const [isCreatingCalendar, setIsCreatingCalendar] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newCalendarDescription, setNewCalendarDescription] = useState('');

  const handleCreateCalendar = () => {
    if (newCalendarName.trim()) {
      onCreateCalendar(newCalendarName, newCalendarDescription);
      setNewCalendarName('');
      setNewCalendarDescription('');
      setIsCreatingCalendar(false);
    }
  };

  return (
    <div className={`calendar-sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-toggle" onClick={toggleSidebar}>
        <span className="toggle-icon">{isOpen ? '←' : '→'}</span>
      </div>
      
      <div className="sidebar-content">
        <h3>Calendars</h3>
        <ul className="calendar-list">
          {calendars.map(calendar => (
            <li 
              key={calendar.id}
              className={selectedCalendarId === calendar.id ? 'selected' : ''}
              onClick={() => onSelectCalendar(calendar.id)}
            >
              {calendar.name}
            </li>
          ))}
        </ul>
        
        {isCreatingCalendar ? (
          <div className="create-calendar-form">
            <input
              type="text"
              placeholder="Calendar name"
              value={newCalendarName}
              onChange={e => setNewCalendarName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newCalendarDescription}
              onChange={e => setNewCalendarDescription(e.target.value)}
            />
            <div className="form-actions">
              <button onClick={handleCreateCalendar}>Create</button>
              <button onClick={() => setIsCreatingCalendar(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button 
            className="add-calendar-btn" 
            onClick={() => setIsCreatingCalendar(true)}
          >
            Add Calendar
          </button>
        )}
      </div>
    </div>
  );
};

export default CalendarSidebar; 