'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Use the limited process object exposed to sandboxed Electron preloads.
// Only publish a coarse OS family, never process.env, paths, usernames or APIs.
const operatingSystem=process.platform==='win32'?'windows':
  process.platform==='linux'?'linux':'unsupported';
// The same renderer supports both packaged desktop builds.
contextBridge.exposeInMainWorld('omsiPreview', Object.freeze({
  mode: 'read-only',
  runtime: Object.freeze({
    operatingSystem,
    platformSelection: 'automatic',
    gameOperations: 'disabled'
  }),
  capabilities: Object.freeze({
    readGameFiles: false,
    inspectDirectories: true,
    installMods: false,
    uninstallMods: false,
    executeCommands: false
  }),
  inspectGame: (gameId) => ipcRenderer.invoke('preview:inspect-game', gameId)
}));
