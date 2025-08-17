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
  private _lists: Map<number, ListItemData> = new Map();
  private listId: number | undefined;

  // Deprecated.
  private deprecatedLists: ListItemData[] = initialLists;

  private constructor(listId: number) {
    this.listId = listId;
  }

  static getInstance(listId: number): ListStateManager {
    if (!ListStateManager.instance) {
      ListStateManager.instance = new ListStateManager(listId);
    }
    if (ListStateManager.instance.listId !== listId) {
      throw new Error(`ListStateManager already initialized with a different listId ${ListStateManager.instance.listId}`);
    }
    return ListStateManager.instance;
  }

  get lists(): ListItemData[] {
    return this.deprecatedLists;
  }

  async getListItem(itemId: number): Promise<ListItemData | undefined> {
    let data: ListItemData | undefined;
    if (itemId === -1) {
      const response = await fetch(`/api/lists/list/${this.listId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch list ${this.listId}: ${response.statusText}`);
      }
      data = await response.json();
    } else {
      const response = await fetch(`/api/lists/list/${this.listId}/item/${itemId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch item ${itemId} from list ${this.listId}: ${response.statusText}`);
      }
      data = await response.json();
    }

    if (!data) {
      throw new Error(`Failed to fetch item ${itemId} from list ${this.listId}`);
    }

    if (!data?.items) {
      // The API returns null if there are no items, and it's annoying to get Go
      // to return an empty array (maybe not?).
      data.items = [];
    }
    this._lists.set(itemId, data);
    return data;
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

  private notifyItemListeners(itemId: number): void {
    const itemListeners = this.listeners.get(itemId);
    if (itemListeners) {
      itemListeners.forEach(listener => listener());
    }
  }

  // Helper method to update numChildren for items that reference a specific list
  private updateNumChildrenForList(listId: number): void {
    const targetList = this.deprecatedLists.find(list => list.id === listId);
    if (!targetList) return;

    const numChildren = targetList.items.length;
    
    let found: number | undefined;

    // Find all items across all lists that reference this list
    this.deprecatedLists = this.deprecatedLists.map(list => {
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
      this.notifyItemListeners(found);
    }
  }

  async setList(listId: number, items: ListChildData[]): Promise<void> {
    const listIndex = this.deprecatedLists.findIndex(list => list.id === listId);
    if (listIndex !== -1) {
      this.deprecatedLists[listIndex] = { ...this.deprecatedLists[listIndex], items };
      this.updateNumChildrenForList(listId);
      this.notifyItemListeners(listId);
    }
  }

  async addList(id: number): Promise<void> {
    // If the list already exists, return.
    if (this.deprecatedLists.find(l => l.id === id)) {
      return;
    }

    const newList = await this.getListItem(id);
    if (!newList) {
      throw new Error(`Item ${id} not found in any list`);
    }

    this.deprecatedLists.push(newList);
    this.updateNumChildrenForList(id);
    // Notify any existing listeners for this list
    this.notifyItemListeners(id);
  }

  async removeList(listId: number): Promise<void> {
    this.deprecatedLists = this.deprecatedLists.filter(list => list.id !== listId);
    // Clean up listeners for the removed list
    this.listeners.delete(listId);
  }

  async updateListItem(parentId: number, itemId: number, updates: Pick<ListChildData, "name">): Promise<void> {
    const response = await fetch(`/api/lists/list/${this.listId}/item/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: updates.name,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update item ${itemId}: ${response.statusText}`);
    }

    // Update the item in the cache (note that this will really only do something if the item is a list).
    await this.getListItem(itemId);
    // Also update the parent list in the cache.
    await this.getListItem(parentId);
    // Notify any listeners that the item has changed.
    this.notifyItemListeners(itemId);
    this.notifyItemListeners(parentId);
  }

  private async updateItemChildren(item: ListItemData): Promise<void> {
    const url = item.id === -1 ? `/api/lists/list/${this.listId}` : `/api/lists/list/${this.listId}/item/${item.id}`;
    const response = await fetch(url, {
      method: "PUT",
      body: JSON.stringify({
        name: item.name,
        items: item.items.map(item => item.id),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update item children for ${item.id}: ${response.statusText}`);
    }

    // Update the item in the cache.
    await this.getListItem(item.id);
    // Notify any listeners that the item has changed.
    this.notifyItemListeners(item.id);
  }

  async addItem(parentId: number, item: Omit<ListChildData, "id">, insertIndex?: number): Promise<void> {
    console.log("addItem", parentId, item, insertIndex);

    // Find the parent list.
    const parentList = this._lists.get(parentId);
    if (!parentList) {
      throw new Error(`List ${parentId} not found`);
    }

    // Make sure the ID and children are zeroed out.
    const toInsert: ListChildData = {
      id: 0,
      name: item.name,
    };

    let newItems: ListChildData[] = [];

    if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= parentList.items.length) {
      // Insert at specific position
      newItems = [
        ...parentList.items.slice(0, insertIndex),
        toInsert,
        ...parentList.items.slice(insertIndex)
      ];
    } else {
      // Add to end
      newItems = [...parentList.items, toInsert];
    }

    await this.updateItemChildren({
      id: parentId,
      name: parentList.name,
      items: newItems,
    });
  }

  async removeItem(listId: number, itemId: number): Promise<void> {
    const listIndex = this.deprecatedLists.findIndex(list => list.id === listId);
    if (listIndex !== -1) {
      this.deprecatedLists[listIndex] = {
        ...this.deprecatedLists[listIndex],
        items: this.deprecatedLists[listIndex].items.filter(item => item.id !== itemId)
      };
      this.updateNumChildrenForList(listId);
      this.notifyItemListeners(listId);
    }
  }

  async moveItem(fromListId: number, toListId: number, itemId: number, targetIndex?: number): Promise<void> {
    const fromListIndex = this.deprecatedLists.findIndex(list => list.id === fromListId);
    const toListIndex = this.deprecatedLists.findIndex(list => list.id === toListId);
    
    if (fromListIndex !== -1 && toListIndex !== -1) {
      const fromList = this.deprecatedLists[fromListIndex];
      const itemIndex = fromList.items.findIndex(item => item.id === itemId);
      
      if (itemIndex !== -1) {
        // Remove item from source list
        const movedItem = fromList.items[itemIndex];
        this.deprecatedLists[fromListIndex] = {
          ...this.deprecatedLists[fromListIndex],
          items: fromList.items.filter(item => item.id !== itemId)
        };
        
        // Add item to destination list at specific index or at the end
        if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= this.deprecatedLists[toListIndex].items.length) {
          this.deprecatedLists[toListIndex] = {
            ...this.deprecatedLists[toListIndex],
            items: [
              ...this.deprecatedLists[toListIndex].items.slice(0, targetIndex),
              movedItem,
              ...this.deprecatedLists[toListIndex].items.slice(targetIndex)
            ]
          };
        } else {
          this.deprecatedLists[toListIndex] = {
            ...this.deprecatedLists[toListIndex],
            items: [...this.deprecatedLists[toListIndex].items, movedItem]
          };
        }
        
        // Update numChildren for both lists
        this.updateNumChildrenForList(fromListId);
        this.updateNumChildrenForList(toListId);
        
        // Notify listeners for both lists
        this.notifyItemListeners(fromListId);
        this.notifyItemListeners(toListId);
      }
    }
  }
}

export const useListData = (listId: number, parentId: number) => {
  const [list, setList] = useState<ListItemData | undefined>(undefined);
  const manager = ListStateManager.getInstance(listId);

  useEffect(() => {
    // Initialize with current state
    const initializeList = async () => {
      const currentList = await manager.getListItem(parentId);
      setList(currentList);
    };
    initializeList();

    // Subscribe to changes for this specific list
    const unsubscribe = manager.subscribeToList(parentId, async () => {
      const updatedList = await manager.getListItem(parentId);
      setList(updatedList);
    });

    // Return a function to unsubscribe from the list so that the hook can be unmounted
    return unsubscribe;
  }, [manager, parentId]);

  const updateList = useCallback(async (items: ListChildData[]) => {
    return manager.setList(parentId, items);
  }, [manager, parentId]);

  const updateItem = useCallback(async (parentId: number, itemId: number, updates: Pick<ListChildData, "name">) => {
    return manager.updateListItem(parentId, itemId, updates);
  }, [manager, parentId]);

  const addItem = useCallback(async (item: ListChildData, insertIndex?: number) => {
    return manager.addItem(parentId, item, insertIndex);
  }, [manager, parentId]);

  const removeItem = useCallback(async (itemId: number) => {
    return manager.removeItem(itemId, itemId);
  }, [manager, parentId]);

  return {
    list,
    updateList,
    updateItem,
    addItem,
    removeItem,
  };
};

// Global list management hook for operations that affect items across the list hierarchy
export const useListManager = (listId: number) => {
  const manager = ListStateManager.getInstance(listId);

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
