import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import { BrowserRouter, Link, Outlet, Route, Routes } from "react-router-dom";
import CalendarPage from "./calendar/index";
import { CommanderPage } from "./commander/commander-page";
import { ListThing } from "./list-thing/index";

const Layout = () => {
  return (
    <>
      <div>
        <div className="nav-bar">
          <Link to="/">Home</Link>
          <span> | </span>
          <Link to="/calendar">Calendar</Link>
          <span> | </span>
          <Link to="/commander">Commander</Link>
          <span> | </span>
          <Link to="/list-thing">List Thing</Link>
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
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/commander" element={<CommanderPage />} />
            <Route path="/list-thing" element={<ListThing />} />
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
