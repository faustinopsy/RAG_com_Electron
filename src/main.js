import { app, BrowserWindow, ipcMain, nativeTheme  } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import started from 'electron-squirrel-startup';
import { initializeRAG, ingestPDF } from './ragManager.js';
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 600,
    transparent: false,
    alwaysOnTop: true,
    resizable: true,
    fullscreen: false,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname,'./src/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  
  mainWindow.loadFile(path.join(__dirname,`../index.html`));
  

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();
  
};

app.whenReady().then(async() => {
  await initializeRAG();
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

ipcMain.handle('rag:ingestPDF', async (event, filePath) => {
  console.log(`Recebido pedido de ingestão para: ${filePath}`);

  // Validação básica
  if (!filePath || typeof filePath !== 'string') {
    return { success: false, message: 'Caminho do arquivo inválido.' };
  }

  // Chama a função do nosso "cérebro"
  const result = await ingestPDF(filePath);
  return result;
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

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
