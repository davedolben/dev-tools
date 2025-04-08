import React, { useState } from 'react';
import { format } from 'date-fns';

interface Event {
  id: string;
  date: Date;
  description: string;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onAddEvent: (event: Omit<Event, 'id'>) => void;
}

const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, selectedDate, onAddEvent }) => {
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      onAddEvent({
        date: selectedDate,
        description: description.trim()
      });
      setDescription('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Add Event for {format(selectedDate, 'MMMM d, yyyy')}</h3>
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
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal; 