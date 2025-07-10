import { useState } from "react";

const initialLists = [
  {
    id: 1,
    items: [
      { id: 2, name: "Item 1", isList: true },
      { id: 3, name: "Item 2" },
      { id: 4, name: "Item 3" },
    ],
  },
  {
    id: 2,
    items: [
      { id: 5, name: "Item 4" },
      { id: 6, name: "Item 5" },
      { id: 7, name: "Item 6" },
    ],
  },
];

export type ListItemData = {
  id: number;
  name: string;
};

export type ListData = {
  id: number;
  items: ListItemData[];
};

export const useListData = () => {
  const [lists, setLists] = useState<ListData[]>(initialLists);

  return {
    getList: async (listId: number) => lists[listId],
    setList: async (listId: number, list: ListItemData[]) => {
      setLists(prevLists => {
        const newLists = [...prevLists];
        newLists[listId].items = list;
        return newLists;
      });
    },
  };
};
