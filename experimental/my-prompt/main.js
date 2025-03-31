const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true
    }
  });

  //win.loadFile('index.html');
  win.loadURL(`file://${path.join(__dirname, 'dist/frontend/index.html')}`);
  //win.loadURL(`http://localhost:8101`);
}

app.whenReady().then(() => {
  ipcMain.handle('ping', () => {
    return 'pong';
  });

  ipcMain.handle('echo', (_event, message) => {
    return `echo ${message}`;
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

