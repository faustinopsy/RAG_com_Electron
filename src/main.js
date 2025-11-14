import { app, BrowserWindow, ipcMain, nativeTheme, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import started from 'electron-squirrel-startup';

import { initializeRAG, ingestPDF } from './ragManager'; 

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// ----------------------------------------------

if (started) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 600,
    transparent: false,
    alwaysOnTop: false,
    resizable: true,
    fullscreen: false,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), 
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  //mainWindow.webContents.openDevTools();
};

app.whenReady().then(async () => { // <-- Tornar async
  
  await initializeRAG();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  ipcMain.handle('dark-mode:toggle', () => {
    if (nativeTheme.shouldUseDarkColors) {
      nativeTheme.themeSource = 'light'
    } else {
      nativeTheme.themeSource = 'dark'
    }
    return nativeTheme.shouldUseDarkColors
  })

  ipcMain.handle('dark-mode:system', () => {
    nativeTheme.themeSource = 'system'
  })

  ipcMain.handle('get-version', (event) => {
    return app.getVersion(); 
  });

  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Documentos PDF', extensions: ['pdf'] }]
    });
    if (!canceled) {
      return filePaths[0];
    }
    return null;
  });

  ipcMain.handle('rag:ingestPDF', async (event, filePath) => {
    console.log(`[Main] Recebido pedido de ingestão para: ${filePath}`);
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, message: 'Caminho do arquivo inválido.' };
    }
    const result = await ingestPDF(filePath); 
    return result;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});