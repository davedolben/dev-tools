import React from "react";
import { List } from "./list";

const items = [
  { id: 1, name: "Item 1" },
  { id: 2, name: "Item 2" },
  { id: 3, name: "Item 3" },
];

export const ListThing = () => {
  return (
    <div style={{ padding: "10px 16px" }}>
      <List name="List 1" items={items} />
    </div>
  );
};