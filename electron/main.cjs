const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'AirflowMigrator AI',
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    backgroundColor: '#0d1117',
  });

  // Load the built app
  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
