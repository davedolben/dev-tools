import { useState, useEffect, useCallback } from "react";

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

  async getListItem(itemId: number): Promise<ListItemData | undefined> {
    let data: ListItemData | undefined;
    if (itemId === -1) {
      const response = await fetch(`/api/lists/list/${this.listId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch list ${this.listId}: ${response.statusText}`);
      }
      data = await response.json();
      // Make sure the ID is set to -1 (the API will return the list ID here
      // rather than the item ID, which can cause some weirdness).
      data!.id = -1;
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

  async setList(parentId: number, items: ListChildData[]): Promise<void> {
    const parent = this._lists.get(parentId);
    if (!parent) {
      throw new Error(`List ${parentId} not found`);
    }

    await this.updateItemChildren({
      ...parent,
      items,
    });
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

  async addItem(parentId: number, item: ListChildData, insertIndex?: number): Promise<void> {
    console.log("addItem", parentId, item, insertIndex);

    // Find the parent list.
    const parentList = this._lists.get(parentId);
    if (!parentList) {
      throw new Error(`List ${parentId} not found`);
    }

    // Make sure the children are zeroed out.
    const toInsert: ListChildData = {
      id: item.id,
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

  async removeItem(parentId: number, itemId: number): Promise<void> {
    const parent = this._lists.get(parentId);
    if (!parent) {
      throw new Error(`List ${parentId} not found`);
    }

    // For now, we just orphan the item rather than deleting it. We should clean
    // up orphaned items at some point.
    parent.items = parent.items.filter(item => item.id !== itemId);
    await this.updateItemChildren(parent);
  }

  async moveItem(fromParentId: number, toParentId: number, itemId: number, targetIndex?: number): Promise<void> {
    const fromParent = this._lists.get(fromParentId);
    const toParent = this._lists.get(toParentId);
    
    if (fromParent && toParent) {
      const itemIndex = fromParent.items.findIndex(item => item.id === itemId);
      
      if (itemIndex !== -1) {
        const movedItem = fromParent.items[itemIndex];

        // Remove item from source list
        await this.removeItem(fromParentId, itemId);
        
        // Add item to destination list at specific index or at the end
        await this.addItem(toParentId, movedItem, targetIndex);
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
    return manager.addItem(parentId, {
      // Make sure the ID is zero so that the API will generate a new item.
      id: 0,
      name: item.name,
    }, insertIndex);
  }, [manager, parentId]);

  const removeItem = useCallback(async (itemId: number) => {
    return manager.removeItem(parentId, itemId);
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

  const moveItem = useCallback(async (fromListId: number, toListId: number, itemId: number, targetIndex?: number) => {
    return manager.moveItem(fromListId, toListId, itemId, targetIndex);
  }, [manager]);

  return {
    moveItem,
  };
};
