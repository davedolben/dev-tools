import React, { useState } from 'react';
import { format } from 'date-fns';
import { Event } from './calendar-client';
import Modal, { ModalButton } from './Modal';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onAddEvent: (event: Omit<Event, 'id'>) => void;
  onEditEvent?: (event: Event) => void;
  onDeleteEvent?: (eventId: string) => void;
  existingEvent?: Event;
  activeCalendarId: number;
}

const EventModal: React.FC<EventModalProps> = ({ 
  isOpen, 
  onClose, 
  selectedDate, 
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  existingEvent,
  activeCalendarId
}) => {
  const [description, setDescription] = useState(existingEvent?.description || '');
  const [length, setLength] = useState(existingEvent?.length || 1);

  // Reset form when modal opens with new event
  React.useEffect(() => {
    if (existingEvent) {
      setDescription(existingEvent.description);
      setLength(existingEvent.length);
    } else {
      setDescription('');
      setLength(1);
    }
  }, [existingEvent]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (description.trim()) {
      if (existingEvent && onEditEvent) {
        onEditEvent({
          ...existingEvent,
          description: description.trim(),
          length: length
        });
      } else {
        onAddEvent({
          date: selectedDate,
          description: description.trim(),
          length: length,
          calendarId: activeCalendarId
        });
      }
      onClose();
    }
  };

  const handleDelete = () => {
    if (existingEvent && onDeleteEvent) {
      onDeleteEvent(existingEvent.id);
      onClose();
    }
  };

  const modalTitle = existingEvent
    ? 'Edit Event'
    : `Add Event for ${format(selectedDate, 'MMMM d, yyyy')}`;

  const buttons: ModalButton[] = [
    ...(existingEvent && onDeleteEvent
      ? [{
          label: 'Delete Event',
          onClick: handleDelete,
          type: 'danger' as const,
        }]
      : []),
    {
      label: 'Cancel',
      onClick: onClose,
      type: 'secondary' as const,
    },
    {
      label: existingEvent ? 'Save Changes' : 'Add Event',
      onClick: () => handleSubmit(),
      type: 'primary' as const,
      autoFocus: true,
      disabled: !description.trim(),
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} buttons={buttons}>
      <form
        onSubmit={handleSubmit}
        style={{ margin: 0 }}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
            handleSubmit(e);
          }
        }}
      >
        <div className="form-group">
          <label htmlFor="eventDescription">Event Description:</label>
          <input
            type="text"
            id="eventDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter event description"
            autoFocus
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="eventLength">Event Length (days):</label>
          <input
            type="number"
            id="eventLength"
            value={length}
            onChange={(e) => setLength(Math.max(1, parseInt(e.target.value) || 1))}
            min="1"
            required
          />
        </div>
      </form>
    </Modal>
  );
};

export default EventModal; 