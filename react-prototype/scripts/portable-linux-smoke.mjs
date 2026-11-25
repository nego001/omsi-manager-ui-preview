import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {listPackage} from '@electron/asar';
import {access,readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {_electron as electron} from 'playwright';
import {verifyBuildManifest} from './portable-build-manifest.mjs';
import {verifyPackagedCSPRuntime} from './verify-packaged-csp-runtime.mjs';
import {verifyHomeLayout} from './desktop-layout-contract.mjs';
import {probePackagedRendererKernelEvidence,PACKAGED_RENDERER_REFUSAL_REASONS,COMMAND_LINE_SHAPES} from './electron-renderer-kernel-evidence.mjs';
import {createM47RendererReference} from './auto-x11-m47-renderer-reference.mjs';
import {probeM48NamespaceRelation,createM48NamespaceReference} from './auto-x11-m48-namespace-relation.mjs';
import {probeM49RendererPrivilegeStatus,createM49RendererPrivilegeReference} from './auto-x11-m49-renderer-privilege.mjs';
import {beginM50ProcessPair,finishM50ProcessPair,createM50ProcessContinuityReport} from './auto-x11-m50-process-continuity.mjs';

if(process.platform!=='linux')throw new Error('Linux portable smoke requires Linux');
async function requireRendererKernelEvidence(sample,scenario){
 try{
  const result=await probePackagedRendererKernelEvidence(sample.pid,sample.metrics);
  if(result.category!=='renderer-kernel-restrictions-observed'){
   console.error('PACKAGED_RENDERER_KERNEL_PROBE',JSON.stringify({
    scenario,classification:result.category,seccompMode:result.seccompMode,
    noNewPrivs:result.noNewPrivs,fullElectronSandboxCertified:false,
    hostPolicyChanged:false,rawProcessDataExposed:false
   }));
   throw Error('PACKAGED_RENDERER_KERNEL_RESTRICTIONS_NOT_OBSERVED');
  }
  return result;
 }catch(error){
  const reason=PACKAGED_RENDERER_REFUSAL_REASONS.includes(error?.reason)?
   error.reason:'kernel-restrictions-incomplete-or-unexpected';
  console.error('PACKAGED_RENDERER_KERNEL_PROBE_REFUSED',JSON.stringify({
   scenario,reason,commandLineShape:COMMAND_LINE_SHAPES.includes(error?.commandLineShape)?
    error.commandLineShape:null,fullElectronSandboxCertified:false,
   hostPolicyChanged:false,rawProcessDataExposed:false
  }));
  throw Error('PACKAGED_RENDERER_KERNEL_EVIDENCE_NOT_VERIFIED');
 }
}

const executable=resolve(process.argv[2]??'release/OMSI-Manager-Preview-linux-x64/OMSI-Manager-Preview');
await access(executable,constants.X_OK);
await verifyBuildManifest(dirname(executable),{platform:'linux'});
// Linux must never include a stray Windows executable.
await assert.rejects(
 access(join(dirname(executable),'OMSI-Manager-Preview.exe')),
 {code:'ENOENT'}
);
const automaticExecutable=join(dirname(executable),'OMSI-Manager-Auto');
await access(automaticExecutable,constants.X_OK);
assert.deepEqual([...(await readFile(automaticExecutable)).subarray(0,4)],[0x7f,0x45,0x4c,0x46]);
// Playwright's Electron driver may inject runtime options. Official launchers
// correctly reject them; E2E instrumentation runs the packaged ELF directly.
// Native Auto and shell wrapper behavior are checked independently.
const launcher=join(dirname(executable),'OMSI-Manager-Preview.sh');
await access(launcher,constants.X_OK);
const wrapper=await readFile(launcher,'utf8');
assert.ok(wrapper.startsWith('#!/bin/sh\n'));
assert.match(wrapper,/OMSI_MANAGER_NATIVE_WAYLAND/);
assert.match(wrapper,/--ozone-platform=wayland/);
assert.doesNotMatch(wrapper,/--no-sandbox|--disable-web-security|sudo |pkexec /);
const elf=await readFile(executable);
assert.deepEqual([...elf.subarray(0,4)],[0x7f,0x45,0x4c,0x46],
 'Linux package must contain an actual ELF executable');
const temp=await mkdtemp(join(tmpdir(),'omsi-linux-portable-smoke-'));
const helper=join(dirname(executable),'OMSI-Manager-Desktop-Integration.cjs');
await access(helper,constants.R_OK);
const doctor=join(dirname(executable),'OMSI-Manager-Linux-Diagnostics.cjs');
await access(doctor,constants.R_OK);
const diagnostic=spawnSync(process.execPath,[doctor],{
 env:{...process.env,XDG_RUNTIME_DIR:temp,WAYLAND_DISPLAY:'',XDG_SESSION_TYPE:'wayland',
 XDG_CURRENT_DESKTOP:'Hyprland'},
 encoding:'utf8',timeout:10000
});
assert.equal(diagnostic.status,0,diagnostic.stderr);
const reported=JSON.parse(diagnostic.stdout);
assert.equal(reported.scope,'read-only');
assert.equal(reported.portalPickerVerified,false);
assert.ok(['advertised','unknown'].includes(reported.portalFileChooserInterface));
assert.equal(reported.portalFileChooserInterface==='unknown',reported.portalFileChooserVersion===null);
assert.equal(reported.hyprlandCompatibilityVerified,false);
assert.equal(reported.waylandSocket,'not-configured');
// The actual distributed helper must expose only bounded OS-policy hints,
// never claim that unshare/Chromium sandbox succeeded or change host config.
const userns=reported.electronUserNamespacePrerequisites;
assert.ok(userns&&typeof userns==='object');
assert.ok(['enabled','disabled','unknown','unavailable'].includes(userns.apparmorUsernsRestriction));
assert.ok(['enabled','disabled','unknown','unavailable'].includes(userns.unprivilegedUsernsSwitch));
assert.ok(['positive','zero','unknown','unavailable'].includes(userns.usernsCapacity));
assert.ok(['restriction-indicated','no-obvious-restriction','undetermined']
 .includes(userns.userNamespacePolicyHint));
assert.equal(userns.userNamespaceCreationVerified,false);
assert.equal(userns.electronSandboxVerified,false);
assert.equal(userns.hostSecurityPolicyChanged,false);
assert.ok(!diagnostic.stdout.includes('/proc/sys/'),'no kernel paths in report');
assert.ok(!diagnostic.stdout.includes(temp),'diagnostic must not expose temp paths');
const xdg=join(temp,'isolated-xdg');
const entry=join(xdg,'applications','org.omsi_manager.Preview.desktop');
const runShortcut=(cmd)=>spawnSync(process.execPath,[helper,cmd],{
 env:{...process.env,HOME:temp,XDG_DATA_HOME:xdg},encoding:'utf8',timeout:10000
});
const installed=runShortcut('install');
assert.equal(installed.status,0,installed.stderr);
const desktop=await readFile(entry,'utf8');
assert.match(desktop,/X-OMSI-Manager-ReadOnly-Preview=true/);
assert.match(desktop,/Terminal=false/);
assert.match(desktop,/^Name=Negresco Tools$/m);
assert.match(desktop,/^Name\[pt_BR\]=Negresco Tools$/m);
assert.match(desktop,/^Exec=".*OMSI-Manager-Auto"$/m);
const removed=runShortcut('remove');
assert.equal(removed.status,0,removed.stderr);
await assert.rejects(access(entry),{code:'ENOENT'});
let application;
// Real packaged renderer observations: main + Xvfb GNOME/KDE labels only.
// The labels must never be interpreted as genuine desktop sessions.
const m47RendererObservations=[];
const m48NamespaceObservations=[];
const m49PrivilegeObservations=[];
const m50ContinuityObservations=[];
try{
 const fixture=join(temp,'OMSI 2 - SYNTHETIC ONLY');
 await mkdir(join(fixture,'Vehicles','Dummy Bus'),{recursive:true});
 await mkdir(join(fixture,'maps','Dummy Map'),{recursive:true});
 const sentinel=join(fixture,'Vehicles','Dummy Bus','fixture.bus');
 await writeFile(sentinel,'SYNTHETIC TEST CONTENT - DO NOT MODIFY\n','utf8');
 application=await electron.launch({
  chromiumSandbox:true,
  executablePath:executable,
  args:[],
  cwd:temp,
  env:{...process.env,OMSI_MANAGER_DEV_PREVIEW:'0'},
  timeout:90000
 });
 const info=await application.evaluate(({app})=>({
  packaged:app.isPackaged,appPath:app.getAppPath()
 }));
 assert.equal(info.packaged,true);
 assert.ok(info.appPath.endsWith('app.asar'));
 const archive=listPackage(info.appPath);
 assert.ok(archive.length>0);
 assert.deepEqual(archive.filter(name=>
  /(^|\/)(native-lab|native-launcher|scripts|tests|test-results|playwright-report)(\/|$)/.test(name.replace(/\\/g,'/'))),[],
  'Linux app.asar must exclude native ELF source, labs and test scripts');
 const window=await application.firstWindow();
 await window.getByRole('heading',{name:'Seu universo de simulação, organizado.'})
  .waitFor({timeout:30000});
 await verifyPackagedCSPRuntime(window);
 // Inspect the OS renderer process selected by Electron's trusted main process,
 // not a title match or a synthetic setting. Read /proc only, no policy edits.
 const rendererSample=await application.evaluate(({BrowserWindow,app})=>{
  const pid=BrowserWindow.getAllWindows()[0]?.webContents.getOSProcessId();
  const metrics=app.getAppMetrics().filter(m=>m.pid===pid)
   .map(m=>({pid:m.pid,type:m.type,creationTime:m.creationTime}));
  return {pid,metrics};
 });
 const rendererPid=rendererSample.pid;
 const packagedMainPid=await application.evaluate(()=>process.pid);
 const m50MainProof=await beginM50ProcessPair(packagedMainPid,rendererPid);
 const kernelEvidence=await requireRendererKernelEvidence(rendererSample,'linux-packaged-main');
 // Compare namespace identities only. They never leave the test runner.
 const m48MainRelation=await probeM48NamespaceRelation(packagedMainPid,rendererPid);
 const mainPrivilegeStatus=await probeM49RendererPrivilegeStatus(rendererPid);
 const sameRendererPid=await application.evaluate(({BrowserWindow})=>
  BrowserWindow.getAllWindows()[0]?.webContents.getOSProcessId());
 assert.equal(rendererPid,sameRendererPid,'renderer PID changed during kernel security inspection');
 const m50MainContinuity=await finishM50ProcessPair(m50MainProof,packagedMainPid,rendererPid);
 assert.equal(kernelEvidence.category,'renderer-kernel-restrictions-observed',
  'packaged Linux renderer must show Seccomp filter and NoNewPrivs');
 assert.equal(kernelEvidence.fullElectronSandboxCertified,false);
 m47RendererObservations.push({label:'packaged-main',evidence:kernelEvidence});
 m48NamespaceObservations.push({label:'packaged-main',relation:m48MainRelation});
 m49PrivilegeObservations.push({label:'packaged-main',privileges:mainPrivilegeStatus});
 m50ContinuityObservations.push({label:'packaged-main',continuity:m50MainContinuity});
 console.log('PACKAGED_RENDERER_KERNEL_RESTRICTIONS',JSON.stringify(kernelEvidence));
 const security=await window.evaluate(()=>({
  nodeRequire:typeof window.require,
  nodeProcess:typeof window.process,
  mode:window.omsiPreview?.mode,
  runtime:window.omsiPreview?.runtime,
  read:window.omsiPreview?.capabilities?.readGameFiles,
  install:window.omsiPreview?.capabilities?.installMods,
  remove:window.omsiPreview?.capabilities?.uninstallMods,
  execute:window.omsiPreview?.capabilities?.executeCommands,
  inspect:window.omsiPreview?.capabilities?.inspectDirectories
 }));
 assert.deepEqual(security,{
  nodeRequire:'undefined',nodeProcess:'undefined',mode:'read-only',
  runtime:{operatingSystem:'linux',platformSelection:'automatic',gameOperations:'disabled'},
  read:false,install:false,remove:false,execute:false,inspect:true
 });
 // Check real packaged Electron window geometry under Xvfb (not KWin/Mutter).
 for(const size of [[1280,800],[1024,720],[850,600]]){
  await application.evaluate(({BrowserWindow},dims)=>{
   BrowserWindow.getAllWindows()[0].setSize(dims[0],dims[1]);
  },size);
  const layout=await verifyHomeLayout(window);
  assert.equal(layout.readOnly,true);
 }
 console.log('PASS_XVFB_1280_1024_850_WINDOW_LAYOUT');
 // Verify the Windows/Linux family reaches the user-facing Settings page.
 await window.getByRole('navigation',{name:'Navegação principal'})
  .getByRole('button',{name:'Configurações'}).click();
 await window.getByText('Sistema detectado automaticamente: Linux',{exact:true})
  .waitFor({timeout:12000});
 assert.match(await window.getByRole('region',{name:'Plataforma',exact:true}).innerText(),
  /Instalação e remoção de mods permanecem bloqueadas/);
 await window.getByRole('navigation',{name:'Navegação principal'})
  .getByRole('button',{name:'Detalhes'}).click();
 assert.equal(await window.getByRole('button',{name:'Instalar (bloqueado)'}).isDisabled(),true);
 assert.equal(await window.getByRole('button',{name:'Remover (bloqueado)'}).isDisabled(),true);
 await application.evaluate(({dialog},selected)=>{
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[selected]});
 },fixture);
 const outcome=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.equal(outcome.status,'ok');
 assert.equal(outcome.mode,'read-only');
 assert.equal(outcome.groups[0].count,1);
 assert.equal(outcome.groups[1].count,1);
 assert.equal(outcome.assessment.compatibilityVerified,false);
 assert.equal(outcome.assessment.installationVerified,false);
 assert.ok(!JSON.stringify(outcome).includes(temp),'absolute path must not leak');
 assert.equal(await readFile(sentinel,'utf8'),
  'SYNTHETIC TEST CONTENT - DO NOT MODIFY\n');
 console.log('PASS_LINUX_PACKAGED_LAUNCHER_X11_AND_READ_ONLY_SYNTHETIC_INSPECTION');
 // GNOME/Plasma environment compatibility smoke with an Xvfb X11 server.
 // XDG_CURRENT_DESKTOP is simulated here: this is NOT actual GNOME/KWin.
 await application.close();
 application=undefined;
 for(const desktop of ['GNOME','KDE']){
  application=await electron.launch({
   chromiumSandbox:true,
   executablePath:executable,args:['--ozone-platform=x11'],cwd:temp,
   env:{...process.env,XDG_CURRENT_DESKTOP:desktop,
    XDG_SESSION_TYPE:'x11',WAYLAND_DISPLAY:'',
    OMSI_MANAGER_NATIVE_WAYLAND:'0',OMSI_MANAGER_DEV_PREVIEW:'0'},
   timeout:90000
  });
  const native=await application.evaluate(({app})=>({
   packaged:app.isPackaged,ozone:app.commandLine.getSwitchValue('ozone-platform')
  }));
  assert.deepEqual(native,{packaged:true,ozone:'x11'});
  const view=await application.firstWindow();
  await view.getByRole('heading',{name:'Seu universo de simulação, organizado.'})
   .waitFor({timeout:25000});
  const labelSample=await application.evaluate(({BrowserWindow,app})=>{
   const pid=BrowserWindow.getAllWindows()[0]?.webContents.getOSProcessId();
   const metrics=app.getAppMetrics().filter(m=>m.pid===pid)
    .map(m=>({pid:m.pid,type:m.type,creationTime:m.creationTime}));
   return {pid,metrics};
  });
  const labelMainPid=await application.evaluate(()=>process.pid);
  const m50LabelProof=await beginM50ProcessPair(labelMainPid,labelSample.pid);
  const labelKernel=await requireRendererKernelEvidence(labelSample,desktop);
  const labelNamespaceRelation=await probeM48NamespaceRelation(labelMainPid,labelSample.pid);
  const labelPrivilegeStatus=await probeM49RendererPrivilegeStatus(labelSample.pid);
  assert.equal(labelKernel.category,'renderer-kernel-restrictions-observed',
   'renderer OS restrictions missing in '+desktop+' X11 label');
  assert.equal(labelKernel.fullElectronSandboxCertified,false);
  const postProbeRendererPid=await application.evaluate(({BrowserWindow})=>
    BrowserWindow.getAllWindows()[0]?.webContents.getOSProcessId());
  assert.equal(labelSample.pid,postProbeRendererPid,
    'renderer PID changed during '+desktop+' kernel security inspection');
  const m50LabelContinuity=await finishM50ProcessPair(m50LabelProof,labelMainPid,labelSample.pid);
  m47RendererObservations.push({
    label:desktop==='GNOME'?'xvfb-gnome-label':'xvfb-kde-label',
    evidence:labelKernel
  });
  m48NamespaceObservations.push({
    label:desktop==='GNOME'?'xvfb-gnome-label':'xvfb-kde-label',
    relation:labelNamespaceRelation
  });
  m49PrivilegeObservations.push({
    label:desktop==='GNOME'?'xvfb-gnome-label':'xvfb-kde-label',
    privileges:labelPrivilegeStatus
  });
  m50ContinuityObservations.push({
    label:desktop==='GNOME'?'xvfb-gnome-label':'xvfb-kde-label',
    continuity:m50LabelContinuity
  });
  const isolated=await view.evaluate(()=>({
   nodeRequire:typeof window.require,nodeProcess:typeof window.process,
   mode:window.omsiPreview?.mode,
   runtime:window.omsiPreview?.runtime,
   read:window.omsiPreview?.capabilities?.readGameFiles,
   install:window.omsiPreview?.capabilities?.installMods,
   remove:window.omsiPreview?.capabilities?.uninstallMods,
   execute:window.omsiPreview?.capabilities?.executeCommands,
   inspect:window.omsiPreview?.capabilities?.inspectDirectories
  }));
  assert.deepEqual(isolated,security);
  await verifyHomeLayout(view);
  assert.equal(await readFile(sentinel,'utf8'),
   'SYNTHETIC TEST CONTENT - DO NOT MODIFY\n');
  await application.close();
  application=undefined;
 }
 // Public CI outputs categories only, never PIDs, commands, paths, or /proc.
 // Local executions do not pretend to be the approved Ubuntu 22.04 CI runner.
 if(process.env.CI==='true'&&process.env.GITHUB_ACTIONS==='true'&&
    process.env.RUNNER_OS==='Linux'){
  const report=createM47RendererReference({
   runner:'ubuntu-22.04',desktopContext:'xvfb-synthetic-gnome-kde-labels',
   observations:m47RendererObservations
  });
  await mkdir(resolve('test-results/m47'),{recursive:true,mode:0o700});
  await writeFile(resolve('test-results/m47/renderer-reference.json'),
   JSON.stringify(report)+'\n',{flag:'wx',mode:0o600});
  console.log('M47_PACKAGED_RENDERER_REFERENCE',JSON.stringify(report));
  const m48=createM48NamespaceReference({
   runner:'ubuntu-22.04',desktopContext:'xvfb-synthetic-gnome-kde-labels',
   m47:report,samples:m48NamespaceObservations
  });
  await mkdir(resolve('test-results/m48'),{recursive:true,mode:0o700});
  await writeFile(resolve('test-results/m48/renderer-namespace-relations.json'),
   JSON.stringify(m48)+'\n',{flag:'wx',mode:0o600});
  console.log('M48_NAMESPACE_RELATIONS',JSON.stringify(m48));
  const m49=createM49RendererPrivilegeReference({
   runner:'ubuntu-22.04',desktopContext:'xvfb-synthetic-gnome-kde-labels',
   m47:report,m48,samples:m49PrivilegeObservations
  });
  await mkdir(resolve('test-results/m49'),{recursive:true,mode:0o700});
  await writeFile(resolve('test-results/m49/renderer-privilege-categories.json'),
   JSON.stringify(m49)+'\n',{flag:'wx',mode:0o600});
  console.log('M49_RENDERER_PRIVILEGE_REFERENCE',JSON.stringify(m49));
  const m50=createM50ProcessContinuityReport({
   runner:'ubuntu-22.04',desktopContext:'xvfb-synthetic-gnome-kde-labels',
   m47:report,m48,m49,samples:m50ContinuityObservations
  });
  await mkdir(resolve('test-results/m50'),{recursive:true,mode:0o700});
  await writeFile(resolve('test-results/m50/renderer-process-continuity.json'),
   JSON.stringify(m50)+'\n',{flag:'wx',mode:0o600});
  console.log('M50_PROCESS_CONTINUITY_REFERENCE',JSON.stringify(m50));
 }
 console.log('PASS_GNOME_KDE_X11_ENVIRONMENT_MATRIX_XVFB_ONLY');
}finally{
 await application?.close();
 await rm(temp,{recursive:true,force:true});
}
