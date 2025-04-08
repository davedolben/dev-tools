import React, { useState } from 'react';
import { format } from 'date-fns';

interface Event {
  id: string;
  date: Date;
  description: string;
  length: number;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onAddEvent: (event: Omit<Event, 'id'>) => void;
  onEditEvent?: (event: Event) => void;
  existingEvent?: Event;
}

const EventModal: React.FC<EventModalProps> = ({ 
  isOpen, 
  onClose, 
  selectedDate, 
  onAddEvent,
  onEditEvent,
  existingEvent 
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
          length: length
        });
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{existingEvent ? 'Edit Event' : `Add Event for ${format(selectedDate, 'MMMM d, yyyy')}`}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="eventDescription">Event Description:</label>
            <input
              type="text"
              id="eventDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter event description"
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
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {existingEvent ? 'Save Changes' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal; 