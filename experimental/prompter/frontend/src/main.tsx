import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import { BrowserRouter, Link, Outlet, Route, Routes } from "react-router-dom";
import { Prompt } from "./prompt";
import { HashRouter } from "react-router-dom";

const Layout = () => {
  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #eee',
        backgroundColor: 'white'
      }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#333' }}>Home</Link>
        <span style={{ margin: '0 10px', color: '#ccc' }}>|</span>
        <Link to="/settings" style={{ textDecoration: 'none', color: '#333' }}>Settings</Link>
      </div>
      <div style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative'
      }}>
        <Outlet />
      </div>
    </div>
  );
};

const Settings = () => {
  return (
    <>
      <div>Settings</div>
    </>
  );
}

const Main = () => {
  return (
    <>
      <Prompt />
    </>
  );
};

const App = () => {
  // Note that the browser router doesn't work in Electron.
  // Suggestion was to use HashRouter.
  // https://stackoverflow.com/questions/36505404/how-to-use-react-router-with-electron
  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Main />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </>
  );
};

const root = document.getElementById('root');
if (!root) {
  throw new Error("failed to find root element");
}
ReactDOM.createRoot(root).render(<App />);
