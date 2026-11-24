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
const { discoverSteam } = require('./steam-discovery.cjs');
const { locateTruckMod } = require('./truck-mod-locator.cjs');
const { createCandidateStore, preferenceFor, isPreference } = require('./steam-candidate-store.cjs');
const steamCandidates=createCandidateStore();
const { discoverCustomOmsi, discoverCustomGame } = require('./custom-omsi-discovery.cjs');
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
  ipcMain.handle('preview:inspect-game', async (event, gameId, mode='manual', candidateId) => {
    // Renderer chooses only a game identifier. The native dialog owns folder choice.
    requireGameId(gameId);
    if(mode!=='manual'&&(!(['discover-steam','list-steam','choose-steam','remember-steam'].includes(mode)||(['discover-custom-truck','locate-truck-mod'].includes(mode)&&['ets2','ats'].includes(gameId))||(['locate-omsi-steam','locate-custom-omsi'].includes(mode)&&gameId==='omsi'))||!['linux','win32'].includes(process.platform)))
      throw new Error('Modo de localização inválido.');
    const win = BrowserWindow.fromWebContents(event.sender);
    const expectedURL = isDevelopment
      ? DEV_URL : pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href;
    const originalFrame = event.senderFrame;
    const documentEpoch = documentEpochs.get(event.sender);
    const documentProof = documentEpoch?.snapshot();
    const documentSignal = documentEpoch?.signalFor(documentProof);
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
      // Explicit locate action only. Candidate is a native dialog hint,
      // never an inspection grant or a path returned to the renderer.
      let hint=null;
      let title='Selecione a pasta do jogo (somente leitura)';
      if(mode==='locate-truck-mod'){
        try{
          hint=await locateTruckMod(gameId,{
            platform:process.platform,
            home:app.getPath('home'),
            documents:process.platform==='win32'?app.getPath('documents'):undefined
          },documentSignal);
          if(!senderAuthorized())return {status:'error',message:'Origem da inspeção não autorizada.'};
          if(!hint)return {status:'error',message:'Pasta de mods não localizada no local padrão. Use a seleção manual.'};
          title='Confirme a pasta de mods candidata (somente leitura)';
        }catch{return {status:'error',message:'Busca de pasta de mods inconclusiva. Use a seleção manual.'};}
      }
      if(mode==='discover-custom-truck'){
        // Only the scope picker is required for candidate counts. Never send
        // paths to the renderer or issue an inspection grant for a truck root.
        const scope=await requestNativeDirectory(()=>dialog.showOpenDialog(win,{
          title:'Escolha uma pasta para procurar a instalação do simulador',
          properties:['openDirectory','dontAddToRecent']
        }));
        if(!senderAuthorized())return {status:'error',message:'Origem da inspeção não autorizada.'};
        if(scope.status==='cancelled')return {status:'cancelled'};
        if(scope.status!=='selected')return {status:'error',message:'Não foi possível abrir o seletor de pastas.'};
        try{
          const result=await discoverCustomGame(scope.selectedPath,gameId,documentSignal);
          if(!senderAuthorized())return {status:'error',message:'Origem da inspeção não autorizada.'};
          return {status:'custom-discovery',count:result.matches.length,limited:result.limited};
        }catch{return {status:'error',message:'Busca inconclusiva. Escolha uma pasta acessível mais específica.'};}
      }
      if(mode==='locate-custom-omsi'){
        // First picker authorizes only bounded metadata search in its scope.
        const scope=await requestNativeDirectory(()=>dialog.showOpenDialog(win,{
          title:'Escolha uma pasta ou unidade montada para procurar OMSI 2',
          properties:['openDirectory','dontAddToRecent']
        }));
        if(!senderAuthorized())return {status:'error',message:'Origem da inspeção não autorizada.'};
        if(scope.status==='cancelled')return {status:'cancelled'};
        if(scope.status!=='selected')return {status:'error',message:'Não foi possível abrir o seletor de pastas.'};
        try{
          const result=await discoverCustomOmsi(scope.selectedPath,documentSignal);
          if(!senderAuthorized())return {status:'error',message:'Origem da inspeção não autorizada.'};
          if(result.limited)return {status:'error',message:'Busca parcial: limite atingido. Escolha uma pasta mais específica.'};
          if(result.matches.length!==1)return {status:'error',message:result.matches.length===0?
            'Nenhuma candidata na pasta consultada. Tente outra pasta.':
            'Mais de uma candidata encontrada. Use a seleção manual.'};
          hint=result.matches[0];
          title='Confirme a pasta candidata do OMSI 2 (somente leitura)';
        }catch{return {status:'error',message:'Busca inconclusiva. Escolha uma pasta acessível mais específica.'};}
      }
      if(mode==='choose-steam'||mode==='remember-steam'){
        hint=steamCandidates.resolve(event.sender,documentProof,gameId,candidateId);
        if(!hint)return {status:'error',message:'Candidata expirada. Detecte novamente.'};
        try{
          const current=await discoverSteam(gameId,{
            home:app.getPath('home'),platform:process.platform,
            programFiles:[process.env['ProgramFiles(x86)'],process.env.ProgramFiles]
          },documentSignal);
          if(!senderAuthorized()||!current.includes(hint)){
            steamCandidates.clear(event.sender,gameId);
            return {status:'error',message:'Candidata indisponível. Detecte novamente.'};
          }
        }catch{
          steamCandidates.clear(event.sender,gameId);
          return {status:'error',message:'Busca inconclusiva. Detecte novamente.'};
        }
        title='Confirme a instalação Steam candidata (somente leitura)';
      }
      if(mode==='locate-omsi-steam'||mode==='discover-steam'||mode==='list-steam'){
        steamCandidates.clear(event.sender,gameId);
        try{
          const candidates=await discoverSteam(gameId,{
            home:app.getPath('home'),platform:process.platform,
            programFiles:[process.env['ProgramFiles(x86)'],process.env.ProgramFiles]
          },documentSignal);
          if(!senderAuthorized())return {status:'error',message:'Origem da inspeção não autorizada.'};
          if(mode==='discover-steam')return {status:'discovery',count:candidates.length};
          if(mode==='list-steam'){
            const rows=steamCandidates.publish(event.sender,documentProof,gameId,candidates);
            const preferredId=steamCandidates.preferredId(event.sender,documentProof,gameId,candidateId);
            return {status:'candidate-list',candidates:rows,...(isPreference(candidateId)?{preferredId}: {})};
          }
          hint=candidates.length===1?candidates[0]:null;
        }
        catch{return {status:'error',message:'Não foi possível procurar a instalação automaticamente. Tente a seleção manual.'};}
        title=hint?'Confirme a pasta candidata do OMSI 2 (somente leitura)':
          'Localização automática inconclusiva. Selecione a pasta manualmente.';
      }
      if (!senderAuthorized())
        return { status: 'error', message: 'Origem da inspeção não autorizada.' };
      const choice = await requestNativeDirectory(() => dialog.showOpenDialog(win, {
        title,
        ...(hint?{defaultPath:hint}:{}),
        properties: ['openDirectory', 'dontAddToRecent']
      }));
      // Origin and epoch validation always happens after the awaited dialog,
      // even if the native picker failed or supplied a malformed result.
      if (!senderAuthorized())
        return { status: 'error', message: 'Origem da inspeção não autorizada.' };
      if (choice.status === 'cancelled') return { status: 'cancelled' };
      if (choice.status !== 'selected')
        return { status: 'error', message: 'Não foi possível abrir o seletor de pastas.' };
      if(['choose-steam','remember-steam','locate-truck-mod'].includes(mode)&&choice.selectedPath!==hint)
        return {status:'error',message:'A pasta confirmada difere da candidata. Use a seleção manual.'};
      if((mode==='choose-steam'||mode==='remember-steam')&&gameId!=='omsi'){
        const selection={status:'installation-selected',installationVerified:false};
        return mode==='remember-steam'?{status:'remembered-selection',preference:preferenceFor(gameId,hint),selection}:selection;
      }
      try {
        const grant = inspectionGrantGate.issue(choice.selectedPath, gameId, senderId);
        // issue happens only after native user selection. Consume at most once.
        const result = await inspectionGrantGate.inspectOnce(grant, senderId, gameId, documentSignal);
        if (!senderAuthorized())
          return { status: 'error', message: 'Origem da inspeção não autorizada.' };
        if(mode==='remember-steam'&&result.status==='ok')
          return {status:'remembered-selection',preference:preferenceFor(gameId,hint),selection:result};
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
