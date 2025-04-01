const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const isDev = require('electron-is-dev');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true
    }
  });

  const startUrl = isDev ?
    `http://localhost:8101` : // For development with webpack dev server
    `file://${path.join(__dirname, '../dist/frontend/index.html')}`; // For production
  win.loadURL(startUrl);
}

app.whenReady().then(() => {
  ipcMain.handle('ping', () => {
    return 'pong';
  });

  ipcMain.handle('echo', (_event, message) => {
    return `echo ${message}`;
  });

  ipcMain.handle('async-echo', async (_event, message) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`echo ${message}`);
      }, 3000);
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

