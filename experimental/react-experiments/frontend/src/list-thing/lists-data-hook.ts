import { useEffect, useState } from "react";

export type ListData = {
  id: number;
  name: string;
};

export const useListsData = () => {
  const [ lists, setLists ] = useState<ListData[]>();

  const fetchLists = async () => {
    const response = await fetch("/api/lists");
    const data = await response.json();
    setLists(data);
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const addList = async (list: Pick<ListData, "name">) => {
    await fetch("/api/lists/list", {
      method: "POST",
      body: JSON.stringify({ name: list.name }),
    });
    fetchLists();
  };

  return { lists, addList };
};