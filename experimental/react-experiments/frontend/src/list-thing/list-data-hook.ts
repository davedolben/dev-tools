import { useState, useEffect, useCallback } from "react";

const initialLists = [
  {
    id: 100,
    name: "Initial List",
    items: [
      { id: 101, name: "List 101", numChildren: 3 },
      { id: 2, name: "Item 2" },
      { id: 3, name: "Item 3" },
    ],
  },
  {
    id: 101,
    name: "List 101",
    items: [
      { id: 4, name: "Item 4" },
      { id: 102, name: "List 102", numChildren: 3 },
      { id: 6, name: "Item 6" },
    ],
  },
  {
    id: 102,
    name: "List 102",
    items: [
      { id: 7, name: "Item 7" },
      { id: 8, name: "Item 8" },
      { id: 9, name: "Item 9" },
    ],
  },
];

export type ListChildData = {
  id: number;
  name: string;
  numChildren?: number;
};

export type ListItemData = {
  id: number;
  name: string;
  items: ListChildData[];
};

// Shared state manager class
class ListStateManager {
  private static instance: ListStateManager;
  private listeners: Map<number, Set<() => void>> = new Map();
  private _lists: ListItemData[] = initialLists;

  private constructor() {}

  static getInstance(): ListStateManager {
    if (!ListStateManager.instance) {
      ListStateManager.instance = new ListStateManager();
    }
    return ListStateManager.instance;
  }

  get lists(): ListItemData[] {
    return this._lists;
  }

  async getList(listId: number): Promise<ListItemData | undefined> {
    const found = this._lists.find(list => list.id === listId);
    if (found) {
      return found;
    }

    // If the list doesn't exist but an item with this id exists, return an
    // empty list with the item's name and ID.
    const inList = this._lists.find(list => list.items.some(item => item.id === listId));
    if (inList) {
      const item = inList.items.find(item => item.id === listId);
      if (item) {
        return {
          id: item.id,
          name: item.name,
          items: [],
        };
      }
    }

    return undefined;
  }

  subscribeToList(listId: number, listener: () => void): () => void {
    if (!this.listeners.has(listId)) {
      this.listeners.set(listId, new Set());
    }
    
    const listListeners = this.listeners.get(listId)!;
    listListeners.add(listener);
    
    return () => {
      const listeners = this.listeners.get(listId);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.listeners.delete(listId);
        }
      }
    };
  }

  private notifyListListeners(listId: number): void {
    const listListeners = this.listeners.get(listId);
    if (listListeners) {
      listListeners.forEach(listener => listener());
    }
  }

  // Helper method to update numChildren for items that reference a specific list
  private updateNumChildrenForList(listId: number): void {
    const targetList = this._lists.find(list => list.id === listId);
    if (!targetList) return;

    const numChildren = targetList.items.length;
    
    let found: number | undefined;

    // Find all items across all lists that reference this list
    this._lists = this._lists.map(list => {
      const hasMatchingItem = list.items.some(item => item.id === listId);
      if (!hasMatchingItem) return list;

      found = found || list.id;
      
      return {
        ...list,
        items: list.items.map(item =>
          item.id === listId
            ? { ...item, numChildren }
            : item
        )
      };
    });

    if (found) {
      this.notifyListListeners(found);
    }
  }

  async setList(listId: number, items: ListChildData[]): Promise<void> {
    const listIndex = this._lists.findIndex(list => list.id === listId);
    if (listIndex !== -1) {
      this._lists[listIndex] = { ...this._lists[listIndex], items };
      this.updateNumChildrenForList(listId);
      this.notifyListListeners(listId);
    }
  }

  async addList(id: number): Promise<void> {
    // If the list already exists, return.
    if (this._lists.find(l => l.id === id)) {
      return;
    }

    const newList = await this.getList(id);
    if (!newList) {
      throw new Error(`Item ${id} not found in any list`);
    }

    this._lists.push(newList);
    this.updateNumChildrenForList(id);
    // Notify any existing listeners for this list
    this.notifyListListeners(id);
  }

  async removeList(listId: number): Promise<void> {
    this._lists = this._lists.filter(list => list.id !== listId);
    // Clean up listeners for the removed list
    this.listeners.delete(listId);
  }

  async updateListItem(listId: number, itemId: number, updates: Partial<ListChildData>): Promise<void> {
    const listIndex = this._lists.findIndex(list => list.id === listId);
    if (listIndex !== -1) {
      const itemIndex = this._lists[listIndex].items.findIndex(item => item.id === itemId);
      if (itemIndex !== -1) {
        const updatedItem = { ...this._lists[listIndex].items[itemIndex], ...updates };
        // Replace the whole thing so any hooks depending on the list will re-render.
        this._lists[listIndex] = {
          ...this._lists[listIndex],
          items: this._lists[listIndex].items.map(item => item.id === itemId ? updatedItem : item)
        };
        this.updateNumChildrenForList(listId);
        this.notifyListListeners(listId);
      }
    }

    // If the item is a list, update the name of the list.
    if (updates.name) {
      const listIndex = this._lists.findIndex(list => list.id === itemId);
      if (listIndex !== -1) {
        this._lists[listIndex] = { ...this._lists[listIndex], name: updates.name };
        this.notifyListListeners(itemId);
      }
    }
  }

  async addItem(listId: number, item: ListChildData, insertIndex?: number): Promise<ListChildData> {
    console.log("addItem", listId, item, insertIndex);
    const listIndex = this._lists.findIndex(list => list.id === listId);
    if (listIndex === -1) {
      throw new Error(`List ${listId} not found`);
    }

    // Assign the item a new ID by finding the largest ID in the dataset and adding 1.
    const newId = Math.max(...this._lists.flatMap(list => list.items.map(item => item.id))) + 1;
    const newItem = { ...item, id: newId };
    
    if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= this._lists[listIndex].items.length) {
      // Insert at specific position
      this._lists[listIndex] = {
        ...this._lists[listIndex],
        items: [
          ...this._lists[listIndex].items.slice(0, insertIndex),
          newItem,
          ...this._lists[listIndex].items.slice(insertIndex)
        ]
      };
    } else {
      // Add to end
      this._lists[listIndex] = {
        ...this._lists[listIndex],
        items: [...this._lists[listIndex].items, newItem]
      };
    }

    this.updateNumChildrenForList(listId);
    this.notifyListListeners(listId);

    return newItem;
  }

  async removeItem(listId: number, itemId: number): Promise<void> {
    const listIndex = this._lists.findIndex(list => list.id === listId);
    if (listIndex !== -1) {
      this._lists[listIndex] = {
        ...this._lists[listIndex],
        items: this._lists[listIndex].items.filter(item => item.id !== itemId)
      };
      this.updateNumChildrenForList(listId);
      this.notifyListListeners(listId);
    }
  }

  async moveItem(fromListId: number, toListId: number, itemId: number, targetIndex?: number): Promise<void> {
    const fromListIndex = this._lists.findIndex(list => list.id === fromListId);
    const toListIndex = this._lists.findIndex(list => list.id === toListId);
    
    if (fromListIndex !== -1 && toListIndex !== -1) {
      const fromList = this._lists[fromListIndex];
      const itemIndex = fromList.items.findIndex(item => item.id === itemId);
      
      if (itemIndex !== -1) {
        // Remove item from source list
        const movedItem = fromList.items[itemIndex];
        this._lists[fromListIndex] = {
          ...this._lists[fromListIndex],
          items: fromList.items.filter(item => item.id !== itemId)
        };
        
        // Add item to destination list at specific index or at the end
        if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= this._lists[toListIndex].items.length) {
          this._lists[toListIndex] = {
            ...this._lists[toListIndex],
            items: [
              ...this._lists[toListIndex].items.slice(0, targetIndex),
              movedItem,
              ...this._lists[toListIndex].items.slice(targetIndex)
            ]
          };
        } else {
          this._lists[toListIndex] = {
            ...this._lists[toListIndex],
            items: [...this._lists[toListIndex].items, movedItem]
          };
        }
        
        // Update numChildren for both lists
        this.updateNumChildrenForList(fromListId);
        this.updateNumChildrenForList(toListId);
        
        // Notify listeners for both lists
        this.notifyListListeners(fromListId);
        this.notifyListListeners(toListId);
      }
    }
  }
}

export const useListData = (listId: number) => {
  const [list, setList] = useState<ListItemData | undefined>(undefined);
  const manager = ListStateManager.getInstance();

  useEffect(() => {
    // Initialize with current state
    const initializeList = async () => {
      const currentList = await manager.getList(listId);
      setList(currentList);
    };
    initializeList();

    // Subscribe to changes for this specific list
    const unsubscribe = manager.subscribeToList(listId, async () => {
      const updatedList = await manager.getList(listId);
      setList(updatedList);
    });

    // Return a function to unsubscribe from the list so that the hook can be unmounted
    return unsubscribe;
  }, [manager, listId]);

  const updateList = useCallback(async (items: ListChildData[]) => {
    return manager.setList(listId, items);
  }, [manager, listId]);

  const updateItem = useCallback(async (itemId: number, updates: Partial<ListChildData>) => {
    return manager.updateListItem(listId, itemId, updates);
  }, [manager, listId]);

  const addItem = useCallback(async (item: ListChildData, insertIndex?: number) => {
    return manager.addItem(listId, item, insertIndex);
  }, [manager, listId]);

  const removeItem = useCallback(async (itemId: number) => {
    return manager.removeItem(listId, itemId);
  }, [manager, listId]);

  return {
    list,
    updateList,
    updateItem,
    addItem,
    removeItem,
  };
};

// Global list management hook for operations that affect all lists
export const useListManager = () => {
  const manager = ListStateManager.getInstance();

  const addList = useCallback(async (id: number) => {
    return manager.addList(id);
  }, [manager]);

  const removeList = useCallback(async (listId: number) => {
    return manager.removeList(listId);
  }, [manager]);

  const getAllLists = useCallback(async () => {
    return manager.lists;
  }, [manager]);

  const moveItem = useCallback(async (fromListId: number, toListId: number, itemId: number, targetIndex?: number) => {
    return manager.moveItem(fromListId, toListId, itemId, targetIndex);
  }, [manager]);

  return {
    addList,
    removeList,
    getAllLists,
    moveItem,
  };
};
