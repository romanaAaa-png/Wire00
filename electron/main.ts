import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Read setup.ini
  const setupIniPath = 'C:\\DoubleTunnel\\setup.ini';
  try {
    if (fs.existsSync(setupIniPath)) {
      const setupIniContent = fs.readFileSync(setupIniPath, 'utf-8');
      console.log('setup.ini read successfully');
      // You can send this to the renderer via IPC if needed
    }
  } catch (err) {
    console.error('Error reading setup.ini:', err);
  }

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
