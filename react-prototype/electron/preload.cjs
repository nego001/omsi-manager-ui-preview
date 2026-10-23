'use strict';
const { contextBridge } = require('electron');

// Intentionally no ipcRenderer, filesystem, shell, process or installer bridge.
contextBridge.exposeInMainWorld('omsiPreview', Object.freeze({
  mode: 'read-only',
  capabilities: Object.freeze({
    readGameFiles: false,
    installMods: false,
    uninstallMods: false,
    executeCommands: false
  })
}));
