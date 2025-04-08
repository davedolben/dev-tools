import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import { BrowserRouter, Link, Outlet, Route, Routes } from "react-router-dom";
import Calendar from "./calendar";
import { addDays } from "date-fns";

const Layout = () => {
  return (
    <>
      <div>
        <div>
          <Link to="/">Home</Link>
          <span> | </span>
          <Link to="/calendar">Calendar</Link>
        </div>
        <hr />
        <Outlet />
      </div>
    </>
  );
};

const Main = () => {
  return (
    <>
      <div>hi!</div>
    </>
  );
};

const App = () => {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Main />} />
            <Route path="/calendar" element={<Calendar startDate={new Date()} endDate={addDays(new Date(), 30)} />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
};

const root = document.getElementById('root');
if (!root) {
  throw new Error("failed to find root element");
}
ReactDOM.createRoot(root).render(<App />);
