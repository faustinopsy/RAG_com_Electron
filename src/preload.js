import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  ingestPDF: (filePath) => {
    return ipcRenderer.invoke('rag:ingestPDF', filePath);
  }

});