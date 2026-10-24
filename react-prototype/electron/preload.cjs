'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Only one narrowly-scoped IPC function; raw ipcRenderer, paths and file APIs stay private.
contextBridge.exposeInMainWorld('omsiPreview', Object.freeze({
  mode: 'read-only',
  capabilities: Object.freeze({
    readGameFiles: false,
    inspectDirectories: true,
    installMods: false,
    uninstallMods: false,
    executeCommands: false
  }),
  inspectGame: (gameId) => ipcRenderer.invoke('preview:inspect-game', gameId)
}));
