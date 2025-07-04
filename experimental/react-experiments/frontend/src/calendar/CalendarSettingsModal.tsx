import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Calendar, CalendarSettings } from './calendar-client';

interface CalendarSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  calendar: Calendar;
  onSave: (updated: Pick<CalendarSettings, 'name' | 'skip_weekends'>) => void;
}

const CalendarSettingsModal: React.FC<CalendarSettingsProps> = ({ isOpen, onClose, calendar, onSave }) => {
  const [name, setName] = useState(calendar.name);
  const [skipWeekends, setSkipWeekends] = useState(!!calendar.skip_weekends);

  useEffect(() => {
    setName(calendar.name);
    setSkipWeekends(!!calendar.skip_weekends);
  }, [calendar]);

  const handleSave = () => {
    onSave({ name, skip_weekends: skipWeekends });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Calendar Settings"
      buttons={[
        { label: 'Cancel', onClick: onClose, type: 'secondary' },
        { label: 'Save', onClick: handleSave, type: 'primary', autoFocus: true, disabled: name.trim() === '' },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label>
          Calendar Name:
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', marginTop: 4 }}
            autoFocus
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={skipWeekends}
            onChange={e => setSkipWeekends(e.target.checked)}
          />
          Skip weekends in calendar view
        </label>
      </div>
    </Modal>
  );
};

export default CalendarSettingsModal;
