import React, { useState } from "react";
import { ListItemData, useListData } from "./list-data-hook";
import { ListItem } from "./list-item";

export type ListProps = {
  listId: number;
  draggedItem: { id: number; fromListId: number } | null;
  onItemMove?: (fromListId: number, toListId: number, itemId: number, dropIndex: number) => void;
  onDragStart: (id: number, fromListId: number) => void;
  onDragEnd: () => void;
  onItemSelect?: (itemId: number, listId: number) => void;
  selectedItemId?: number;
  onPlusClick?: (itemId: number) => void;
};

export const List = ({ 
  listId,
  draggedItem, 
  onItemMove, 
  onDragStart, 
  onDragEnd,
  onItemSelect,
  selectedItemId,
  onPlusClick
}: ListProps) => {
  const [dragOverItem, setDragOverItem] = useState<{ id: number; listId: number } | null>(null);
  const [isDragOverContainer, setIsDragOverContainer] = useState(false);
  const { list, updateList, updateItem } = useListData(listId);

  // Don't render if list data is not available
  if (!list) {
    return <div>Loading...</div>;
  }

  const handleItemClick = (itemId: number) => {
    if (onItemSelect) {
      onItemSelect(itemId, listId);
    }
  };

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
    e.stopPropagation(); // Stop event from bubbling up to container
    
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
        flex: 1,
        display: "flex",
        flexDirection: "column",
        transition: "all 0.2s ease",
      }}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
    >
      <h1 style={{ margin: "0 0 12px 0", flexShrink: 0 }}>{list.name}</h1>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {list.items.map((item) => (
          <ListItem 
            key={item.id}
            data={item}
            isDragging={draggedItem?.id === item.id}
            isDragOver={dragOverItem?.id === item.id}
            isSelected={selectedItemId === item.id}
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragOver={(e) => handleDragOver(e, item.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item.id)}
            onDragEnd={handleDragEnd}
            onClick={() => handleItemClick(item.id)}
            onUpdateItem={async (updates) => updateItem(item.id, updates)}
            onPlusClick={onPlusClick}
          />
        ))}
      </div>
    </div>
  );
};
