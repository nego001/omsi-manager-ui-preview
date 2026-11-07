import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MANIFEST_NAME,createBuildManifest,writeBuildManifest,verifyBuildManifest}
 from './portable-build-manifest.mjs';
const roots=[];
after(async()=>{for(const root of roots)await rm(root,{recursive:true,force:true});});
const validEnv={GITHUB_ACTIONS:'true',GITHUB_SHA:'a'.repeat(40)};
async function fixture(){const root=await mkdtemp(join(tmpdir(),'omsi-build-manifest-fixture-'));roots.push(root);return root;}
test('both native packages record the same commit but distinct systems',()=>{
 const win=createBuildManifest({platform:'win32',env:validEnv});
 const linux=createBuildManifest({platform:'linux',env:validEnv});
 assert.equal(win.sourceRevision,linux.sourceRevision);
 assert.equal(win.operatingSystem,'windows');
 assert.equal(linux.operatingSystem,'linux');
 for(const x of [win,linux]){
  assert.equal(x.modificationEnabled,false);
  assert.equal(x.mode,'read-only');
  assert.equal(x.signatureStatus,'unsigned');
  assert.equal(Object.isFrozen(x),true);
 }
});
test('CI metadata fails closed on missing/invalid revision, unsupported OS',()=>{
 for(const sha of [undefined,'BAD','a'.repeat(39),'../'.repeat(15)]){
  const env={GITHUB_ACTIONS:'true'};
  if(sha!==undefined)env.GITHUB_SHA=sha;
  assert.throws(()=>createBuildManifest({platform:'linux',env}));
 }
 for(const platform of [null,'darwin','win','linux-x64'])
  assert.throws(()=>createBuildManifest({platform,env:validEnv}));
 const local=createBuildManifest({platform:'linux',env:{}});
 assert.equal(local.sourceRevision,null);
 assert.equal(local.buildEnvironment,'local');
 assert.equal(local.signatureStatus,'unsigned');
});
test('manifest is strict, size limited, cannot authorize modifications or claim signed',async(t)=>{
 const root=await fixture(),options={platform:'linux',env:validEnv};
 await writeBuildManifest(root,options);
 assert.deepEqual(await verifyBuildManifest(root,options),createBuildManifest(options));
 await assert.rejects(verifyBuildManifest(root,{platform:'win32',env:validEnv}));
 const path=join(root,MANIFEST_NAME),original=await readFile(path,'utf8');
 for(const edit of [
  original.replace('"modificationEnabled": false','"modificationEnabled": true'),
  original.replace('"unsigned"','"signed"'),
  original.replace('"linux"','"windows"'),
  original+'x'.repeat(3000)
 ]){
  await writeFile(path,edit);
  await assert.rejects(verifyBuildManifest(root,options));
 }
 await writeFile(path,original);
 const outside=join(root,'outside.json');
 await writeFile(outside,original);
 await rm(path);
 try{await symlink(outside,path);}catch(e){
  if(['EPERM','EACCES','ENOSYS'].includes(e.code)){t.diagnostic('Symlinks unavailable; tampering checks passed');return;}
  throw e;
 }
 await assert.rejects(verifyBuildManifest(root,options));
});
