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
  },
  askRAG: (question) => {
    return ipcRenderer.invoke('rag:ask', question);
  },
  getVectorData: () => {
      return ipcRenderer.invoke('get-vector-data');
    },
    // Para a janela PRINCIPAL pedir para abrir a janela 3D
    openVectorWindow: () => {
      return ipcRenderer.invoke('open-vector-window');
    }
});