import React, { useState } from "react";
import { ListItemData, useListData } from "./list-data-hook";

export type ListProps = {
  name: string;
  listId: number;
  listIndex: number;
  draggedItem: { id: number; fromListId: number } | null;
  onItemMove?: (fromListId: number, toListId: number, itemId: number, dropIndex: number) => void;
  onDragStart: (id: number, fromListId: number) => void;
  onDragEnd: () => void;
};

export const List = ({ 
  name, 
  listId,
  listIndex, 
  draggedItem, 
  onItemMove, 
  onDragStart, 
  onDragEnd 
}: ListProps) => {
  const [dragOverItem, setDragOverItem] = useState<{ id: number; listId: number } | null>(null);
  const [isDragOverContainer, setIsDragOverContainer] = useState(false);
  const { list, updateList } = useListData(listId);

  // Don't render if list data is not available
  if (!list) {
    return <div>Loading...</div>;
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    onDragStart(id, listId);
    e.dataTransfer.setData("text/plain", id.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverItem({ id, listId });
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, dropId: number) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.id === dropId) {
      setDragOverItem(null);
      return;
    }

    const dropIndex = list.items.findIndex(item => item.id === dropId);
    
    if (dropIndex === -1) {
      setDragOverItem(null);
      return;
    }

    // If dropping in the same list, reorder using the hook
    if (draggedItem.fromListId === listId) {
      const draggedIndex = list.items.findIndex(item => item.id === draggedItem.id);
      
      if (draggedIndex === -1) {
        setDragOverItem(null);
        return;
      }

      const newItems = [...list.items];
      const [draggedItemData] = newItems.splice(draggedIndex, 1);
      newItems.splice(dropIndex, 0, draggedItemData);
      
      await updateList(newItems);
    } else {
      // If dropping in a different list, move the item
      if (onItemMove) {
        onItemMove(draggedItem.fromListId, listId, draggedItem.id, dropIndex);
      }
    }
    
    setDragOverItem(null);
  };

  const handleContainerDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOverContainer(true);
  };

  const handleContainerDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only set to false if we're leaving the container entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOverContainer(false);
    }
  };

  const handleContainerDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (!draggedItem) {
      setIsDragOverContainer(false);
      return;
    }

    // If dropping in the same list, reorder to the end
    if (draggedItem.fromListId === listId) {
      const draggedIndex = list.items.findIndex(item => item.id === draggedItem.id);
      
      if (draggedIndex === -1) {
        setIsDragOverContainer(false);
        return;
      }

      const newItems = [...list.items];
      const [draggedItemData] = newItems.splice(draggedIndex, 1);
      newItems.push(draggedItemData); // Add to end
      
      await updateList(newItems);
    } else {
      // If dropping in a different list, move the item to the end
      if (onItemMove) {
        onItemMove(draggedItem.fromListId, listId, draggedItem.id, list.items.length);
      }
    }
    
    setIsDragOverContainer(false);
  };

  const handleDragEnd = () => {
    setDragOverItem(null);
    setIsDragOverContainer(false);
    onDragEnd();
  };

  return (
    <div
      style={{
        border: isDragOverContainer ? "2px dashed #007bff" : "1px solid #ccc",
        borderRadius: "8px",
        padding: "12px",
        backgroundColor: isDragOverContainer ? "#f8f9ff" : "white",
        minHeight: "200px",
        transition: "all 0.2s ease",
      }}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
    >
      <h1>{name}</h1>
      {list.items.map((item) => (
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