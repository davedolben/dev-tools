import React, { useState, useEffect } from "react";
import { List } from "./list";
import { useListManager } from "./list-data-hook";

export const ListThing = () => {
  const [displayedListIds, setDisplayedListIds] = useState<number[]>([100]); // Start with only list ID 1
  const [draggedItem, setDraggedItem] = useState<{ id: number; fromListId: number } | null>(null);
  const [selectedItems, setSelectedItems] = useState<Map<number, number>>(new Map()); // Map of listId -> selectedItemId
  const { getAllLists, moveItem, addList } = useListManager();

  const handleItemSelect = async (itemId: number, listId: number) => {
    // Check if the item is already selected
    const currentlySelected = selectedItems.get(listId);
    
    if (currentlySelected === itemId) {
      // Deselect the item
      setSelectedItems(prev => {
        const newMap = new Map(prev);
        newMap.delete(listId);
        return newMap;
      });
      
      // Find the index of the current list
      const currentIndex = displayedListIds.indexOf(listId);
      
      // Remove all lists to the right of the current list
      const newListIds = displayedListIds.slice(0, currentIndex + 1);
      setDisplayedListIds(newListIds);
      return;
    }
    
    // Update the selected item for this list
    setSelectedItems(prev => new Map(prev).set(listId, itemId));
    
    // Find the index of the current list
    const currentIndex = displayedListIds.indexOf(listId);
    
    // Remove all lists to the right of the current list
    const newListIds = displayedListIds.slice(0, currentIndex + 1);
    
    // Check if the selected item ID corresponds to another list
    const allLists = await getAllLists();
    const listExists = allLists.find(list => list.id === itemId);
    
    if (listExists && !newListIds.includes(itemId)) {
      // Add the list to the right of the current list
      newListIds.push(itemId);
    }
    
    // Update the displayed list IDs
    setDisplayedListIds(newListIds);
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
      {displayedListIds.map((listId: number) => (
        <div key={listId} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <List
            listId={listId}
            draggedItem={draggedItem}
            onItemMove={handleItemMove}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onItemSelect={handleItemSelect}
            selectedItemId={selectedItems.get(listId)}
            onPlusClick={handlePlusClick}
          />
        </div>
      ))}
    </div>
  );
};