import React, { useState } from "react";
import { ListDocument } from "./list-document";
import { useListsData } from "./lists-data-hook";
import { Link } from "react-router-dom";

export const ListThing = () => {
  return <ListList />;
};

export const ListList = () => {
  const [newListName, setNewListName] = useState("");
  const { lists, addList } = useListsData();

  return <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
    <div>
      <input type="text" value={newListName} onChange={(e) => setNewListName(e.target.value)} />
      <button onClick={() => addList({ name: newListName })}>Add List</button>
    </div>
    <div>
      {
        lists?.map((list) => (
          <div key={list.id}>
            <Link to={`/list-thing/${list.id}`}>{list.name}</Link>
          </div>
        ))
      }
    </div>
  </div>
};