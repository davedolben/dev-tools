import React from "react";

export type ListItemData = {
  id: number;
  name: string;
};

export type ListProps = {
  name: string;
  items: ListItemData[];
};

export const List = ({ name, items }: ListProps) => {
  return (
    <div>
      <h1>{name}</h1>
      {items.map((item) => (
        <ListItem data={item} />
      ))}
    </div>
  );
};

type ListItemProps = {
  data: ListItemData;
};

const ListItem = ({ data }: ListItemProps) => {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("text/plain", data.id.toString());
  };

  return (
    <div
      style={{
        cursor: "grab",
        padding: "4px 8px",
        border: "1px solid #ccc",
        borderRadius: "4px",
        marginBottom: "4px",
      }}
      draggable
      onDragStart={handleDragStart}
    >
      {data.name}
    </div>
  );
};