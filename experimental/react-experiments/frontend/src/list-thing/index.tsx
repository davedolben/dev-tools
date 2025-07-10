import React, { useState } from "react";
import { List } from "./list";
import { ListItemData } from "./list-data-hook";

export const ListThing = () => {
  const [lists, setLists] = useState<ListItemData[][]>([]);
  const [draggedItem, setDraggedItem] = useState<{ id: number; fromListIndex: number } | null>(null);

  const handleItemsReorder = (listIndex: number, newItems: ListItemData[]) => {
    setLists(prevLists => {
      const newLists = [...prevLists];
      newLists[listIndex] = newItems;
      return newLists;
    });
  };

  const handleItemMove = (fromListIndex: number, toListIndex: number, itemId: number, dropIndex: number) => {
    setLists(prevLists => {
      const newLists = [...prevLists];
      
      // Find the item to move
      const fromList = newLists[fromListIndex];
      const itemIndex = fromList.findIndex(item => item.id === itemId);
      
      if (itemIndex === -1) return prevLists;
      
      const [movedItem] = fromList.splice(itemIndex, 1);
      
      // Add to the target list
      const toList = newLists[toListIndex];
      toList.splice(dropIndex, 0, movedItem);
      
      return newLists;
    });
    setDraggedItem(null);
  };

  const handleDragStart = (id: number, fromListIndex: number) => {
    setDraggedItem({ id, fromListIndex });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  return (
    <div style={{
      padding: "10px 16px",
      display: "flex",
      gap: "10px",
    }}>
      {lists.map((list: ListItemData[], listIndex: number) => (
        <div key={listIndex} style={{ flex: 1 }}>
          <List
            name={`List ${listIndex}`}
            items={list}
            listIndex={listIndex}
            draggedItem={draggedItem}
            onItemsReorder={(newItems) => handleItemsReorder(listIndex, newItems)}
            onItemMove={handleItemMove}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        </div>
      ))}
    </div>
  );
};