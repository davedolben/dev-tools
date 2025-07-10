import { useState, useEffect, useCallback } from "react";

const initialLists = [
  {
    id: 100,
    items: [
      { id: 101, name: "Item 100", numChildren: 3 },
      { id: 2, name: "Item 2" },
      { id: 3, name: "Item 3" },
    ],
  },
  {
    id: 101,
    items: [
      { id: 4, name: "Item 4" },
      { id: 102, name: "Item 102", numChildren: 3 },
      { id: 6, name: "Item 6" },
    ],
  },
  {
    id: 102,
    items: [
      { id: 7, name: "Item 7" },
      { id: 8, name: "Item 8" },
      { id: 9, name: "Item 9" },
    ],
  },
];

export type ListItemData = {
  id: number;
  name: string;
  numChildren?: number;
};

export type ListData = {
  id: number;
  items: ListItemData[];
};

// Shared state manager class
class ListStateManager {
  private static instance: ListStateManager;
  private listeners: Map<number, Set<() => void>> = new Map();
  private _lists: ListData[] = initialLists;

  private constructor() {}

  static getInstance(): ListStateManager {
    if (!ListStateManager.instance) {
      ListStateManager.instance = new ListStateManager();
    }
    return ListStateManager.instance;
  }

  get lists(): ListData[] {
    return this._lists;
  }

  async getList(listId: number): Promise<ListData | undefined> {
    return this._lists.find(list => list.id === listId);
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
    
    // Find all items across all lists that reference this list
    this._lists.forEach(list => {
      list.items.forEach(item => {
        if (item.id === listId) {
          item.numChildren = numChildren;
        }
      });
    });
  }

  async setList(listId: number, items: ListItemData[]): Promise<void> {
    const listIndex = this._lists.findIndex(list => list.id === listId);
    if (listIndex !== -1) {
      this._lists[listIndex] = { ...this._lists[listIndex], items };
      this.updateNumChildrenForList(listId);
      this.notifyListListeners(listId);
    }
  }

  async addList(list: ListData): Promise<void> {
    this._lists.push(list);
    this.updateNumChildrenForList(list.id);
    // Notify any existing listeners for this list
    this.notifyListListeners(list.id);
  }

  async removeList(listId: number): Promise<void> {
    this._lists = this._lists.filter(list => list.id !== listId);
    // Clean up listeners for the removed list
    this.listeners.delete(listId);
  }

  async updateListItem(listId: number, itemId: number, updates: Partial<ListItemData>): Promise<void> {
    const listIndex = this._lists.findIndex(list => list.id === listId);
    if (listIndex !== -1) {
      const itemIndex = this._lists[listIndex].items.findIndex(item => item.id === itemId);
      if (itemIndex !== -1) {
        this._lists[listIndex].items[itemIndex] = { ...this._lists[listIndex].items[itemIndex], ...updates };
        this.updateNumChildrenForList(listId);
        this.notifyListListeners(listId);
      }
    }
  }

  async addItem(listId: number, item: ListItemData): Promise<void> {
    const listIndex = this._lists.findIndex(list => list.id === listId);
    if (listIndex !== -1) {
      this._lists[listIndex].items.push(item);
      this.updateNumChildrenForList(listId);
      this.notifyListListeners(listId);
    }
  }

  async removeItem(listId: number, itemId: number): Promise<void> {
    const listIndex = this._lists.findIndex(list => list.id === listId);
    if (listIndex !== -1) {
      this._lists[listIndex].items = this._lists[listIndex].items.filter(item => item.id !== itemId);
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
        const [movedItem] = fromList.items.splice(itemIndex, 1);
        
        // Add item to destination list at specific index or at the end
        if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= this._lists[toListIndex].items.length) {
          this._lists[toListIndex].items.splice(targetIndex, 0, movedItem);
        } else {
          this._lists[toListIndex].items.push(movedItem);
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
  const [list, setList] = useState<ListData | undefined>(undefined);
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

  const updateList = useCallback(async (items: ListItemData[]) => {
    return manager.setList(listId, items);
  }, [manager, listId]);

  const updateItem = useCallback(async (itemId: number, updates: Partial<ListItemData>) => {
    return manager.updateListItem(listId, itemId, updates);
  }, [manager, listId]);

  const addItem = useCallback(async (item: ListItemData) => {
    return manager.addItem(listId, item);
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

  const addList = useCallback(async (list: ListData) => {
    return manager.addList(list);
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
