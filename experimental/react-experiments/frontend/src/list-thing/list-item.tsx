import React, { useState, useRef, useEffect, useCallback } from "react";
import { ListItemData } from "./list-data-hook";

type ListItemProps = {
  data: ListItemData;
  isDragging: boolean;
  isDragOver: boolean;
  isSelected: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onUpdateItem?: (updates: Partial<ListItemData>) => Promise<void>;
  onPlusClick?: (itemId: number) => void;
};

export const ListItem = ({ 
  data, 
  isDragging, 
  isDragOver, 
  isSelected,
  onDragStart, 
  onDragOver, 
  onDragLeave, 
  onDrop,
  onDragEnd,
  onClick,
  onUpdateItem,
  onPlusClick
}: ListItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update edit value when data.name changes
  useEffect(() => {
    setEditValue(data.name);
  }, [data.name]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Clear any pending click timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editValue.trim() !== data.name && onUpdateItem) {
      await onUpdateItem({ name: editValue.trim() });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(data.name); // Reset to original value
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isEditing) {
      e.stopPropagation();
      return;
    }
    
    // Debounce the click to avoid conflicts with double-click
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    
    clickTimeoutRef.current = setTimeout(() => {
      onClick();
    }, 200);
  }, [isEditing, onClick]);

  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlusClick) {
      onPlusClick(data.id);
    }
  };

  return (
    <div
      style={{
        cursor: isSelected ? "default" : isDragging ? "grabbing" : "grab",
        padding: "8px 12px",
        border: "1px solid #ccc",
        borderRadius: "4px",
        marginBottom: "4px",
        backgroundColor: isSelected 
          ? "#e3f2fd" 
          : isDragging 
            ? "#f0f0f0" 
            : isDragOver 
              ? "#e8f4fd" 
              : "white",
        borderColor: isSelected ? "#2196f3" : "#ccc",
        opacity: isDragging ? 0.5 : 1,
        transition: "all 0.2s ease",
        position: "relative",
      }}
      draggable={!isSelected}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            backgroundColor: "transparent",
            fontSize: "inherit",
            fontFamily: "inherit",
          }}
        />
      ) : (
        <span>{data.name}</span>
      )}
      {
        data.numChildren != undefined ?
          <div style={{
              fontSize: "12px", color: "#666",
              position: "absolute",
              right: "12px",
              top: "12px",
            }}
          >
            ({data.numChildren})
          </div> :
          null
      }
      {data.numChildren == undefined && onPlusClick && (
        <button
          onClick={handlePlusClick}
          style={{
            position: "absolute",
            right: "8px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            border: "1px solid #ccc",
            backgroundColor: "white",
            color: "#666",
            fontSize: "14px",
            lineHeight: "1",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f0f0f0";
            e.currentTarget.style.borderColor = "#999";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "white";
            e.currentTarget.style.borderColor = "#ccc";
          }}
        >
          +
        </button>
      )}
      {isDragOver && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "2px",
            backgroundColor: "#007bff",
            borderRadius: "1px",
          }}
        />
      )}
    </div>
  );
};