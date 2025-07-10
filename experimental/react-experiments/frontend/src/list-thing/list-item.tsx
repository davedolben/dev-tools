import React from "react";
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
  onClick
}: ListItemProps) => {
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
      onClick={onClick}
    >
      {data.name}
      {
        data.numChildren ?
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