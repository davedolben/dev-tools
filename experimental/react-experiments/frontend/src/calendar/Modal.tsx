import React from 'react';
import './modal.css';

export interface ModalButton {
  label: string;
  onClick: () => void;
  type?: 'primary' | 'secondary' | 'danger';
  autoFocus?: boolean;
  disabled?: boolean;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  buttons: ModalButton[];
  /** Optional: allow closing by clicking the overlay */
  closeOnOverlayClick?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  buttons,
  closeOnOverlayClick = true,
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" role="dialog" aria-modal="true">
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          {buttons.map((btn, idx) => (
            <button
              key={btn.label + idx}
              type="button"
              className={
                btn.type === 'danger'
                  ? 'btn-danger'
                  : btn.type === 'secondary'
                  ? 'btn-secondary'
                  : 'btn-primary'
              }
              onClick={btn.onClick}
              autoFocus={btn.autoFocus}
              disabled={btn.disabled}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Modal;
