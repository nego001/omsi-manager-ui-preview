'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { assertSecureMainProcessStartup } = require('./launch-argument-guard.cjs');
// This is the final app-owned boundary before registering IPC or a window.
// It prevents use of a packaged app UI with recognized insecure Chromium
// switches when someone bypasses the official launchers and runs the ELF.
// Electron has already started: this does NOT attest kernel sandbox setup.
try {
  assertSecureMainProcessStartup(process.argv.slice(1), app.commandLine);
} catch {
  console.error('OMSI_MANAGER_UNSAFE_ELECTRON_STARTUP_REFUSED');
  process.exit(3);
}
const { resolvePreviewMode } = require('./preview-mode-policy.cjs');
const { createDocumentEpochGate, shouldInvalidateOnNavigation } = require('./document-epoch-gate.cjs');
// A local dev server must never be a renderer source for a distributed binary.
// This check happens before creating any inspection grant, IPC or window.
let isDevelopment;
try {
  isDevelopment = resolvePreviewMode(app.isPackaged, process.env.OMSI_MANAGER_DEV_PREVIEW);
} catch {
  console.error('OMSI_MANAGER_PACKAGED_DEV_MODE_REFUSED');
  process.exit(3);
}
const { SECURE_WEB_PREFERENCES, DEV_URL, isAllowedTopLevelURL } = require('./security-policy.cjs');
const { requireGameId } = require('./game-inspection.cjs');
const { createInspectionGrantGate } = require('./inspection-grant.cjs');
const { requestNativeDirectory } = require('./native-directory-choice.cjs');
const inspectionGrantGate = createInspectionGrantGate();
// At most one native folder dialog per renderer at a time.
const activeInspections = new Set();
// Main-process-only identity: each window owns a separate document epoch.
const documentEpochs = new WeakMap();

function createWindow() {
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
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

  // Any new top-level document retires IPC authorizations from the old one.
  // Same-document hash/SPA navigation does not rotate the security epoch.
  const documentEpoch = createDocumentEpochGate();
  documentEpochs.set(win.webContents, documentEpoch);
  win.webContents.on('did-start-navigation', details => {
    if (shouldInvalidateOnNavigation(details)) documentEpoch.invalidate();
  });
  win.webContents.on('did-navigate', () => documentEpoch.invalidate());
  // After renderer death, no old proof can become usable on a restarted process.
  win.webContents.on('render-process-gone', () => documentEpoch.revoke());
  win.webContents.on('destroyed', () => documentEpoch.revoke());
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
    const expectedURL = isDevelopment
      ? DEV_URL : pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href;
    const originalFrame = event.senderFrame;
    const documentEpoch = documentEpochs.get(event.sender);
    const documentProof = documentEpoch?.snapshot();
    // Dialog interaction is consent for exactly one scan in this webContents.
    // Re-check origin and frame after the native dialog and after the scan:
    // neither a delayed IPC reply nor a navigation may reuse the selection.
    const senderAuthorized = () => Boolean(
      documentEpoch && documentEpoch.isCurrent(documentProof) &&
      win && !win.isDestroyed() && !event.sender.isDestroyed() &&
      originalFrame && event.senderFrame === originalFrame &&
      event.sender.mainFrame === originalFrame &&
      isAllowedTopLevelURL(originalFrame.url, expectedURL)
    );
    if (!senderAuthorized()) {
      throw new Error('Origem da inspeção não autorizada.');
    }
    // Defend against parallel IPC requests that could spawn multiple native dialogs.
    const senderId = event.sender.id;
    if (activeInspections.has(senderId))
      return { status: 'error', message: 'Já existe uma inspeção em andamento.' };
    activeInspections.add(senderId);
    try {
      const choice = await requestNativeDirectory(() => dialog.showOpenDialog(win, {
        title: 'Selecione a pasta do jogo (somente leitura)',
        properties: ['openDirectory', 'dontAddToRecent']
      }));
      // Origin and epoch validation always happens after the awaited dialog,
      // even if the native picker failed or supplied a malformed result.
      if (!senderAuthorized())
        return { status: 'error', message: 'Origem da inspeção não autorizada.' };
      if (choice.status === 'cancelled') return { status: 'cancelled' };
      if (choice.status !== 'selected')
        return { status: 'error', message: 'Não foi possível abrir o seletor de pastas.' };
      try {
        const grant = inspectionGrantGate.issue(choice.selectedPath, gameId, senderId);
        // issue happens only after native user selection. Consume at most once.
        const result = await inspectionGrantGate.inspectOnce(grant, senderId, gameId);
        if (!senderAuthorized())
          return { status: 'error', message: 'Origem da inspeção não autorizada.' };
        return result;
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
