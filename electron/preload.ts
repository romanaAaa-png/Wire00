import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Add IPC communication here
});
