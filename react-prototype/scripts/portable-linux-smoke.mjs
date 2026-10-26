import assert from 'node:assert/strict';
import {listPackage} from '@electron/asar';
import {access,readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {_electron as electron} from 'playwright';

if(process.platform!=='linux')throw new Error('Linux portable smoke requires Linux');
const executable=resolve(process.argv[2]??'release/OMSI-Manager-Preview-linux-x64/OMSI-Manager-Preview');
await access(executable,constants.X_OK);
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
  read:window.omsiPreview?.capabilities?.readGameFiles,
  install:window.omsiPreview?.capabilities?.installMods,
  remove:window.omsiPreview?.capabilities?.uninstallMods,
  execute:window.omsiPreview?.capabilities?.executeCommands,
  inspect:window.omsiPreview?.capabilities?.inspectDirectories
 }));
 assert.deepEqual(security,{
  nodeRequire:'undefined',nodeProcess:'undefined',mode:'read-only',
  read:false,install:false,remove:false,execute:false,inspect:true
 });
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
}finally{
 await application?.close();
 await rm(temp,{recursive:true,force:true});
}
