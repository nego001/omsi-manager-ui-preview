import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {listPackage} from '@electron/asar';
import {access,readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {_electron as electron} from 'playwright';

if(process.platform!=='linux')throw new Error('Linux portable smoke requires Linux');
const executable=resolve(process.argv[2]??'release/OMSI-Manager-Preview-linux-x64/OMSI-Manager-Preview');
await access(executable,constants.X_OK);
const automaticExecutable=join(dirname(executable),'OMSI-Manager-Auto');
await access(automaticExecutable,constants.X_OK);
assert.deepEqual([...(await readFile(automaticExecutable)).subarray(0,4)],[0x7f,0x45,0x4c,0x46]);
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
assert.match(desktop,/^Exec=".*OMSI-Manager-Auto"$/m);
const removed=runShortcut('remove');
assert.equal(removed.status,0,removed.stderr);
await assert.rejects(access(entry),{code:'ENOENT'});
let application;
try{
 const fixture=join(temp,'OMSI 2 - SYNTHETIC ONLY');
 await mkdir(join(fixture,'Vehicles','Dummy Bus'),{recursive:true});
 await mkdir(join(fixture,'maps','Dummy Map'),{recursive:true});
 const sentinel=join(fixture,'Vehicles','Dummy Bus','fixture.bus');
 await writeFile(sentinel,'SYNTHETIC TEST CONTENT - DO NOT MODIFY\n','utf8');
 application=await electron.launch({
  executablePath:launcher,
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
  /(^|\/)(native-lab|scripts|tests)(\/|$)/.test(name.replace(/\\/g,'/'))),[],
  'Lab files must not be bundled in Linux app.asar');
 const window=await application.firstWindow();
 await window.getByRole('heading',{name:'Seu universo de simulação, organizado.'})
  .waitFor({timeout:30000});
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
 // Verify the Windows/Linux family reaches the user-facing Settings page.
 await window.getByRole('navigation',{name:'Navegação principal'})
  .getByRole('button',{name:'Configurações'}).click();
 await window.getByText('Sistema detectado automaticamente: Linux',{exact:true})
  .waitFor({timeout:12000});
 assert.match(await window.locator('.settings-panel').innerText(),
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
   executablePath:launcher,args:['--ozone-platform=x11'],cwd:temp,
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
  assert.equal(await readFile(sentinel,'utf8'),
   'SYNTHETIC TEST CONTENT - DO NOT MODIFY\n');
  await application.close();
  application=undefined;
 }
 console.log('PASS_GNOME_KDE_X11_ENVIRONMENT_MATRIX_XVFB_ONLY');
}finally{
 await application?.close();
 await rm(temp,{recursive:true,force:true});
}
