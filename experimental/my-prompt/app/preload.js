const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ping: () => {
    return ipcRenderer.invoke('ping');
  },
  echo: (message) => {
    return ipcRenderer.invoke('echo', message);
  },
  asyncEcho: (message) => {
    return ipcRenderer.invoke('async-echo', message);
  },
  execute: (command, arguments) => {
    return ipcRenderer.invoke('execute', { command, arguments });
  },
});
