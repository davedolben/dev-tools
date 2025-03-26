const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ping: () => {
    return ipcRenderer.invoke('ping');
  },
  echo: (message) => {
    return ipcRenderer.invoke('echo', message);
  },
});
