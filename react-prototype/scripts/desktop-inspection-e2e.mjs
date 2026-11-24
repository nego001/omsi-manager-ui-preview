import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import { _electron as electron } from 'playwright';

// Full end-to-end IPC exercise using an explicitly synthetic directory tree.
// Electron dialog is replaced inside the test process; real user folders are never accessed.
const root=await mkdtemp(join(tmpdir(),'omsi-manager-e2e-'));
let application;
try{
 const sample=join(root,'sample-omsi');
 await mkdir(join(sample,'Vehicles','Bus A'),{recursive:true});
 await mkdir(join(sample,'Vehicles','Bus B'),{recursive:true});
 await mkdir(join(sample,'maps','Sample Map'),{recursive:true});
 await writeFile(join(sample,'Vehicles','Bus A','vehicle.bus'),'DO_NOT_MODIFY', 'utf8');
 const etsSample=join(root,'sample-ets2');
 await mkdir(join(etsSample,'mod','unpacked'),{recursive:true});
 await writeFile(join(etsSample,'mod','heavy_sound.SCS'),'SCS_SENTINEL');
 await writeFile(join(etsSample,'mod','skin.zip'),'ZIP_SENTINEL');
 await writeFile(join(etsSample,'mod','notes.txt'),'TEXT_SENTINEL');
 application=await electron.launch({
  chromiumSandbox:true,
  args:['.'],
  cwd:process.cwd(),
  env:{...process.env,OMSI_MANAGER_DEV_PREVIEW:'0'},
  timeout:60000
 });
 const window=await application.firstWindow();
 await window.getByRole('heading',{name:'Seu universo de simulação, organizado.'}).waitFor({timeout:20000});
 const patch=async({dialog},response)=>{
  dialog.showOpenDialog=async()=>response;
 };
 // M69: real Electron IPC and UI, synthetic Steam home and external library.
 // The test substitutes only app.getPath('home') and the picker in the main
 // process. No discovery request can touch the runner's real Steam folders.
 if(process.platform==='linux'){
  const home=join(root,'m69-home'),steam=join(home,'.local','share','Steam','steamapps');
  const library=join(root,'m69-other-disk'),common=join(library,'steamapps','common');
  const omsi=join(common,'OMSI 2');
  await mkdir(steam,{recursive:true});
  await writeFile(join(steam,'libraryfolders.vdf'),
   '"libraryfolders" { "0" { "path" '+JSON.stringify(library)+' } }');
  await mkdir(join(omsi,'Vehicles','Synthetic Bus'),{recursive:true});
  await mkdir(join(omsi,'maps','Synthetic Map'),{recursive:true});
  await writeFile(join(omsi,'Omsi.exe'),'M69_SYNTHETIC_EXECUTABLE_MARKER');
  for(const [folder,marker] of [
   ['Euro Truck Simulator 2','eurotrucks2'],['American Truck Simulator','amtrucks']
  ]){
   const bin=join(common,folder,'bin','linux_x64');
   await mkdir(bin,{recursive:true});
   await writeFile(join(bin,marker),'M69_SYNTHETIC_EXECUTABLE_MARKER');
  }
  await application.evaluate(({app,dialog},payload)=>{
   const original=app.getPath;
   globalThis.__m69OriginalGetPath=original;
   app.getPath=function(name){return name==='home'?payload.home:original.call(this,name);};
   globalThis.__m69PickerCalls=0;
   globalThis.__m69HintMatches=false;
   dialog.showOpenDialog=async(_window,options)=>{
    globalThis.__m69PickerCalls++;
    globalThis.__m69HintMatches=options.defaultPath===payload.omsi;
    return {canceled:true,filePaths:[]};
   };
  },{home,omsi});
  try{
   for(const game of ['omsi','ets2','ats']){
    const report=await window.evaluate(game=>window.omsiPreview.discoverSteam(game),game);
    assert.deepEqual(report,{status:'discovery',count:1});
   }
   assert.equal(await application.evaluate(()=>globalThis.__m69PickerCalls),0);
   await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Jogos'}).click();
   const detect=window.getByRole('button',{name:'Detectar jogos automaticamente'});
   await detect.click();
   await window.getByText('1 instalação(ões) candidata(s)',{exact:true}).nth(2).waitFor({timeout:15000});
   assert.equal(await window.getByText('1 instalação(ões) candidata(s)',{exact:true}).count(),3);
   await window.getByRole('button',{name:'Detectar jogos automaticamente'}).waitFor({timeout:15000});
   assert.equal(await application.evaluate(()=>globalThis.__m69PickerCalls),0);
   const canceled=await window.evaluate(()=>window.omsiPreview.locateOmsi());
   assert.deepEqual(canceled,{status:'cancelled'});
   assert.deepEqual(await application.evaluate(()=>({
    calls:globalThis.__m69PickerCalls,hint:globalThis.__m69HintMatches
   })),{calls:1,hint:true});
   await application.evaluate(({dialog},folder)=>{
    dialog.showOpenDialog=async(_window,options)=>{
     if(options.defaultPath!==folder)throw Error('M69_EXPECTED_NATIVE_HINT');
     return {canceled:false,filePaths:[folder]};
    };
   },omsi);
   const confirmed=await window.evaluate(()=>window.omsiPreview.locateOmsi());
   assert.equal(confirmed.status,'ok');
   assert.equal(confirmed.groups[0].count,1);
   assert.equal(confirmed.groups[1].count,1);
   assert.equal(confirmed.assessment.installationVerified,false);
   assert.equal(confirmed.provenance.operationsEnabled,false);
   assert.equal(JSON.stringify(confirmed).includes(root),false);
   assert.equal(await readFile(join(omsi,'Omsi.exe'),'utf8'),'M69_SYNTHETIC_EXECUTABLE_MARKER');
   console.log('PASS_M69_ELECTRON_STEAM_DISCOVERY_UI_CONFIRMATION');
  }finally{
   await application.evaluate(({app})=>{
    app.getPath=globalThis.__m69OriginalGetPath;
    delete globalThis.__m69OriginalGetPath;
    delete globalThis.__m69PickerCalls;
    delete globalThis.__m69HintMatches;
   });
  }
 }
 // M65: only disposable targets and a mocked picker are used. Selecting a
 // symlinked ROOT must never authorize a scan or disclose the target path.
 const syntheticRootLink=join(root,'m65-symlinked-root');
 await symlink(etsSample,syntheticRootLink,'dir');
 await application.evaluate(patch,{canceled:false,filePaths:[syntheticRootLink]});
 const rootLinkReply=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.deepEqual(rootLinkReply,{
  status:'error',message:'Não foi possível inspecionar essa pasta.'
 });
 assert.equal(JSON.stringify(rootLinkReply).includes(root),false);
 assert.equal(JSON.stringify(rootLinkReply).includes('m65-symlinked-root'),false);

 // A symbolic link at a KNOWN group location must not be followed to
 // enumerate a different directory. This is a distinct case from root-link.
 const nestedRoot=join(root,'m65-nested-link-test');
 await mkdir(nestedRoot);
 await symlink(etsSample,join(nestedRoot,'Vehicles'),'dir');
 await application.evaluate(patch,{canceled:false,filePaths:[nestedRoot]});
 const nestedReply=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.equal(nestedReply.status,'ok');
 assert.equal(nestedReply.groups[0].key,'vehicles');
 assert.equal(nestedReply.groups[0].found,false);
 assert.equal(nestedReply.groups[0].count,0);
 assert.equal(nestedReply.recognized,false);
 assert.equal(nestedReply.assessment.installationVerified,false);
 assert.ok(nestedReply.notices.some(n=>n.code==='no-known-folders'));
 assert.equal(JSON.stringify(nestedReply).includes(etsSample),false);
 assert.equal(JSON.stringify(nestedReply).includes(root),false);

 // Both link cases must leave the legitimate temporary game folder usable.
 await application.evaluate(patch,{canceled:false,filePaths:[sample]});
 const recoveredLinkScan=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.equal(recoveredLinkScan.status,'ok');
 assert.equal(recoveredLinkScan.groups[0].count,2);
 assert.equal(recoveredLinkScan.groups[1].count,1);
 assert.equal(recoveredLinkScan.provenance.operationsEnabled,false);
 assert.equal(await readFile(join(etsSample,'mod','heavy_sound.SCS'),'utf8'),'SCS_SENTINEL');
 assert.equal(await readFile(join(sample,'Vehicles','Bus A','vehicle.bus'),'utf8'),'DO_NOT_MODIFY');
 console.log('PASS_M65_ELECTRON_IPC_SYMLINK_DENIAL_RECOVERY');
 await application.evaluate(patch,{canceled:false,filePaths:[sample]});
 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Jogos'}).click();
 await window.locator('.inspection-game').first().getByRole('button',{name:'Selecionar pasta e inspecionar'}).click();
 const result=window.locator('.inspection-game').first().locator('.inspection-result');
 await result.waitFor({timeout:15000});
 assert.match(await result.innerText(),/Bus|Veículos/);
 assert.match(await result.innerText(),/2/);
 assert.match(await result.innerText(),/1/);
 const safeResult=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.equal(safeResult.status,'ok');
 assert.equal(safeResult.mode,'read-only');
 assert.equal(safeResult.recognized,true);
 assert.equal(safeResult.groups[0].count,2);
 assert.equal(safeResult.groups[1].count,1);
 assert.equal(safeResult.groups[0].directories,2);
 assert.equal(safeResult.groups[0].files,0);
 assert.equal(safeResult.notices.some(n=>n.code==='omsi-structure-incomplete'),true);
 await application.evaluate(patch,{canceled:false,filePaths:[etsSample]});
 const etsReport=await window.evaluate(()=>window.omsiPreview.inspectGame('ets2'));
 assert.equal(etsReport.status,'ok');
 assert.equal(etsReport.groups[0].count,4);
 assert.equal(etsReport.groups[0].directories,1);
 assert.equal(etsReport.groups[0].files,3);
 assert.equal(etsReport.groups[0].packageCandidates,2);
 assert.equal(etsReport.notices.some(n=>n.code==='mods-not-verified'),true);
 assert.equal(etsReport.assessment.compatibilityVerified,false);
 assert.equal(etsReport.assessment.installationVerified,false);
 assert.equal(etsReport.selectionMode,'parent-folder');
 await application.evaluate(patch,{canceled:false,filePaths:[join(etsSample,'mod')]});
 const direct=await window.evaluate(()=>window.omsiPreview.inspectGame('ets2'));
 assert.equal(direct.status,'ok');
 assert.equal(direct.selectionMode,'direct-mod-folder');
 assert.equal(direct.groups[0].count,4);
 assert.equal(direct.groups[0].packageCandidates,2);
 assert.equal(direct.assessment.compatibilityVerified,false);
 assert.ok(!JSON.stringify(direct).includes(etsSample));
 await application.evaluate(patch,{canceled:false,filePaths:[etsSample]});
 await window.locator('.inspection-game').nth(1).getByRole('button',{name:'Selecionar pasta e inspecionar'}).click();
 const etsPanel=window.locator('.inspection-game').nth(1).locator('.inspection-result');
 await etsPanel.waitFor({timeout:15000});
 assert.match(await etsPanel.innerText(),/2 candidatos .scs\/\.zip/);
 assert.match(await etsPanel.innerText(),/não confirma validade/);
 assert.match(await etsPanel.innerText(),/Compatibilidade não verificada/);
 assert.ok(!JSON.stringify(etsReport).includes(etsSample));
 assert.equal(await readFile(join(etsSample,'mod','heavy_sound.SCS'),'utf8'),'SCS_SENTINEL');
 await application.evaluate(patch,{canceled:false,filePaths:[sample]});
 assert.ok(!JSON.stringify(safeResult).includes(root),'Must not expose absolute paths');
 assert.equal(await readFile(join(sample,'Vehicles','Bus A','vehicle.bus'),'utf8'),'DO_NOT_MODIFY');

 // M64: exercise the real Electron main-owned scanner and IPC projection
 // using an intentionally deceptive Unicode folder name. The native picker
 // is mocked, and every path is confined to our disposable test directory.
 const deceptiveLabel='omsi-\u202Egpj.exe';
 const deceptiveFolder=join(root,deceptiveLabel);
 const deceptiveSentinel=join(deceptiveFolder,'Vehicles','Synthetic Bus','do-not-change.bus');
 await mkdir(join(deceptiveFolder,'Vehicles','Synthetic Bus'),{recursive:true});
 await writeFile(deceptiveSentinel,'M64_SYNTHETIC_UNCHANGED','utf8');
 await application.evaluate(patch,{canceled:false,filePaths:[deceptiveFolder]});
 const deceptiveIPC=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.equal(deceptiveIPC.status,'ok');
 assert.equal(deceptiveIPC.folderName,'Nome da pasta ocultado por segurança');
 assert.equal(deceptiveIPC.groups[0].count,1);
 assert.equal(deceptiveIPC.provenance.canInstall,false);
 assert.equal(deceptiveIPC.assessment.installationVerified,false);
 assert.equal(JSON.stringify(deceptiveIPC).includes(deceptiveFolder),false);
 assert.equal(JSON.stringify(deceptiveIPC).includes(deceptiveLabel),false);
 // The visible UI must display only the projected label, not the spoofed
 // basename, even after a real button -> Electron IPC -> main scan cycle.
 await window.locator('.inspection-game').first()
  .getByRole('button',{name:'Selecionar pasta e inspecionar'}).click();
 const deceptivePanel=window.locator('.inspection-game').first().locator('.inspection-result');
 await deceptivePanel.getByText(/Nome da pasta ocultado por segurança/).waitFor({timeout:15000});
 assert.equal((await deceptivePanel.innerText()).includes(deceptiveLabel),false);
 assert.equal(await readFile(deceptiveSentinel,'utf8'),'M64_SYNTHETIC_UNCHANGED');

 // Ordinary Unicode must remain intact after the same real IPC boundary.
 const ordinaryLabel='Ônibus da Serra 🚌';
 const ordinaryFolder=join(root,ordinaryLabel);
 await mkdir(join(ordinaryFolder,'Vehicles','Synthetic Bus'),{recursive:true});
 await application.evaluate(patch,{canceled:false,filePaths:[ordinaryFolder]});
 const ordinaryIPC=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.equal(ordinaryIPC.status,'ok');
 assert.equal(ordinaryIPC.folderName,ordinaryLabel);
 assert.equal(ordinaryIPC.groups[0].count,1);
 assert.equal(JSON.stringify(ordinaryIPC).includes(ordinaryFolder),false);
 // Restore the original *UI* inspection, not merely the mocked picker.
 // Later consolidated-report assertions intentionally expect 2 Vehicles +
 // 1 Map. Patching the dialog alone leaves React's last report unchanged.
 await application.evaluate(patch,{canceled:false,filePaths:[sample]});
 await window.locator('.inspection-game').first()
  .getByRole('button',{name:'Selecionar pasta e inspecionar'}).click();
 await window.locator('.inspection-game').first().locator('.inspection-result')
  .getByText(/sample-omsi/).waitFor({timeout:15000});
 console.log('PASS_M64_REAL_ELECTRON_UNICODE_LABEL_IPC_AND_UI');

 // The native portal may fail with private paths or provider details.
 // The renderer must receive only a fixed, path-free IPC error and recover.
 await application.evaluate(({dialog})=>{
  dialog.showOpenDialog=async()=>{throw Error('/private/CI-SYNTHETIC-SECRET-PATH token=fictional');};
 });
 const pickerFailure=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.deepEqual(pickerFailure,{status:'error',
  message:'Não foi possível abrir o seletor de pastas.'});
 assert.ok(!JSON.stringify(pickerFailure).includes('CI-SYNTHETIC-SECRET-PATH'));
 await application.evaluate(({dialog})=>{
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[]});
 });
 const malformedPicker=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.deepEqual(malformedPicker,{status:'error',
  message:'Não foi possível abrir o seletor de pastas.'});

 await application.evaluate(patch,{canceled:true,filePaths:[]});
 const cancelled=await window.evaluate(()=>window.omsiPreview.inspectGame('ets2'));
 assert.deepEqual(cancelled,{status:'cancelled'});
 const rejection=await window.evaluate(async()=>{
  try{await window.omsiPreview.inspectGame('C:\\\\Windows');return false;}
  catch{return true;}
 });
 assert.equal(rejection,true);

 await application.evaluate(({dialog})=>{
  dialog.showOpenDialog=async()=>{
   await new Promise(resolve=>setTimeout(resolve,250));
   return {canceled:true,filePaths:[]};
  };
 });
 const concurrent=await window.evaluate(()=>Promise.all([
  window.omsiPreview.inspectGame('omsi'),
  window.omsiPreview.inspectGame('ets2')
 ]));
 assert.equal(concurrent.filter(x=>x.status==='cancelled').length,1);
 assert.equal(concurrent.filter(x=>x.status==='error').length,1);
 assert.equal(concurrent.find(x=>x.status==='error')?.message,'Já existe uma inspeção em andamento.');

 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 const report=window.getByRole('region',{name:'Relatório consolidado'});
 await report.waitFor({timeout:10000});
 assert.match(await report.innerText(),/Entradas diretas contabilizadas: 3/);
 assert.match(await report.innerText(),/Revisão manual obrigatória/);
 assert.match(await report.innerText(),/Compatibilidade não verificada/);
 assert.equal(await window.getByRole('button',{name:'Instalar (bloqueado)'}).isDisabled(),true);
 assert.equal(await window.getByRole('button',{name:'Remover (bloqueado)'}).isDisabled(),true);

 // M56: exercise the actual Electron main-process IPC path with a deferred
 // synthetic native dialog. Only navigation EVENT NOTIFICATION is simulated:
 // this is not proof of an actual browser reload, external portal or compositor.
 async function runSyntheticNavigationWhilePickerPending(eventName,details){
  await application.evaluate(({dialog})=>{
   dialog.showOpenDialog=()=>new Promise(resolve=>{
    globalThis.__omsiM56PickerRelease=resolve;
   });
  });
  const pending=window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
  await application.evaluate(async()=>{
   for(let i=0;i<200;i++){
    if(typeof globalThis.__omsiM56PickerRelease==='function')return;
    await new Promise(resolve=>setTimeout(resolve,20));
   }
   throw Error('synthetic-picker-not-started');
  });
  await application.evaluate(({BrowserWindow},payload)=>{
   const target=BrowserWindow.getAllWindows()[0]?.webContents;
   if(!target)throw Error('synthetic-window-unavailable');
   const release=globalThis.__omsiM56PickerRelease;
   delete globalThis.__omsiM56PickerRelease;
   target.emit(payload.eventName,payload.details);
   release({canceled:true,filePaths:[]});
  },{eventName,details});
  return pending;
 }
 const stalePicker=await runSyntheticNavigationWhilePickerPending(
  'did-start-navigation',{isMainFrame:true,isSameDocument:false});
 assert.deepEqual(stalePicker,{status:'error',
  message:'Origem da inspeção não autorizada.'});
 assert.equal(JSON.stringify(stalePicker).includes(root),false);
 const spaPicker=await runSyntheticNavigationWhilePickerPending(
  'did-start-navigation',{isMainFrame:true,isSameDocument:true});
 assert.deepEqual(spaPicker,{status:'cancelled'});
 const fallbackPicker=await runSyntheticNavigationWhilePickerPending(
  'did-navigate',undefined);
 assert.deepEqual(fallbackPicker,{status:'error',
  message:'Origem da inspeção não autorizada.'});
 // Prior stale/fallback dialogs must not leave the one-dialog-per-renderer
 // lock behind. No scan is needed: successful cancellation is enough.
 await application.evaluate(patch,{canceled:true,filePaths:[]});
 const afterEpoch=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.deepEqual(afterEpoch,{status:'cancelled'});

 // M57: run actual same-document hash navigation in the genuine renderer
 // while a mocked native dialog is pending. No synthetic navigation event.
 await application.evaluate(({dialog})=>{
  dialog.showOpenDialog=()=>new Promise(resolve=>{
   globalThis.__omsiM57HashPickerRelease=resolve;
  });
 });
 const hashPending=window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 await application.evaluate(async()=>{
  for(let i=0;i<200;i++){
   if(typeof globalThis.__omsiM57HashPickerRelease==='function')return;
   await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw Error('real-hash-picker-not-started');
 });
 await application.evaluate(({BrowserWindow})=>{
  const wc=BrowserWindow.getAllWindows()[0]?.webContents;
  if(!wc)throw Error('missing-webcontents-for-hash');
  globalThis.__omsiM57RealHashObserved=false;
  wc.once('did-navigate-in-page',()=>{globalThis.__omsiM57RealHashObserved=true;});
 });
 await window.evaluate(()=>{window.location.hash='#m57-actual-in-page';});
 await application.evaluate(async()=>{
  for(let i=0;i<200;i++){
   if(globalThis.__omsiM57RealHashObserved===true)return;
   await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw Error('real-hash-event-not-observed');
 });
 await application.evaluate(()=>{
  const release=globalThis.__omsiM57HashPickerRelease;
  delete globalThis.__omsiM57HashPickerRelease;
  if(typeof release!=='function')throw Error('real-hash-dialog-not-pending');
  release({canceled:true,filePaths:[]});
 });
 assert.deepEqual(await hashPending,{status:'cancelled'});

 // M57: a *real reload* destroys the original renderer context. Do not
 // claim a reply reached that now-destroyed context; prove clean recovery
 // by completing the old deferred picker and then issuing a new IPC request.
 await application.evaluate(({dialog})=>{
  globalThis.__omsiM58PickerAttempts=0;
  dialog.showOpenDialog=()=>{
   globalThis.__omsiM58PickerAttempts++;
   return new Promise(resolve=>{
    globalThis.__omsiM57ReloadPickerRelease=resolve;
   });
  };
 });
 const reloading=window.evaluate(()=>window.omsiPreview.inspectGame('omsi'))
  .then(()=> 'reply-before-reload',()=> 'context-destroyed');
 await application.evaluate(async()=>{
  for(let i=0;i<200;i++){
   if(typeof globalThis.__omsiM57ReloadPickerRelease==='function')return;
   await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw Error('real-reload-picker-not-started');
 });
 await window.reload({waitUntil:'load',timeout:30000});
 await window.getByRole('heading',{name:'Seu universo de simulação, organizado.'})
  .waitFor({timeout:15000});
 // M58: a second request from the NEW document cannot start another native
 // picker while the OLD document's picker is still pending. It must recover
 // after the original promise is released.
 const blockedNewRequest=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.deepEqual(blockedNewRequest,{status:'error',
  message:'Já existe uma inspeção em andamento.'});
 const pendingPickerCount=await application.evaluate(()=>globalThis.__omsiM58PickerAttempts);
 assert.equal(pendingPickerCount,1,'a new renderer must not open a second native dialog');
 await application.evaluate(()=>{
  const release=globalThis.__omsiM57ReloadPickerRelease;
  delete globalThis.__omsiM57ReloadPickerRelease;
  if(typeof release!=='function')throw Error('real-reload-dialog-not-pending');
  release({canceled:true,filePaths:[]});
 });
 assert.equal(await reloading,'context-destroyed');
 await application.evaluate(patch,{canceled:true,filePaths:[]});
 const recovered=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.deepEqual(recovered,{status:'cancelled'});
 assert.equal(await readFile(join(sample,'Vehicles','Bus A','vehicle.bus'),'utf8'),
  'DO_NOT_MODIFY');

 // M67: real Electron main-process filesystem I/O is deliberately suspended
 // inside an already-authorized metadata scan, then its owning renderer is
 // genuinely reloaded. This is a test-only patch of node:fs/promises,
 // confined to a disposable synthetic directory; restore it before recovery.
 await application.evaluate(({dialog},payload)=>{
  const fsp=process.getBuiltinModule('node:fs/promises');
  if(!fsp||typeof fsp.opendir!=='function')throw Error('m67-fs-module-unavailable');
  if(globalThis.__omsiM67OriginalOpendir)throw Error('m67-already-installed');
  const original=fsp.opendir;
  globalThis.__omsiM67OriginalOpendir=original;
  globalThis.__omsiM67PauseReached=false;
  globalThis.__omsiM67PauseRelease=null;
  globalThis.__omsiM67IteratorStarts=0;
  globalThis.__omsiM67CloseCalls=0;
  let intercepted=false;
  fsp.opendir=async function(folder,...args){
   if(!intercepted&&folder===payload.vehicleFolder){
    intercepted=true;
    globalThis.__omsiM67PauseReached=true;
    await new Promise(resolve=>{globalThis.__omsiM67PauseRelease=resolve;});
    const handle=await original.call(fsp,folder,...args);
    return {
     [Symbol.asyncIterator](){
      globalThis.__omsiM67IteratorStarts++;
      return handle[Symbol.asyncIterator]();
     },
     async close(){
      globalThis.__omsiM67CloseCalls++;
      return handle.close();
     }
    };
   }
   return original.call(fsp,folder,...args);
  };
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[payload.sample]});
 },{sample,vehicleFolder:join(sample,'Vehicles')});
 const m67OldReply=window.evaluate(()=>window.omsiPreview.inspectGame('omsi'))
  .then(()=> 'old-document-reply',()=> 'old-document-destroyed');
 await application.evaluate(async()=>{
  for(let n=0;n<200;n++){
   if(globalThis.__omsiM67PauseReached&&
      typeof globalThis.__omsiM67PauseRelease==='function')return;
   await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw Error('m67-real-scanner-never-paused');
 });
 await window.reload({waitUntil:'load',timeout:30000});
 await window.getByRole('heading',{name:'Seu universo de simulação, organizado.'})
  .waitFor({timeout:15000});
 // Main-process one-flight guard must still block a new scan while the old
 // opendir is held, even though the old renderer document has been destroyed.
 const m67Blocked=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.deepEqual(m67Blocked,{status:'error',
  message:'Já existe uma inspeção em andamento.'});
 const m67Released=await application.evaluate(()=>{
  const fsp=process.getBuiltinModule('node:fs/promises');
  const original=globalThis.__omsiM67OriginalOpendir;
  const release=globalThis.__omsiM67PauseRelease;
  if(typeof original!=='function'||typeof release!=='function')
   throw Error('m67-release-state-missing');
  fsp.opendir=original;
  delete globalThis.__omsiM67OriginalOpendir;
  delete globalThis.__omsiM67PauseRelease;
  release();
  return true;
 });
 assert.equal(m67Released,true);
 assert.equal(await m67OldReply,'old-document-destroyed');
 await application.evaluate(async()=>{
  for(let n=0;n<200;n++){
   if(globalThis.__omsiM67CloseCalls===1)return;
   await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw Error('m67-aborted-directory-not-closed');
 });
 const m67State=await application.evaluate(()=>({
  iteratorStarts:globalThis.__omsiM67IteratorStarts,
  closes:globalThis.__omsiM67CloseCalls
 }));
 assert.deepEqual(m67State,{iteratorStarts:0,closes:1},
  'cancelled scan must close its directory without enumerating entries');
 let m67Recovered;
 for(let n=0;n<100;n++){
  m67Recovered=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
  if(m67Recovered.status==='ok')break;
  assert.deepEqual(m67Recovered,{status:'error',
   message:'Já existe uma inspeção em andamento.'});
  await new Promise(resolve=>setTimeout(resolve,20));
 }
 assert.equal(m67Recovered.status,'ok');
 assert.equal(m67Recovered.groups[0].count,2);
 assert.equal(m67Recovered.groups[1].count,1);
 assert.equal(m67Recovered.provenance.operationsEnabled,false);
 assert.equal(await readFile(join(sample,'Vehicles','Bus A','vehicle.bus'),'utf8'),
  'DO_NOT_MODIFY');
 console.log('PASS_M67_REAL_ELECTRON_ABORTED_METADATA_SCAN_AND_RECOVERY');
 console.log('Native folder IPC E2E: OK. Synthetic epoch notification, actual hash navigation and real reload recovery.');
}finally{
 await application?.close();
 await rm(root,{recursive:true,force:true});
}
