import React, { useState } from 'react';
import { Calendar, createCalendar, CalendarSettings } from './calendar-client';
import CalendarSettingsModal from './CalendarSettingsModal';
import './calendar-sidebar.css';

interface CalendarSidebarProps {
  calendars: Calendar[];
  activeCalendars: number[];
  lastActiveCalendarId: number | null;
  onToggleCalendar: (calendarId: number) => void;
  onCreateCalendar: (settings: CalendarSettings) => void;
  onUpdateCalendarSettings: (calendarId: number, settings: CalendarSettings) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}

const CalendarSidebar: React.FC<CalendarSidebarProps> = ({
  calendars,
  activeCalendars,
  lastActiveCalendarId,
  onToggleCalendar,
  onCreateCalendar,
  onUpdateCalendarSettings,
  isOpen,
  toggleSidebar
}) => {
  const [isCreatingCalendar, setIsCreatingCalendar] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newCalendarDescription, setNewCalendarDescription] = useState('');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedCalendarForSettings, setSelectedCalendarForSettings] = useState<Calendar | null>(null);

  const handleCreateCalendar = () => {
    if (newCalendarName.trim()) {
      onCreateCalendar({
        name: newCalendarName,
        description: newCalendarDescription,
        color: '#cccccc',
        skip_weekends: false
      });
      setNewCalendarName('');
      setNewCalendarDescription('');
      setIsCreatingCalendar(false);
    }
  };

  const handleOpenSettings = (calendar: Calendar, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCalendarForSettings(calendar);
    setIsSettingsModalOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsModalOpen(false);
    setSelectedCalendarForSettings(null);
  };

  const handleSaveSettings = (updated: CalendarSettings) => {
    if (selectedCalendarForSettings) {
      onUpdateCalendarSettings(selectedCalendarForSettings.id, {
        ...selectedCalendarForSettings,
        ...updated
      });
    }
    handleCloseSettings();
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
              className={`
                ${activeCalendars.includes(calendar.id) ? 'active' : ''}
                ${lastActiveCalendarId === calendar.id ? 'last-active' : ''}
              `}
              onClick={() => onToggleCalendar(calendar.id)}
              style={{ 
                borderLeft: activeCalendars.includes(calendar.id) 
                  ? `4px solid ${calendar.color || '#cccccc'}` 
                  : '4px solid transparent' 
              }}
            >
              <div 
                className="calendar-color-indicator" 
                style={{ backgroundColor: calendar.color || '#cccccc' }}
              ></div>
              <input 
                type="checkbox" 
                checked={activeCalendars.includes(calendar.id)}
                onChange={() => onToggleCalendar(calendar.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <span>{calendar.name}</span>
              {lastActiveCalendarId === calendar.id && (
                <span className="active-indicator">✓</span>
              )}
              <button
                className="calendar-settings-btn"
                onClick={(e) => handleOpenSettings(calendar, e)}
                title="Calendar Settings"
              >
                <strong>S</strong>
              </button>
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

      {selectedCalendarForSettings && (
        <CalendarSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={handleCloseSettings}
          calendar={selectedCalendarForSettings}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
};

export default CalendarSidebar;