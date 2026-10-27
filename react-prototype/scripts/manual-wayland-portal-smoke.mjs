import assert from 'node:assert/strict';
import {access,chmod,lstat,mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {_electron as electron} from 'playwright';
import {gate,requestedDesktop,validateSecurity,validateCancel,validateSelection}
 from './manual-wayland-portal-contract.mjs';
const {diagnose}=createRequire(import.meta.url)('./linux-session-diagnostics.cjs');
const argv=process.argv.slice(2);
const desktop=requestedDesktop(argv);
const allowed=gate({platform:process.platform,uid:process.getuid?.(),
 args:argv,env:process.env,
 stdinTTY:process.stdin.isTTY,stdoutTTY:process.stdout.isTTY});
if(!allowed){
 console.error('DESKTOP_MANUAL_PILOT_REFUSED: explicit matching Linux desktop session required');
 process.exitCode=3;
}else{
 await run(desktop).catch(()=>{
  // Native dialog errors can contain private paths; never print them.
  console.error('DESKTOP_MANUAL_PILOT: NOT VERIFIED');
  process.exitCode=4;
 });
}
function sha(bytes){return createHash('sha256').update(bytes).digest('hex');}
async function deadline(task){
 let timer;
 try{return await Promise.race([task,new Promise((_,reject)=>{
  timer=setTimeout(()=>reject(Error('interaction-timeout')),120000);
 })]);}finally{clearTimeout(timer);}
}
async function run(desktop){
 const session=process.env.XDG_SESSION_TYPE;
 const report=await diagnose();
 if(report.desktopFamily!==desktop||report.session!==session||
  (session==='wayland'&&report.waylandSocket!=='available'))
  throw Error('Desktop or display preflight not ready');
 // Unknown FileChooser version may mean GTK native dialog or missing D-Bus
 // tooling; do not mark the picker verified, but allow a manual real test.
 const chooserAdvertised=report.portalFileChooserInterface==='advertised';
 const exec=resolve('release/OMSI-Manager-Preview-linux-x64/OMSI-Manager-Preview');
 const launcher=join(dirname(exec),'OMSI-Manager-Preview.sh');
 await access(exec,constants.X_OK);
 await access(launcher,constants.X_OK);
 const mode=await lstat(launcher);
 if(mode.isSymbolicLink()||!mode.isFile())throw Error('invalid portable launcher');
 const root=await mkdtemp(join(tmpdir(),'omsi-desktop-portal-manual-'));
 await chmod(root,0o700);
 const terminal=createInterface({input:process.stdin,output:process.stdout});
 let app;
 try{
  const fixture=join(root,'omsi-synthetic-portal-test');
  await mkdir(join(fixture,'Vehicles','Test Bus'),{recursive:true});
  await mkdir(join(fixture,'maps','Test Map'),{recursive:true});
  const sentinel=join(fixture,'Vehicles','Test Bus','test.bus');
  await writeFile(sentinel,'SYNTHETIC ONLY - DO NOT MODIFY\n',{flag:'wx',mode:0o600});
  const before=sha(await readFile(sentinel));
  app=await electron.launch({executablePath:launcher,
   args:session==='x11'?['--ozone-platform=x11']:[],
   cwd:dirname(exec),
   env:{...process.env,OMSI_MANAGER_DEV_PREVIEW:'0',
    OMSI_MANAGER_NATIVE_WAYLAND:session==='wayland'?'1':'0'},
   timeout:90000});
  const native=await app.evaluate(({app})=>({
   packaged:app.isPackaged,ozone:app.commandLine.getSwitchValue('ozone-platform')
  }));
  const win=await app.firstWindow();
  await win.getByRole('heading',{name:'Seu universo de simulação, organizado.'})
   .waitFor({timeout:30000});
  const security=await win.evaluate(()=>({
   mode:window.omsiPreview?.mode,node:typeof window.require,
   inspect:window.omsiPreview?.capabilities?.inspectDirectories,
   install:window.omsiPreview?.capabilities?.installMods,
   remove:window.omsiPreview?.capabilities?.uninstallMods,
   execute:window.omsiPreview?.capabilities?.executeCommands
  }));
  validateSecurity({...native,...security},session);
  console.log('ETAPA 1: confirme visualmente a janela nativa e cancele.');
  const cancel=win.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
  if((await terminal.question('Janela visível? Digite SIM e depois cancele: ')).trim()!=='SIM')
   throw Error('operator-declined');
  validateCancel(await deadline(cancel));
  console.log('ETAPA 2: selecione SOMENTE a pasta fictícia abaixo.');
  console.log(fixture); // Local TTY only, NEVER CI or published artifacts.
  const select=win.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
  if((await terminal.question('Segunda janela visível? Digite SIM e selecione a pasta: ')).trim()!=='SIM')
   throw Error('operator-declined');
  const chosen=await deadline(select);
  validateSelection(chosen,basename(fixture));
  assert.ok(!JSON.stringify(chosen).includes(root),'renderer-path-leak');
  assert.equal(sha(await readFile(sentinel)),before,'synthetic-bytes-changed');
  console.log(JSON.stringify({result:'PASS',desktopFamily:desktop,session,
   nativeChooserManuallyObserved:true,fileChooserInterfaceAdvertised:chooserAdvertised,
   portalBackendVerified:false,syntheticFixtureUnchanged:true,readOnly:true}));
 }finally{
  terminal.close();
  await app?.close().catch(()=>{});
  await rm(root,{recursive:true,force:true});
 }
}
