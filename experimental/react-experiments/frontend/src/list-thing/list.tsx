import React, { useState } from "react";
import { ListItemData } from "./list-data-hook";

export type ListProps = {
  name: string;
  items: ListItemData[];
  listIndex: number;
  draggedItem: { id: number; fromListIndex: number } | null;
  onItemsReorder?: (items: ListItemData[]) => void;
  onItemMove?: (fromListIndex: number, toListIndex: number, itemId: number, dropIndex: number) => void;
  onDragStart: (id: number, fromListIndex: number) => void;
  onDragEnd: () => void;
};

export const List = ({ 
  name, 
  items, 
  listIndex, 
  draggedItem, 
  onItemsReorder, 
  onItemMove, 
  onDragStart, 
  onDragEnd 
}: ListProps) => {
  const [dragOverItem, setDragOverItem] = useState<{ id: number; listIndex: number } | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    onDragStart(id, listIndex);
    e.dataTransfer.setData("text/plain", id.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverItem({ id, listIndex });
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropId: number) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.id === dropId) {
      setDragOverItem(null);
      return;
    }

    const dropIndex = items.findIndex(item => item.id === dropId);
    
    if (dropIndex === -1) {
      setDragOverItem(null);
      return;
    }

    // If dropping in the same list, reorder
    if (draggedItem.fromListIndex === listIndex) {
      const draggedIndex = items.findIndex(item => item.id === draggedItem.id);
      
      if (draggedIndex === -1) {
        setDragOverItem(null);
        return;
      }

      const newItems = [...items];
      const [draggedItemData] = newItems.splice(draggedIndex, 1);
      newItems.splice(dropIndex, 0, draggedItemData);
      
      if (onItemsReorder) {
        onItemsReorder(newItems);
      }
    } else {
      // If dropping in a different list, move the item
      if (onItemMove) {
        onItemMove(draggedItem.fromListIndex, listIndex, draggedItem.id, dropIndex);
      }
    }
    
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDragOverItem(null);
    onDragEnd();
  };

  return (
    <div>
      <h1>{name}</h1>
      {items.map((item) => (
        <ListItem 
          key={item.id}
          data={item}
          isDragging={draggedItem?.id === item.id}
          isDragOver={dragOverItem?.id === item.id}
          onDragStart={(e) => handleDragStart(e, item.id)}
          onDragOver={(e) => handleDragOver(e, item.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, item.id)}
          onDragEnd={handleDragEnd}
        />
      ))}
    </div>
  );
};

type ListItemProps = {
  data: ListItemData;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
};

const ListItem = ({ 
  data, 
  isDragging, 
  isDragOver, 
  onDragStart, 
  onDragOver, 
  onDragLeave, 
  onDrop,
  onDragEnd
}: ListItemProps) => {
  return (
    <div
      style={{
        cursor: isDragging ? "grabbing" : "grab",
        padding: "8px 12px",
        border: "1px solid #ccc",
        borderRadius: "4px",
        marginBottom: "4px",
        backgroundColor: isDragging ? "#f0f0f0" : isDragOver ? "#e8f4fd" : "white",
        opacity: isDragging ? 0.5 : 1,
        transition: "all 0.2s ease",
        position: "relative",
      }}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {data.name}
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