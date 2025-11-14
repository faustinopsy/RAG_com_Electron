import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  ingestPDF: (filePath) => {
    return ipcRenderer.invoke('rag:ingestPDF', filePath);
  },
  toggleDarkMode: () => {
    return ipcRenderer.invoke('dark-mode:toggle');
  },
  openFile: () => {
    return ipcRenderer.invoke('dialog:openFile');
  }

});