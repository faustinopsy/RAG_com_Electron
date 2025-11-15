import { app, BrowserWindow, ipcMain, nativeTheme, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

import { initializeRAG, ingestPDF, askRAG, getAllVectors3D, getCachedPlotData } from './ragManager'; 

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

function createVectorWindow() {
  const vectorWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Visualizador de Vetores 3D',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js') // Reutiliza o mesmo preload
    }
  });

  // Carrega um NOVO ficheiro HTML que vamos criar
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // Aponta para um novo 'entry point' do Vite
    vectorWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/vector.html`);
  } else {
    vectorWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/vector.html`));
  }
}

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

  ipcMain.handle('rag:ask', async (event, question) => {
    console.log(`[Main] Recebida pergunta: ${question}`);

    if (!question || typeof question !== 'string') {
      return 'Pergunta inválida.';
    }

    // Chama a função "pensar" do nosso cérebro
    const answer = await askRAG(question);
    return answer;
  });

  ipcMain.handle('rag:ingestPDF', async (event, filePath) => {
    console.log(`[Main] Recebido pedido de ingestão para: ${filePath}`);
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, message: 'Caminho do arquivo inválido.' };
    }
    const result = await ingestPDF(filePath); 
    return result;
  });

  ipcMain.handle('get-vector-data', () => {
  // Retorna instantaneamente os dados da cache (que estão em background)
  const data = getCachedPlotData();
  if (data === null) {
    // Se o cálculo ainda não terminou, pede para esperar
    throw new Error('Os dados 3D ainda estão a ser calculados. Tente novamente daqui a um momento.');
  }
  return data;
});

// ipcMain.handle('get-vector-data', async () => {
//     return await getAllVectors3D();
//   });
  // Handler para ABRIR a nova janela
  ipcMain.handle('open-vector-window', () => {
    createVectorWindow();
  });

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});