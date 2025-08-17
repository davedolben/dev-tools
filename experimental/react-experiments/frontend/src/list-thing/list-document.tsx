import React, { useState, useEffect } from "react";
import { List } from "./list";
import { useListManager } from "./list-data-hook";

export type ListDocumentProps = {
  listId: number;
};

export const ListDocument = ({ listId }: ListDocumentProps) => {
  const [displayedParentIds, setDisplayedParentIds] = useState<number[]>([-1]);
  const [draggedItem, setDraggedItem] = useState<{ id: number; fromListId: number } | null>(null);
  const [selectedItems, setSelectedItems] = useState<Map<number, number>>(new Map()); // Map of listId -> selectedItemId
  const { getAllLists, moveItem, addList } = useListManager(listId);

  const handleItemSelect = async (itemId: number, parentId: number) => {
    // Check if the item is already selected
    const currentlySelected = selectedItems.get(parentId);
    
    if (currentlySelected === itemId) {
      // Deselect the item
      setSelectedItems(prev => {
        const newMap = new Map(prev);
        newMap.delete(parentId);
        return newMap;
      });
      
      // Find the index of the current list
      const currentIndex = displayedParentIds.indexOf(parentId);
      
      // Remove all lists to the right of the current list
      const newListIds = displayedParentIds.slice(0, currentIndex + 1);
      setDisplayedParentIds(newListIds);
      return;
    }
    
    // Update the selected item for this list
    setSelectedItems(prev => new Map(prev).set(parentId, itemId));
    
    // Find the index of the current list
    const currentIndex = displayedParentIds.indexOf(parentId);
    
    // Remove all lists to the right of the current list
    const newListIds = displayedParentIds.slice(0, currentIndex + 1);
    
    // Check if the selected item ID corresponds to another list
    const allLists = await getAllLists();
    const listExists = allLists.find(list => list.id === itemId);
    
    if (listExists && !newListIds.includes(itemId)) {
      // Add the list to the right of the current list
      newListIds.push(itemId);
    }
    
    // Update the displayed list IDs
    setDisplayedParentIds(newListIds);
  };

  const handlePlusClick = async (itemId: number) => {
    // Find which list contains this item
    const allLists = await getAllLists();
    const containingList = allLists.find(list => 
      list.items.some(item => item.id === itemId)
    );
    
    if (!containingList) return;
    
    // Create a new list with the same ID as the item
    await addList(itemId);
    
    // Now select the item (which will add the new list to displayedListIds
    await handleItemSelect(itemId, containingList.id);
  };

  const handleItemMove = async (fromListId: number, toListId: number, itemId: number, dropIndex: number) => {
    await moveItem(fromListId, toListId, itemId, dropIndex);
    setDraggedItem(null);
  };

  const handleDragStart = (id: number, fromListId: number) => {
    setDraggedItem({ id, fromListId });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  return (
    <div style={{
      padding: "10px 16px",
      display: "flex",
      gap: "10px",
      boxSizing: "border-box",
    }}>
      {displayedParentIds.map((parentId: number) => (
        <div key={parentId} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <List
            listId={listId}
            parentId={parentId}
            draggedItem={draggedItem}
            onItemMove={handleItemMove}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onItemSelect={handleItemSelect}
            selectedItemId={selectedItems.get(parentId)}
            onPlusClick={handlePlusClick}
          />
        </div>
      ))}
    </div>
  );
};