const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { Client } = require('ssh2');
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    title: "Double Tunnel VPN",
    icon: path.join(__dirname, '../public/icon.png')
  });

  // Simple Context Menu for Cut/Copy/Paste
  win.webContents.on('context-menu', (event, params) => {
    const menu = Menu.buildFromTemplate([
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' }
    ]);
    menu.popup();
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
    // win.webContents.openDevTools(); // Uncomment for debugging if needed
  }
}

app.whenReady().then(() => {
  // SSH IPC Handler
  ipcMain.handle('ssh-execute', async (event, config) => {
    const { host, port, username, password, privateKey, command } = config;
    
    return new Promise((resolve) => {
      const conn = new Client();
      let output = "";
      let errorOutput = "";
      
      conn.on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return resolve({ error: err.message });
          }
          stream
            .on("close", (code, signal) => {
              conn.end();
              resolve({ output, errorOutput, code, signal });
            })
            .on("data", (data) => {
              output += data.toString();
            })
            .stderr.on("data", (data) => {
              errorOutput += data.toString();
            });
        });
      }).on("error", (err) => {
        resolve({ error: err.message });
      }).connect({
        host,
        port: port || 22,
        username,
        password,
        privateKey,
        readyTimeout: 30000,
      });
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
