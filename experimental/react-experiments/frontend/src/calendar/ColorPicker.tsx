import React, { useState } from 'react';
import { CALENDAR_COLORS } from './constants';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange }) => {
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const predefinedColors = CALENDAR_COLORS;

  const handleColorClick = (color: string) => {
    onChange(color);
    setShowCustomPicker(false);
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {predefinedColors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => handleColorClick(color)}
            style={{
              width: 32,
              height: 32,
              backgroundColor: color,
              border: value === color ? '3px solid #333' : '2px solid #ccc',
              borderRadius: '50%',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s ease',
            }}
            title={color}
          />
        ))}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        Custom color:
        <input
          type="color"
          value={value}
          onChange={handleCustomColorChange}
          style={{
            width: 40,
            height: 32,
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        />
      </div>
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8, 
        padding: '8px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <span>Selected:</span>
        <div
          style={{
            width: 24,
            height: 24,
            backgroundColor: value,
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
        <span style={{ fontFamily: 'monospace' }}>{value}</span>
      </div>
    </div>
  );
};

export default ColorPicker; 