'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { SECURE_WEB_PREFERENCES, DEV_URL, isAllowedTopLevelURL } = require('./security-policy.cjs');
const { requireGameId, inspectGameDirectory } = require('./game-inspection.cjs');
// At most one native folder dialog per renderer at a time.
const activeInspections = new Set();

function createWindow() {
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  const isDevelopment = process.env.OMSI_MANAGER_DEV_PREVIEW === '1';
  const approvedURL = isDevelopment ? DEV_URL : pathToFileURL(indexPath).href;

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 850,
    minHeight: 600,
    backgroundColor: '#101115',
    show: false,
    autoHideMenuBar: true,
    title: 'OMSI Manager · Prévia segura',
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: path.join(__dirname, 'preload.cjs'),
      devTools: isDevelopment
    }
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, targetURL) => {
    if (!isAllowedTopLevelURL(targetURL, approvedURL)) event.preventDefault();
  });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.session.on('will-download', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, respond) => respond(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
  win.once('ready-to-show', () => win.show());

  if (isDevelopment) {
    void win.loadURL(DEV_URL);
  } else {
    void win.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  ipcMain.handle('preview:inspect-game', async (event, gameId) => {
    // Renderer chooses only a game identifier. The native dialog owns folder choice.
    requireGameId(gameId);
    const win = BrowserWindow.fromWebContents(event.sender);
    const expectedURL = process.env.OMSI_MANAGER_DEV_PREVIEW === '1'
      ? DEV_URL : pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href;
    if (!win || win.isDestroyed() || !event.senderFrame ||
        event.senderFrame !== event.sender.mainFrame ||
        !isAllowedTopLevelURL(event.senderFrame.url, expectedURL)) {
      throw new Error('Origem da inspeção não autorizada.');
    }
    // Defend against parallel IPC requests that could spawn multiple native dialogs.
    const senderId = event.sender.id;
    if (activeInspections.has(senderId))
      return { status: 'error', message: 'Já existe uma inspeção em andamento.' };
    activeInspections.add(senderId);
    try {
      const choice = await dialog.showOpenDialog(win, {
        title: 'Selecione a pasta do jogo (somente leitura)',
        properties: ['openDirectory', 'dontAddToRecent']
      });
      if (choice.canceled || choice.filePaths.length !== 1)
        return { status: 'cancelled' };
      try {
        return await inspectGameDirectory(choice.filePaths[0], gameId);
      } catch {
        // Do not send absolute paths, file names, or filesystem errors to renderer.
        return { status: 'error', message: 'Não foi possível inspecionar essa pasta.' };
      }
    } finally {
      activeInspections.delete(senderId);
    }
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
