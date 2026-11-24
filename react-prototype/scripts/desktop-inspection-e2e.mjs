import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,rename,realpath} from 'node:fs/promises';
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
   globalThis.__m72HomeReads=0;
   app.getPath=function(name){
    if(name==='home'){globalThis.__m72HomeReads++;return payload.home;}
    return original.call(this,name);
   };
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

   // M72: explicitly opt in, reload the actual document, and confirm all
   // three counts appear without a manual detect click or native picker.
   const setting=window.getByRole('checkbox',{name:'Detectar jogos ao iniciar'});
   assert.equal(await setting.isChecked(),false);
   const before=await application.evaluate(()=>globalThis.__m72HomeReads);
   await setting.check();
   assert.equal(await window.evaluate(()=>localStorage.getItem('omsi-preview-steam-discovery-at-startup-v1')),'true');
   await application.evaluate(({dialog})=>{
    globalThis.__m72UnexpectedPickers=0;
    dialog.showOpenDialog=async()=>{globalThis.__m72UnexpectedPickers++;return {canceled:true,filePaths:[]};};
   });
   await window.reload({waitUntil:'load',timeout:30000});
   await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Jogos'}).click();
   await window.getByText('1 instalação(ões) candidata(s)',{exact:true}).nth(2).waitFor({timeout:15000});
   assert.equal(await window.getByText('1 instalação(ões) candidata(s)',{exact:true}).count(),3);
   await window.getByRole('button',{name:'Detectar jogos automaticamente'}).waitFor({timeout:15000});
   assert.equal(await application.evaluate(()=>globalThis.__m72HomeReads),before+3);
   assert.equal(await application.evaluate(()=>globalThis.__m72UnexpectedPickers),0);
   assert.equal(await setting.isChecked(),true);
   // Disable, reload again, and verify preference + empty result state.
   await setting.uncheck();
   assert.equal(await window.evaluate(()=>localStorage.getItem('omsi-preview-steam-discovery-at-startup-v1')),'false');
   await window.reload({waitUntil:'load',timeout:30000});
   await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Jogos'}).click();
   await window.getByRole('button',{name:'Detectar jogos automaticamente'}).waitFor({timeout:15000});
   assert.equal(await setting.isChecked(),false);
   assert.equal(await window.getByText('1 instalação(ões) candidata(s)',{exact:true}).count(),0);
   assert.equal(await application.evaluate(()=>globalThis.__m72HomeReads),before+3);
   assert.equal(await application.evaluate(()=>globalThis.__m72UnexpectedPickers),0);
   await window.evaluate(()=>localStorage.removeItem('omsi-preview-steam-discovery-at-startup-v1'));
   console.log('PASS_M72_OPT_IN_STARTUP_DISCOVERY_RELOAD_AND_DISABLE');

   // M73: two Steam candidates, opaque IDs and native confirmation.
   const secondLib=join(root,'m73-second-library');
   const secondOmsi=join(secondLib,'steamapps','common','OMSI 2');
   await mkdir(join(secondOmsi,'Vehicles','Synthetic second bus'),{recursive:true});
   await mkdir(join(secondOmsi,'maps'),{recursive:true});
   await writeFile(join(secondOmsi,'Omsi.exe'),'M73_SYNTHETIC');
   await writeFile(join(steam,'libraryfolders.vdf'),
    '"libraryfolders" { "0" { "path" '+JSON.stringify(library)+' } "1" { "path" '+JSON.stringify(secondLib)+' } }');
   // M77: each library has its own declared build. Do not expose owner data.
   await writeFile(join(library,'steamapps','appmanifest_252530.acf'),
    '"AppState" { "appid" "252530" "installdir" "OMSI 2" "buildid" "12345678" "LastOwner" "M77_PRIVATE_OWNER" }');
   await writeFile(join(secondLib,'steamapps','appmanifest_252530.acf'),
    '"AppState" { "appid" "252530" "installdir" "OMSI 2" "buildid" "87654321" }');
   const list=await window.evaluate(()=>window.omsiPreview.listSteam('omsi'));
   assert.equal(list.status,'candidate-list');assert.equal(list.candidates.length,2);
   assert.equal(JSON.stringify(list).includes(root),false);
   assert.deepEqual(list.candidates.map(c=>c.steamBuildId),['12345678','87654321']);
   assert.equal(JSON.stringify(list).includes('M77_PRIVATE_OWNER'),false);
   const stale=list.candidates[0].id;
   await window.getByRole('button',{name:'Detectar jogos automaticamente'}).click();
   const omsiPanel=window.locator('.inspection-game').first();
   await omsiPanel.getByRole('button',{name:'Instalação Steam 2 · confirmar pasta',exact:true}).waitFor({timeout:15000});
   await omsiPanel.getByText('Build Steam declarado: 87654321',{exact:true}).waitFor({timeout:15000});
   console.log('PASS_M77_DECLARED_STEAM_BUILD_PER_LIBRARY_UI');
   await window.getByRole('button',{name:'Detectar jogos automaticamente'}).waitFor({timeout:15000});
   const denied=await window.evaluate(id=>window.omsiPreview.chooseSteam('omsi',id),stale);
   assert.equal(denied.status,'error');
   await application.evaluate(({dialog},expected)=>{
    dialog.showOpenDialog=async(_win,opts)=>{
     if(opts.defaultPath!==expected)throw Error('M73_WRONG_HINT');
     return {canceled:false,filePaths:[expected]};
    };
   },secondOmsi);
   await omsiPanel.getByRole('button',{name:'Instalação Steam 2 · confirmar pasta',exact:true}).click();
   await omsiPanel.getByText('Pasta candidata confirmada nesta sessão.',{exact:true}).waitFor({timeout:15000});
   assert.equal(await readFile(join(secondOmsi,'Omsi.exe'),'utf8'),'M73_SYNTHETIC');
   // M74: remember only after native confirmation and match the exact
   // preferred path after reload and a reversed library enumeration order.
   await omsiPanel.getByRole('button',{name:'Instalação Steam 2 · confirmar e lembrar',exact:true}).click();
   await omsiPanel.getByText('Instalação preferida',{exact:true}).waitFor({timeout:15000});
   const saved=await window.evaluate(()=>localStorage.getItem('omsi-preview-preferred-steam-v1-omsi'));
   assert.match(saved,/^[0-9a-f]{64}$/);
   assert.equal(saved.includes(root),false);
   await writeFile(join(steam,'libraryfolders.vdf'),
    '"libraryfolders" { "0" { "path" '+JSON.stringify(secondLib)+' } "1" { "path" '+JSON.stringify(library)+' } }');
   await window.reload({waitUntil:'load',timeout:30000});
   await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Jogos'}).click();
   await window.getByRole('button',{name:'Detectar jogos automaticamente'}).click();
   await omsiPanel.locator('.inspection-group').filter({hasText:'Instalação preferida'})
    .getByRole('button',{name:'Instalação Steam 1 · confirmar pasta',exact:true}).waitFor({timeout:15000});
   await window.getByRole('button',{name:'Detectar jogos automaticamente'}).waitFor({timeout:15000});
   // M75: actually move the disposable installation to a third library.
   // A failed index read must not be presented as a missing installation.
   await writeFile(join(steam,'libraryfolders.vdf'),'"libraryfolders" {');
   await window.getByRole('button',{name:'Detectar jogos automaticamente'}).click();
   await omsiPanel.getByText('Não foi possível verificar a preferência',{exact:true}).waitFor({timeout:15000});
   await window.getByRole('button',{name:'Detectar jogos automaticamente'}).waitFor({timeout:15000});
   assert.equal(await omsiPanel.getByText('Localização preferida não encontrada',{exact:true}).count(),0);
   assert.equal(await window.evaluate(()=>localStorage.getItem('omsi-preview-preferred-steam-v1-omsi')),saved);
   const movedLib=join(root,'m75-moved-library');
   const movedOmsi=join(movedLib,'steamapps','common','OMSI 2');
   await mkdir(join(movedLib,'steamapps','common'),{recursive:true});
   await rename(secondOmsi,movedOmsi);
   await writeFile(join(steam,'libraryfolders.vdf'),
    '"libraryfolders" { "0" { "path" '+JSON.stringify(library)+' } "1" { "path" '+JSON.stringify(movedLib)+' } }');
   await omsiPanel.getByRole('button',{name:'Tentar verificar novamente',exact:true}).click();
   await omsiPanel.getByText('Localização preferida não encontrada',{exact:true}).waitFor({timeout:15000});
   await window.getByRole('button',{name:'Detectar jogos automaticamente'}).waitFor({timeout:15000});
   assert.equal(await omsiPanel.getByText('Instalação preferida',{exact:true}).count(),0);
   assert.equal(await window.evaluate(()=>localStorage.getItem('omsi-preview-preferred-steam-v1-omsi')),saved);
   // Cancel replacement; old preference must survive. A second, explicit
   // native confirmation can remember the new candidate.
   await application.evaluate(patch,{canceled:true,filePaths:[]});
   await omsiPanel.getByRole('button',{name:'Instalação Steam 2 · confirmar e lembrar',exact:true}).click();
   await omsiPanel.getByRole('button',{name:'Instalação Steam 2 · confirmar e lembrar',exact:true}).waitFor({timeout:15000});
   // The global busy button is enabled only when the IPC has settled.
   await window.waitForFunction(()=>!document.querySelector('.inspection-game button')?.disabled);
   assert.equal(await window.evaluate(()=>localStorage.getItem('omsi-preview-preferred-steam-v1-omsi')),saved);
   await application.evaluate(({dialog},expected)=>{
    dialog.showOpenDialog=async(_win,opts)=>{
     if(opts.defaultPath!==expected)throw Error('M75_WRONG_HINT');
     return {canceled:false,filePaths:[expected]};
    };
   },movedOmsi);
   await omsiPanel.getByRole('button',{name:'Instalação Steam 2 · confirmar e lembrar',exact:true}).click();
   await omsiPanel.getByText('Instalação preferida',{exact:true}).waitFor({timeout:15000});
   const replacement=await window.evaluate(()=>localStorage.getItem('omsi-preview-preferred-steam-v1-omsi'));
   assert.match(replacement,/^[0-9a-f]{64}$/);
   assert.notEqual(replacement,saved);
   assert.equal(await readFile(join(movedOmsi,'Omsi.exe'),'utf8'),'M73_SYNTHETIC');
   console.log('PASS_M75_MOVED_FIXTURE_INCONCLUSIVE_AND_EXPLICIT_REPLACEMENT');
   await omsiPanel.getByRole('button',{name:'Esquecer instalação preferida'}).click();
   assert.equal(await window.evaluate(()=>localStorage.getItem('omsi-preview-preferred-steam-v1-omsi')),null);
   assert.equal(await omsiPanel.getByText('Instalação preferida',{exact:true}).count(),0);
   console.log('PASS_M74_PREFERRED_STEAM_SELECTION_RELOAD_REORDER_FORGET');
   // Clear transient UI reports so prior manual-inspection assertions start clean.
   await window.reload({waitUntil:'load',timeout:30000});
   console.log('PASS_M73_MULTIPLE_STEAM_CANDIDATES_NATIVE_CONFIRMATION');
  }finally{
   await application.evaluate(({app})=>{
    app.getPath=globalThis.__m69OriginalGetPath;
    delete globalThis.__m69OriginalGetPath;
    delete globalThis.__m69PickerCalls;
    delete globalThis.__m69HintMatches;
    delete globalThis.__m72HomeReads;
    delete globalThis.__m72UnexpectedPickers;
   });
  }
 }
 // M70: explicit scope selection is separate from confirmation of the game.
 const customScope=join(root,'m70-custom-library');
 const customGame=join(customScope,'Games','Renamed installation');
 await mkdir(join(customGame,'Vehicles','Synthetic bus'),{recursive:true});
 await mkdir(join(customGame,'maps','Synthetic map'),{recursive:true});
 await writeFile(join(customGame,'Omsi.exe'),'M70_SYNTHETIC_MARKER');
 await application.evaluate(({dialog},payload)=>{
  let calls=0;
  globalThis.__m70ConfirmedHint=false;
  dialog.showOpenDialog=async(_win,opts)=>{
   calls++;
   if(calls===1)return {canceled:false,filePaths:[payload.scope]};
   globalThis.__m70ConfirmedHint=opts.defaultPath===payload.game;
   return {canceled:true,filePaths:[]};
  };
 },{scope:customScope,game:customGame});
 const customCanceled=await window.evaluate(()=>window.omsiPreview.locateCustomOmsi());
 assert.deepEqual(customCanceled,{status:'cancelled'});
 assert.equal(await application.evaluate(()=>globalThis.__m70ConfirmedHint),true);
 await application.evaluate(({dialog},payload)=>{
  let calls=0;
  dialog.showOpenDialog=async(_win,opts)=>{
   if(++calls===1)return {canceled:false,filePaths:[payload.scope]};
   if(opts.defaultPath!==payload.game)throw Error('M70_WRONG_HINT');
   return {canceled:false,filePaths:[payload.game]};
  };
 },{scope:customScope,game:customGame});
 const customConfirmed=await window.evaluate(()=>window.omsiPreview.locateCustomOmsi());
 assert.equal(customConfirmed.status,'ok');
 assert.equal(customConfirmed.groups[0].count,1);
 assert.equal(customConfirmed.groups[1].count,1);
 assert.equal(customConfirmed.provenance.operationsEnabled,false);
 assert.equal(JSON.stringify(customConfirmed).includes(root),false);
 assert.equal(await readFile(join(customGame,'Omsi.exe'),'utf8'),'M70_SYNTHETIC_MARKER');
 console.log('PASS_M70_CUSTOM_SCOPE_DISCOVERY_AND_CONFIRMATION');

 // M71: truck installations in non-Steam folders are not mod directories.
 const truckScope=join(root,'m71-custom-trucks'),etsRoot=join(truckScope,'Renamed ETS'),atsRoot=join(truckScope,'Renamed ATS');
 await mkdir(join(etsRoot,'bin','linux_x64'),{recursive:true});
 await mkdir(join(atsRoot,'bin','win_x64'),{recursive:true});
 await writeFile(join(etsRoot,'bin','linux_x64','eurotrucks2'),'M71_SYNTHETIC_ETS');
 await writeFile(join(atsRoot,'bin','win_x64','amtrucks.exe'),'M71_SYNTHETIC_ATS');
 await application.evaluate(({dialog},scope)=>{
  globalThis.__m71PickerCalls=0;
  dialog.showOpenDialog=async()=>{globalThis.__m71PickerCalls++;return {canceled:false,filePaths:[scope]};};
 },truckScope);
 for(const id of ['ets2','ats']){
  const r=await window.evaluate(id=>window.omsiPreview.discoverCustomTruck(id),id);
  assert.deepEqual(r,{status:'custom-discovery',count:1,limited:true});
  assert.equal(JSON.stringify(r).includes(root),false);
 }
 assert.equal(await application.evaluate(()=>globalThis.__m71PickerCalls),2);
 // Each count required exactly one scope picker, never an inspection grant.
 await application.evaluate(patch,{canceled:true,filePaths:[]});
 assert.deepEqual(await window.evaluate(()=>window.omsiPreview.discoverCustomTruck('ats')),{status:'cancelled'});
 assert.equal(await readFile(join(etsRoot,'bin','linux_x64','eurotrucks2'),'utf8'),'M71_SYNTHETIC_ETS');
 console.log('PASS_M71_CUSTOM_TRUCK_INSTALLATION_DISCOVERY');

 // M76: temporary profile folders, not the installation root.
 const modHome=join(root,'m76-profile'),modBase=process.platform==='win32'?modHome:join(modHome,'.local','share');
 const etsMods=join(modBase,'Euro Truck Simulator 2','mod'),atsMods=join(modBase,'American Truck Simulator','mod');
 await mkdir(etsMods,{recursive:true});await mkdir(atsMods,{recursive:true});
 await writeFile(join(etsMods,'fixture.scs'),'M76_SYNTHETIC');
 await application.evaluate(({app},home)=>{
  globalThis.__m76OriginalGetPath=app.getPath;
  app.getPath=function(name){return ['home','documents'].includes(name)?home:globalThis.__m76OriginalGetPath.call(this,name);};
 },modHome);
 try{
  await application.evaluate(({dialog},expected)=>{
   dialog.showOpenDialog=async(_win,opts)=>{
    if(opts.defaultPath!==expected)throw Error('M76_WRONG_HINT');
    return {canceled:false,filePaths:[expected]};
   };
  },etsMods);
  const report=await window.evaluate(()=>window.omsiPreview.locateTruckMod('ets2'));
  assert.equal(report.status,'ok');
  assert.equal(report.selectionMode,'direct-mod-folder');
  assert.equal(report.groups[0].packageCandidates,1);
  assert.equal(report.assessment.installationVerified,false);
  assert.equal(report.provenance.operationsEnabled,false);
  assert.equal(JSON.stringify(report).includes(root),false);
  await application.evaluate(patch,{canceled:true,filePaths:[]});
  assert.deepEqual(await window.evaluate(()=>window.omsiPreview.locateTruckMod('ats')),{status:'cancelled'});
  assert.equal(await readFile(join(etsMods,'fixture.scs'),'utf8'),'M76_SYNTHETIC');
  console.log('PASS_M76_TRUCK_MOD_PROFILE_NATIVE_CONFIRMATION');
 }finally{
  await application.evaluate(({app})=>{
   app.getPath=globalThis.__m76OriginalGetPath;delete globalThis.__m76OriginalGetPath;
  });
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
 assert.ok(safeResult.groups[0].inventory.some(x=>x.kind==='directory'&&x.label==='Bus A'));
 assert.ok(!JSON.stringify(safeResult).includes('vehicle.bus'));
 await result.locator('.inspection-inventory').first().locator('summary').click();
 assert.equal(await result.getByText('Bus A',{exact:true}).isVisible(),true);
 assert.equal(safeResult.notices.some(n=>n.code==='omsi-structure-incomplete'),true);
 await application.evaluate(patch,{canceled:false,filePaths:[etsSample]});
 const etsReport=await window.evaluate(()=>window.omsiPreview.inspectGame('ets2'));
 assert.equal(etsReport.status,'ok');
 assert.equal(etsReport.groups[0].count,4);
 assert.equal(etsReport.groups[0].directories,1);
 assert.equal(etsReport.groups[0].files,3);
 assert.equal(etsReport.groups[0].packageCandidates,2);
 assert.ok(etsReport.groups[0].inventory.some(x=>x.kind==='package'&&x.label==='heavy_sound.SCS'));
 assert.ok(!JSON.stringify(etsReport).includes('notes.txt'));
 assert.ok(!JSON.stringify(etsReport).includes('SCS_SENTINEL'));
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
 await etsPanel.locator('.inspection-inventory summary').click();
 assert.equal(await etsPanel.getByText('heavy_sound.SCS',{exact:true}).isVisible(),true);
 console.log('PASS_M78_ELECTRON_LOCAL_CANDIDATE_INVENTORY');
 assert.ok(!JSON.stringify(etsReport).includes(etsSample));
 assert.equal(await readFile(join(etsSample,'mod','heavy_sound.SCS'),'utf8'),'SCS_SENTINEL');
 await application.evaluate(patch,{canceled:false,filePaths:[sample]});
 assert.ok(!JSON.stringify(safeResult).includes(root),'Must not expose absolute paths');
 assert.equal(await readFile(join(sample,'Vehicles','Bus A','vehicle.bus'),'utf8'),'DO_NOT_MODIFY');

 // M79: library consumes only reports already obtained by confirmed inspection.
 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Minha biblioteca',exact:true}).click();
 const localLibrary=window.getByRole('region',{name:'Biblioteca local da sessão'});
 await localLibrary.waitFor({timeout:15000});
 assert.equal(await localLibrary.getByText('Bus A',{exact:true}).isVisible(),true);
 assert.equal(await localLibrary.getByText('heavy_sound.SCS',{exact:true}).isVisible(),true);
 // M136: navigation must not call any picker; preserve current inventory.
 await application.evaluate(({dialog})=>{
  globalThis.__m136PickerCalls=0;
  const original=dialog.showOpenDialog;
  globalThis.__m136Restore=()=>{dialog.showOpenDialog=original;};
  dialog.showOpenDialog=async(...args)=>{globalThis.__m136PickerCalls++;return original(...args);};
 });
 try{
  await localLibrary.getByRole('button',{name:'Ir à pré-checagem OMSI'}).click();
  const metaPanel=window.getByRole('region',{name:'Seleção nativa de configuração OMSI'});
  assert.equal(await metaPanel.getByRole('heading',{name:'Pré-checagem de configuração local'}).evaluate(el=>document.activeElement===el),true);
  await metaPanel.getByRole('button',{name:'Ver demonstração de dependências'}).click();
  const demoPanel=window.getByRole('region',{name:'Prévia de dependências OMSI'});
  assert.equal(await demoPanel.getByRole('heading',{name:'Diagnóstico de dependências OMSI'}).evaluate(el=>document.activeElement===el),true);
  await demoPanel.getByRole('button',{name:'Voltar ao conteúdo local'}).click();
  assert.equal(await localLibrary.getByRole('heading',{name:'Conteúdo local'}).evaluate(el=>document.activeElement===el),true);
  assert.equal(await localLibrary.getByText('Bus A',{exact:true}).isVisible(),true);
  // M138: expanding candidate details consumes the already observed metadata only.
  const busRow=localLibrary.locator('.local-inventory-list>li').filter({has:window.getByText('Bus A',{exact:true})});
  const packageRow=localLibrary.locator('.local-inventory-list>li').filter({has:window.getByText('heavy_sound.SCS',{exact:true})});
  const busDetails=busRow.locator('details');
  assert.equal(await busDetails.getAttribute('open'),null);
  await busDetails.locator('summary').focus();
  await window.keyboard.press('Enter');
  assert.equal(await busDetails.evaluate(el=>el.open),true);
  assert.equal(await busDetails.getByText('Diretório',{exact:true}).isVisible(),true);
  assert.equal(await busDetails.getByText('Não determinado',{exact:true}).isVisible(),true);
  assert.match(await busDetails.innerText(),/Nenhum conteúdo aberto/);
  await busDetails.locator('summary').click();
  assert.equal(await busDetails.evaluate(el=>el.open),false);
  const packageDetails=packageRow.locator('details');
  await packageDetails.locator('summary').click();
  assert.equal(await packageDetails.getByText('.scs',{exact:true}).isVisible(),true);
  assert.equal(await packageDetails.getByText('Arquivo candidato',{exact:true}).isVisible(),true);
  assert.equal((await packageDetails.innerText()).includes(etsSample),false);
  await packageDetails.locator('summary').click();
  assert.equal(await packageDetails.evaluate(el=>el.open),false);
  assert.equal(await readFile(join(etsSample,'mod','heavy_sound.SCS'),'utf8'),'SCS_SENTINEL');
  console.log('PASS_M138_LOCAL_CANDIDATE_DETAILS_NO_PICKER');
  assert.equal(await application.evaluate(()=>globalThis.__m136PickerCalls),0);
 }finally{await application.evaluate(()=>{globalThis.__m136Restore();delete globalThis.__m136Restore;delete globalThis.__m136PickerCalls;});}
 console.log('PASS_M136_VISUAL_NAVIGATION_NO_PICKER');
 await localLibrary.getByRole('combobox',{name:'Simulador local'}).selectOption('ets2');
 assert.equal(await localLibrary.getByText('Bus A',{exact:true}).count(),0);
 await localLibrary.getByRole('textbox',{name:'Pesquisar conteúdo local'}).fill('HEAVY_SOUND');
 assert.equal(await localLibrary.getByText('heavy_sound.SCS',{exact:true}).isVisible(),true);
 assert.equal(await localLibrary.getByText('skin.zip',{exact:true}).count(),0);
 await localLibrary.getByRole('button',{name:'Limpar filtros locais'}).click();
 // M134: existing small fixture, local sorting and pagination controls.
 await localLibrary.getByRole('combobox',{name:'Ordenar conteúdo local'}).selectOption('game');
 assert.equal(await localLibrary.getByText('Bus A',{exact:true}).isVisible(),true);
 assert.equal(await localLibrary.getByRole('button',{name:'Página anterior de conteúdo local'}).isDisabled(),true);
 assert.equal(await localLibrary.getByRole('button',{name:'Próxima página de conteúdo local'}).isDisabled(),true);
 await localLibrary.getByRole('combobox',{name:'Tipo de conteúdo local'}).selectOption('package');
 assert.equal(await localLibrary.getByText('Bus A',{exact:true}).count(),0);
 assert.equal(await localLibrary.getByText('heavy_sound.SCS',{exact:true}).isVisible(),true);
 await localLibrary.getByRole('button',{name:'Limpar filtros locais'}).click();
 assert.equal(await localLibrary.getByRole('combobox',{name:'Ordenar conteúdo local'}).inputValue(),'name');
 assert.equal(await localLibrary.getByText('Bus A',{exact:true}).isVisible(),true);
 await application.evaluate(patch,{canceled:false,filePaths:[join(sample,'Vehicles','Bus A')]});
 await localLibrary.getByRole('button',{name:'Selecionar pasta de veículo ou mapa'}).click();
 const structurePanel=localLibrary.getByRole('region',{name:'Estrutura de um conteúdo OMSI'});
 await structurePanel.getByText('Estrutura candidata de veículo',{exact:true}).waitFor({timeout:15000});
 assert.match(await structurePanel.innerText(),/1 nomes .bus/);
 assert.ok(!((await structurePanel.innerText()).includes('vehicle.bus')));
 assert.equal(await readFile(join(sample,'Vehicles','Bus A','vehicle.bus'),'utf8'),'DO_NOT_MODIFY');
 console.log('PASS_M80_ELECTRON_OMSI_STRUCTURE_HINTS');
 // M137: cancellation discards previous structure observation and restores focus.
 await application.evaluate(patch,{canceled:true,filePaths:[]});
 const structureSelect=localLibrary.getByRole('button',{name:'Selecionar pasta de veículo ou mapa'});
 await structureSelect.focus();
 await window.keyboard.press('Enter');
 await structurePanel.getByText('Seleção de estrutura cancelada.',{exact:true}).waitFor({timeout:10000});
 assert.equal(await structurePanel.getByText('Estrutura candidata de veículo',{exact:true}).count(),0);
 assert.equal(await structureSelect.evaluate(el=>document.activeElement===el),true);
 await localLibrary.getByRole('button',{name:'Limpar inspeções da sessão'}).click();
 assert.equal(await localLibrary.getByText('heavy_sound.SCS',{exact:true}).count(),0);
 assert.match(await localLibrary.innerText(),/Nenhum inventário local nesta sessão/);
 await localLibrary.getByRole('button',{name:'Inspecionar pastas em Jogos'}).click();
 console.log('PASS_M79_ELECTRON_SESSION_LOCAL_LIBRARY');
 // M135: independent larger fixture, actual main scan and renderer pagination.
 const m135Root=join(root,'m135-pagination-fixture');
 await mkdir(join(m135Root,'Vehicles'),{recursive:true});
 for(let i=1;i<=25;i++)await mkdir(join(m135Root,'Vehicles','Fixture '+String(i).padStart(2,'0')));
 await application.evaluate(patch,{canceled:false,filePaths:[m135Root]});
 await window.locator('.inspection-game').first().getByRole('button',{name:'Selecionar pasta e inspecionar'}).click();
 const m135Result=window.locator('.inspection-game').first().locator('.inspection-result');
 const m135Summary=m135Result.getByRole('region',{name:'Resumo da inspeção de estrutura'});
 await m135Summary.waitFor({timeout:15000});
 const m140Overview=window.getByRole('region',{name:'Central dos simuladores'});
 const m140Omsi=m140Overview.getByRole('article',{name:'Resumo de OMSI 2'});
 assert.equal(await m140Omsi.getByText('Observação parcial',{exact:true}).isVisible(),true);
 assert.equal(await m140Omsi.getByText('25',{exact:true}).isVisible(),true);
 assert.equal(await m140Overview.getByRole('article',{name:'Resumo de American Truck Simulator'}).getByText('Sem observação nesta sessão',{exact:true}).isVisible(),true);
 await m140Omsi.getByRole('button',{name:'Ir à inspeção de OMSI 2'}).click();
 assert.equal(await window.locator('#simulator-inspection-omsi').evaluate(el=>document.activeElement===el),true);

 assert.equal(await m135Summary.getByText('25',{exact:true}).count(),2);
 assert.equal(await m135Summary.getByText('1 de 4',{exact:true}).isVisible(),true);
 assert.match(await m135Summary.innerText(),/não representam mods instalados/);
 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Minha biblioteca',exact:true}).click();
 const m135Library=window.getByRole('region',{name:'Biblioteca local da sessão'});
 const m135List=m135Library.locator('.local-inventory-list li');
 await m135Library.getByText('Fixture 01',{exact:true}).waitFor({timeout:10000});
 assert.equal(await m135List.count(),20);
 assert.equal(await m135Library.getByText('Fixture 21',{exact:true}).count(),0);
 await m135Library.getByRole('button',{name:'Próxima página de conteúdo local'}).click();
 assert.equal(await m135List.count(),5);
 assert.equal(await m135Library.getByText('Página 2 de 2 · 21–25 de 25',{exact:true}).evaluate(el=>document.activeElement===el),true);
 assert.equal(await m135Library.getByText('Fixture 21',{exact:true}).isVisible(),true);
 assert.equal(await m135Library.getByText('Fixture 25',{exact:true}).isVisible(),true);
 assert.equal(await m135Library.getByRole('button',{name:'Próxima página de conteúdo local'}).isDisabled(),true);
 await m135Library.getByRole('button',{name:'Página anterior de conteúdo local'}).click();
 assert.equal(await m135List.count(),20);
 await m135Library.getByRole('button',{name:'Próxima página de conteúdo local'}).click();
 await m135Library.getByRole('textbox',{name:'Pesquisar conteúdo local'}).fill('fixture 25');
 assert.equal(await m135List.count(),1);
 assert.equal(await m135Library.getByText('Fixture 25',{exact:true}).isVisible(),true);
 assert.equal(await m135Library.getByRole('button',{name:'Página anterior de conteúdo local'}).isDisabled(),true);
 await m135Library.getByRole('button',{name:'Limpar filtros locais'}).click();
 assert.equal(await m135List.count(),20);
 // M139: save observation, navigate, change only owned disposable fixture, rescan.
 await m135Library.getByRole('button',{name:'Guardar referência de OMSI 2'}).click();
 await m135Library.getByText('Referência guardada: OMSI 2 · 25 nomes.',{exact:true}).waitFor({timeout:10000});
 await m135Library.getByRole('button',{name:'Inspecionar pastas em Jogos'}).click();
 await rm(join(m135Root,'Vehicles','Fixture 01'),{recursive:true,force:true});
 await mkdir(join(m135Root,'Vehicles','Fixture 26'));
 await mkdir(join(m135Root,'Vehicles','Fixture 27'));
 await application.evaluate(patch,{canceled:false,filePaths:[m135Root]});
 await window.locator('.inspection-game').first().getByRole('button',{name:'Selecionar pasta e inspecionar'}).click();
 await window.locator('.inspection-game').first().getByRole('region',{name:'Resumo da inspeção de estrutura'}).getByText('26',{exact:true}).first().waitFor({timeout:15000});
 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Minha biblioteca',exact:true}).click();
 const m139Compare=m135Library.getByRole('region',{name:'Comparação de observações locais'});
 await m139Compare.getByText('24',{exact:true}).waitFor({timeout:10000});
 assert.equal(await m139Compare.getByText('1',{exact:true}).isVisible(),true);
 assert.equal(await m139Compare.getByText('2',{exact:true}).isVisible(),true);
 assert.match(await m139Compare.innerText(),/não comprovam ausência/);
 await m139Compare.getByText('Só na observação atual — exemplos (2 de 2)',{exact:true}).click();
 assert.equal(await m139Compare.getByText('Fixture 26',{exact:true}).isVisible(),true);
 assert.equal(await m139Compare.getByText('Fixture 27',{exact:true}).isVisible(),true);
 console.log('PASS_M139_LOCAL_OBSERVATION_COMPARISON');
 await m135Library.getByRole('button',{name:'Limpar inspeções da sessão'}).click();
 assert.equal(await m139Compare.getByText('Nenhuma referência guardada nesta sessão.',{exact:true}).isVisible(),true);
 assert.equal(await m135List.count(),0);
 assert.equal(await m135Library.getByRole('heading',{name:'Conteúdo local'}).evaluate(el=>document.activeElement===el),true);
 await m135Library.getByRole('button',{name:'Inspecionar pastas em Jogos'}).click();
 console.log('PASS_M135_ELECTRON_INSPECTION_SUMMARY_AND_MULTIPAGE');


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

 // M109: actual renderer/preload/main IPC with a simulated native choice.
 // No real portal is exercised. Only private disposable fixtures are selected.
 const configRoot=await realpath(await mkdtemp(join(root,'m109-config-')));
 const config=join(configRoot,'Fixture.bus'),oversized=join(configRoot,'Large.cfg');
 const configBytes='[model]\nprivate_fixture.cfg\n';
 await writeFile(config,configBytes,{flag:'wx'});
 await writeFile(oversized,Buffer.alloc(65537),{flag:'wx'});
 await application.evaluate(({dialog},file)=>{
  const fsp=process.getBuiltinModule('node:fs/promises');
  const originals={open:fsp.open,readFile:fsp.readFile,opendir:fsp.opendir};
  globalThis.__m109Restore=()=>{for(const key of Object.keys(originals))fsp[key]=originals[key];};
  globalThis.__m109ContentCalls=0;globalThis.__m109PickerCalls=0;globalThis.__m109OptionsOK=false;
  // Observe only attempted access to the selected fixture, never general I/O.
  for(const name of Object.keys(originals)){
   fsp[name]=function(target,...args){
    if(target===file){globalThis.__m109ContentCalls++;throw Error('M109_UNEXPECTED_CONTENT_ACCESS');}
    return originals[name].call(this,target,...args);
   };
  }
  dialog.showOpenDialog=async(_win,opts)=>{
   globalThis.__m109PickerCalls++;
   globalThis.__m109OptionsOK=opts.properties.includes('openFile')&&
    opts.properties.includes('dontAddToRecent')&&!opts.properties.includes('openDirectory')&&
    opts.filters.length===1&&opts.filters[0].extensions.join(',')==='bus,ovh,cfg'&&!opts.defaultPath;
   return {canceled:false,filePaths:[file]};
  };
 },config);
 try{
  const observed=await window.evaluate(()=>window.omsiPreview.precheckOmsiConfig('/renderer-supplied-path'));
  assert.deepEqual(observed,{status:'config-metadata-observed',scope:'selected-file-metadata-only',
   candidateKind:'bus-candidate',byteCount:Buffer.byteLength(configBytes),contentOpened:false,
   dependencyScanPerformed:false,nativeIdentityVerified:false,compatibilityVerified:false,operationsEnabled:false});
  assert.equal(await application.evaluate(()=>globalThis.__m109OptionsOK),true);
  assert.equal(await application.evaluate(()=>globalThis.__m109PickerCalls),1);
  assert.doesNotMatch(JSON.stringify(observed),/Fixture\.bus|private_fixture/);
  await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Minha biblioteca'}).click();
  const panel=window.getByRole('region',{name:'Seleção nativa de configuração OMSI'});
  await panel.getByRole('button',{name:'Selecionar arquivo para pré-checagem'}).click();
  await panel.getByText('.bus · '+Buffer.byteLength(configBytes)+' bytes · conteúdo não aberto.',{exact:true}).waitFor({timeout:10000});
  assert.equal(await window.getByRole('button',{name:'Selecionar configuração OMSI (bloqueado)'}).isDisabled(),true);
  assert.equal(await application.evaluate(()=>globalThis.__m109ContentCalls),0);
  // M131 clear only the local presentation: no additional native dialog or I/O.
  const pickerCount=await application.evaluate(()=>globalThis.__m109PickerCalls);
  await panel.getByRole('button',{name:'Limpar resultado da pré-checagem'}).click();
  await panel.getByText('.bus · '+Buffer.byteLength(configBytes)+' bytes · conteúdo não aberto.',{exact:true}).waitFor({state:'detached',timeout:5000});
  assert.equal(await application.evaluate(()=>globalThis.__m109PickerCalls),pickerCount);
  assert.equal(await application.evaluate(()=>globalThis.__m109ContentCalls),0);
  assert.equal(await panel.getByRole('button',{name:'Selecionar arquivo para pré-checagem'}).isEnabled(),true);
  assert.equal(await panel.getByRole('button',{name:'Selecionar arquivo para pré-checagem'}).evaluate(el=>document.activeElement===el),true);
 }finally{await application.evaluate(()=>{globalThis.__m109Restore();delete globalThis.__m109Restore;});}
 for(const selection of [{canceled:true,filePaths:[]},{canceled:false,filePaths:[oversized]},
  {canceled:false,filePaths:[config,oversized]},{canceled:false,filePaths:[]}]){
  await application.evaluate(patch,selection);
  const result=await window.evaluate(()=>window.omsiPreview.precheckOmsiConfig());
  assert.equal(result.status,selection.canceled?'cancelled':'error');
  assert.equal(JSON.stringify(result).includes(configRoot),false);
 }
 // The content selector shares the one-flight guard with existing folder IPC.
 await application.evaluate(({dialog})=>{
  dialog.showOpenDialog=()=>new Promise(resolve=>{globalThis.__m109Release=resolve;});
 });
 const configPending=window.evaluate(()=>window.omsiPreview.precheckOmsiConfig());
 await application.evaluate(async()=>{
  for(let i=0;i<200;i++){if(typeof globalThis.__m109Release==='function')return;await new Promise(r=>setTimeout(r,20));}
  throw Error('M109_PICKER_NOT_PENDING');
 });
 const competingFolder=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.deepEqual(competingFolder,{status:'error',message:'Já existe uma inspeção em andamento.'});
 const competingFile=await window.evaluate(()=>window.omsiPreview.precheckOmsiConfig());
 assert.deepEqual(competingFile,competingFolder);
 // Synthetic epoch notification; genuine renderer context remains alive.
 await application.evaluate(({BrowserWindow},file)=>{
  const wc=BrowserWindow.getAllWindows()[0].webContents;
  wc.emit('did-start-navigation',{isMainFrame:true,isSameDocument:false});
  const release=globalThis.__m109Release;delete globalThis.__m109Release;
  release({canceled:false,filePaths:[file]});
 },config);
 assert.deepEqual(await configPending,{status:'error',message:'Origem da inspeção não autorizada.'});
 await application.evaluate(patch,{canceled:true,filePaths:[]});
 assert.deepEqual(await window.evaluate(()=>window.omsiPreview.precheckOmsiConfig()),{status:'cancelled'});
 // Genuine reload while the config picker is pending. Old renderer cannot
 // receive a result; new renderer remains blocked until old picker finishes.
 await application.evaluate(({dialog})=>{
  dialog.showOpenDialog=()=>new Promise(resolve=>{globalThis.__m109ReloadRelease=resolve;});
 });
 const oldConfig=window.evaluate(()=>window.omsiPreview.precheckOmsiConfig()).then(()=> 'reply',()=> 'destroyed');
 await application.evaluate(async()=>{
  for(let i=0;i<200;i++){if(typeof globalThis.__m109ReloadRelease==='function')return;await new Promise(r=>setTimeout(r,20));}
  throw Error('M109_RELOAD_PICKER_NOT_PENDING');
 });
 await window.reload({waitUntil:'load',timeout:30000});
 await window.getByRole('heading',{name:'Seu universo de simulação, organizado.'}).waitFor({timeout:15000});
 assert.deepEqual(await window.evaluate(()=>window.omsiPreview.precheckOmsiConfig()),{status:'error',message:'Já existe uma inspeção em andamento.'});
 await application.evaluate((_,file)=>{
  const release=globalThis.__m109ReloadRelease;delete globalThis.__m109ReloadRelease;
  release({canceled:false,filePaths:[file]});
 },config);
 assert.equal(await oldConfig,'destroyed');
 await application.evaluate(patch,{canceled:false,filePaths:[config]});
 let recoveredConfig;
 for(let i=0;i<100;i++){
  recoveredConfig=await window.evaluate(()=>window.omsiPreview.precheckOmsiConfig());
  if(recoveredConfig.status==='config-metadata-observed')break;
  assert.deepEqual(recoveredConfig,{status:'error',message:'Já existe uma inspeção em andamento.'});
  await new Promise(r=>setTimeout(r,20));
 }
 assert.equal(recoveredConfig.status,'config-metadata-observed');
 assert.equal(recoveredConfig.contentOpened,false);
 assert.equal(await readFile(config,'utf8'),configBytes);
 assert.equal((await readFile(oversized)).length,65537);
 console.log('PASS_M109_ELECTRON_CONFIG_METADATA_IPC_RELOAD_AND_SHARED_GUARD');

 console.log('Native folder IPC E2E: OK. Synthetic epoch notification, actual hash navigation and real reload recovery.');
}finally{
 await application?.close();
 await rm(root,{recursive:true,force:true});
}
