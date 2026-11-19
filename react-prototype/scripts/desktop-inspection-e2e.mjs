import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
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
 console.log('Native folder IPC E2E: OK. Synthetic epoch notification, actual hash navigation and real reload recovery.');
}finally{
 await application?.close();
 await rm(root,{recursive:true,force:true});
}
