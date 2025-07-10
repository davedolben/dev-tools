import React, { useState, useEffect } from "react";
import { List } from "./list";
import { useListManager } from "./list-data-hook";

export const ListThing = () => {
  const [listIds, setListIds] = useState<number[]>([]);
  const [draggedItem, setDraggedItem] = useState<{ id: number; fromListId: number } | null>(null);
  const { getAllLists, moveItem } = useListManager();

  // Initialize with existing lists
  useEffect(() => {
    const initializeLists = async () => {
      const lists = await getAllLists();
      setListIds(lists.map(list => list.id));
    };
    initializeLists();
  }, [getAllLists]);

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
      {listIds.map((listId: number, listIndex: number) => (
        <div key={listId} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <List
            name={`List ${listIndex}`}
            listId={listId}
            listIndex={listIndex}
            draggedItem={draggedItem}
            onItemMove={handleItemMove}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        </div>
      ))}
    </div>
  );
};