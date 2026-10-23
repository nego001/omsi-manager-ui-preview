'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow } = require('electron');
const { SECURE_WEB_PREFERENCES, DEV_URL, isAllowedTopLevelURL } = require('./security-policy.cjs');

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
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
