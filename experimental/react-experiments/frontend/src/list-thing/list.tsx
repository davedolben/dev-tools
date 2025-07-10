import React, { useState } from "react";

export type ListItemData = {
  id: number;
  name: string;
};

export type ListProps = {
  name: string;
  items: ListItemData[];
  onItemsReorder?: (items: ListItemData[]) => void;
};

export const List = ({ name, items, onItemsReorder }: ListProps) => {
  const [listItems, setListItems] = useState<ListItemData[]>(items);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    setDraggedItem(id);
    e.dataTransfer.setData("text/plain", id.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverItem(id);
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropId: number) => {
    e.preventDefault();
    
    if (draggedItem === null || draggedItem === dropId) {
      setDragOverItem(null);
      setDraggedItem(null);
      return;
    }

    const draggedIndex = listItems.findIndex(item => item.id === draggedItem);
    const dropIndex = listItems.findIndex(item => item.id === dropId);
    
    if (draggedIndex === -1 || dropIndex === -1) {
      setDragOverItem(null);
      setDraggedItem(null);
      return;
    }

    const newItems = [...listItems];
    const [draggedItemData] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItemData);
    
    setListItems(newItems);
    setDragOverItem(null);
    setDraggedItem(null);
    
    if (onItemsReorder) {
      onItemsReorder(newItems);
    }
  };

  const handleDragEnd = () => {
    setDragOverItem(null);
    setDraggedItem(null);
  };

  return (
    <div>
      <h1>{name}</h1>
      {listItems.map((item) => (
        <ListItem 
          key={item.id}
          data={item}
          isDragging={draggedItem === item.id}
          isDragOver={dragOverItem === item.id}
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