'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {spawnSync}=require('node:child_process');

// Only the generated packaged shell wrapper is executed by this test.
// Its sibling Electron executable is replaced by a disposable probe script.
const generated=resolve('release/OMSI-Manager-Preview-linux-x64/OMSI-Manager-Preview.sh');
const roots=[];
after(async()=>{for(const p of roots)await fs.rm(p,{recursive:true,force:true});});
async function fixture(){
 const root=await fs.mkdtemp(join(tmpdir(),'omsi m51 shell fixture '));
 roots.push(root);
 const wrapper=join(root,'OMSI-Manager-Preview.sh');
 const executable=join(root,'OMSI-Manager-Preview');
 const marker=join(root,'invoked-marker');
 await fs.copyFile(generated,wrapper);
 await fs.chmod(wrapper,0o755);
 await fs.writeFile(executable,[
  '#!/bin/sh',
  'printf "%s\\n" "target-was-invoked" > "'+marker+'"',
  'printf "argc=%s\\n" "$#"',
  'if [ "$#" -gt 0 ]; then printf "arg1=%s\\n" "$1"; fi',
  ''
 ].join('\n'),{mode:0o755});
 await fs.chmod(executable,0o755);
 const run=(args=[],moreEnv={})=>{
  const env={...process.env,OMSI_MANAGER_NATIVE_WAYLAND:'0',...moreEnv};
  delete env.NODE_OPTIONS;
  delete env.ELECTRON_RUN_AS_NODE;
  for(const [key,val] of Object.entries(moreEnv))env[key]=val;
  return spawnSync(wrapper,args,{encoding:'utf8',timeout:7000,env,maxBuffer:4096});
 };
 return {run,marker,root,wrapper};
}
test('packaged shell wrapper exists, is executable, and has no argv forwarding',async()=>{
 await fs.access(generated,constants.X_OK);
 const wrapper=await fs.readFile(generated,'utf8');
 assert.ok(wrapper.startsWith('#!/bin/sh\n'));
 assert.doesNotMatch(wrapper,/[\r\0]/);
 assert.match(wrapper,/OMSI_MANAGER_NATIVE_WAYLAND/);
 assert.match(wrapper,/launcher arguments are not permitted/);
 assert.match(wrapper,/inherited runtime options are not permitted/);
 assert.doesNotMatch(wrapper,/\$@|\$\*|--no-sandbox|--disable-web-security/);
});
test('no-argument default uses packaged sibling executable with no extra Chromium switch',async()=>{
 const {run,marker}=await fixture();
 const r=run();
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stderr,'');
 assert.equal(r.stdout,'argc=0\n');
 assert.equal(await fs.readFile(marker,'utf8'),'target-was-invoked\n');
});
test('opt-in Wayland remains exact approved ozone flag without forwarding parameters',async()=>{
 const {run,marker}=await fixture();
 const r=run([],{OMSI_MANAGER_NATIVE_WAYLAND:'1'});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stderr,'');
 assert.equal(r.stdout,'argc=1\narg1=--ozone-platform=wayland\n');
 assert.equal(await fs.readFile(marker,'utf8'),'target-was-invoked\n');
});
test('other Wayland selector values cannot interpolate arbitrary arguments',async()=>{
 const {run}=await fixture();
 for(const val of ['', '0','true','--no-sandbox','1 x']){
  const r=run([],{OMSI_MANAGER_NATIVE_WAYLAND:val});
  assert.equal(r.status,0,r.stderr);
  assert.equal(r.stdout,'argc=0\n');
 }
});
test('every incoming shell argument is refused before executing target',async()=>{
 const args=[
  ['--no-sandbox'],['--disable-setuid-sandbox'],
  ['--disable-seccomp-filter-sandbox'],['--single-process'],
  ['--no-zygote'],['--disable-web-security'],
  ['--inspect'],['--help'],['--ozone-platform=x11'],
  ['--ozone-platform=wayland'],['--foo=bar'],
  [''],['--no-sandbox','--ozone-platform=wayland']
 ];
 const {run,marker}=await fixture();
 for(const vector of args){
  const result=run(vector,{OMSI_MANAGER_NATIVE_WAYLAND:'1'});
  assert.equal(result.status,3,vector.join(' '));
  assert.equal(result.stdout,'');
  assert.match(result.stderr,/launcher arguments are not permitted/);
  if(vector.join(' '))assert.equal(result.stderr.includes(vector.join(' ')),false);
  await assert.rejects(fs.access(marker),{code:'ENOENT'});
 }
});
test('inherited ELECTRON_RUN_AS_NODE refused even if empty or zero',async()=>{
 const {run,marker}=await fixture();
 for(const v of ['1','0','']){
  const r=run([],{ELECTRON_RUN_AS_NODE:v});
  assert.equal(r.status,3);
  assert.equal(r.stdout,'');
  assert.match(r.stderr,/inherited runtime options are not permitted/);
  await assert.rejects(fs.access(marker),{code:'ENOENT'});
 }
});
test('inherited NODE_OPTIONS refused, including empty and JS injection attempts',async()=>{
 const {run,marker}=await fixture();
 for(const v of ['','--require=/tmp/malicious.js','--inspect=0.0.0.0']){
  const r=run([],{NODE_OPTIONS:v});
  assert.equal(r.status,3);
  assert.equal(r.stdout,'');
  assert.match(r.stderr,/inherited runtime options are not permitted/);
  if(v)assert.equal(r.stderr.includes(v),false);
  await assert.rejects(fs.access(marker),{code:'ENOENT'});
 }
});
test('both unsafe runtime environment options refuse before Wayland selection',async()=>{
 const {run,marker}=await fixture();
 const r=run([],{NODE_OPTIONS:'--require=private.js',
  ELECTRON_RUN_AS_NODE:'1',OMSI_MANAGER_NATIVE_WAYLAND:'1'});
 assert.equal(r.status,3);
 assert.equal(r.stdout,'');
 assert.match(r.stderr,/inherited runtime options are not permitted/);
 await assert.rejects(fs.access(marker),{code:'ENOENT'});
});
test('bad argv is refused even if sibling executable is absent',async()=>{
 const {run,marker,root}=await fixture();
 await fs.rm(join(root,'OMSI-Manager-Preview'));
 const r=run(['--no-sandbox']);
 assert.equal(r.status,3);
 assert.equal(r.stdout,'');
 assert.match(r.stderr,/launcher arguments are not permitted/);
 await assert.rejects(fs.access(marker),{code:'ENOENT'});
});
test('default shell wrapper executes no installer or privileged helper',async()=>{
 const {run,marker}=await fixture();
 const r=run();
 assert.equal(r.status,0,r.stderr);
 assert.equal(await fs.readFile(marker,'utf8'),'target-was-invoked\n');
 assert.equal(r.stdout,'argc=0\n');
});
