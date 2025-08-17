import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { List } from "./list";
import { useListManager } from "./list-data-hook";

export type ListDocumentProps = {
  listId: number;
};

export const ListDocument = ({ listId }: ListDocumentProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [draggedItem, setDraggedItem] = useState<{ id: number; fromListId: number } | null>(null);
  const [selectedItems, setSelectedItems] = useState<Map<number, number>>(new Map()); // Map of listId -> selectedItemId
  const { moveItem } = useListManager(listId);

  // Parse displayed parent IDs from URL, with -1 as implicit first item
  const getDisplayedParentIds = (): number[] => {
    const urlParentIds = searchParams.get('parents');
    if (!urlParentIds) {
      return [-1]; // Default to just the root list
    }
    
    const parsedIds = urlParentIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    const newParentIds = [-1, ...parsedIds]; // Always include -1 as the first item

    // Make sure the selected items are consistent with the displayed parent IDs.
    const newSelectedItems = new Map<number, number>();
    for (let i = 0; i < newParentIds.length-1; i++) {
      const parentId = newParentIds[i];
      const nextParentId = newParentIds[i+1];
      newSelectedItems.set(parentId, nextParentId);
    }
    // If newSelectedItems is different from selectedItems, update the selected items.
    let different = false;
    for (const [parentId, selectedItemId] of newSelectedItems) {
      if (selectedItems.get(parentId) !== selectedItemId) {
        different = true;
        break;
      }
    }
    for (const [parentId, selectedItemId] of selectedItems) {
      if (!newSelectedItems.has(parentId)) {
        different = true;
        break;
      }
    }
    if (different) {
      setSelectedItems(newSelectedItems);
    }

    return newParentIds;
  };

  // Update URL with displayed parent IDs (excluding the implicit -1)
  const updateUrlWithParentIds = (parentIds: number[]) => {
    const urlIds = parentIds.slice(1); // Remove the implicit -1
    if (urlIds.length === 0) {
      searchParams.delete('parents');
    } else {
      searchParams.set('parents', urlIds.join(','));
    }
    setSearchParams(searchParams);
  };

  // Get current displayed parent IDs
  const displayedParentIds = getDisplayedParentIds();

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
      updateUrlWithParentIds(newListIds);
      return;
    }
    
    // Update the selected item for this list
    setSelectedItems(prev => new Map(prev).set(parentId, itemId));
    
    // Find the index of the current list
    const currentIndex = displayedParentIds.indexOf(parentId);
    
    // Remove all lists to the right of the current list
    const newListIds = displayedParentIds.slice(0, currentIndex + 1);
    
    // Add the list to the right of the current list
    newListIds.push(itemId);
    
    // Update the URL with the new list IDs
    updateUrlWithParentIds(newListIds);
  };

  const handlePlusClick = async (parentId: number, itemId: number) => {
    // Now select the item (which will add the new list to displayedListIds
    await handleItemSelect(itemId, parentId);
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
            onPlusClick={(itemId) => handlePlusClick(parentId, itemId)}
          />
        </div>
      ))}
    </div>
  );
};