const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
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

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      console.log(`IPC: read-file requested for path: ${filePath}`);
      if (!fs.existsSync(filePath)) {
        console.warn(`IPC: File not found: ${filePath}`);
        return { error: 'File not found' };
      }
      const data = fs.readFileSync(filePath, 'utf8');
      console.log(`IPC: Successfully read ${data.length} characters from ${filePath}`);
      return { data };
    } catch (err) {
      console.error(`IPC: Error reading file ${filePath}: ${err.message}`);
      return { error: err.message };
    }
  });

  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Configuration Files', extensions: ['ini', 'txt'] }]
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('fix-windows-blocking', async () => {
    return new Promise((resolve) => {
      const appPath = app.getAppPath();
      const folderPath = path.dirname(appPath);
      // This command requires admin privileges to work correctly
      const command = `powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList 'Add-MpPreference -ExclusionPath \\"${folderPath}\\"'"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true });
        }
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
