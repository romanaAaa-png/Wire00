import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  readConfig: () => ipcRenderer.invoke('read-config'),
  writeConfig: (content: string) => ipcRenderer.invoke('write-config', content),
  windowControl: (action: 'minimize' | 'maximize' | 'close') => ipcRenderer.send('window-control', action),
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('write-file', path, content),
  selectFile: () => ipcRenderer.invoke('select-file'),
  sshExecute: (config: unknown) => ipcRenderer.invoke('ssh-execute', config),
  fixWindowsBlocking: () => ipcRenderer.invoke('fix-windows-blocking'),
});
