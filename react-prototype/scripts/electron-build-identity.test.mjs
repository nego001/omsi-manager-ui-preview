import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NAME,installedVersion,validateVersion,validateEvidence,writeEvidence,verifyEvidence}
 from './electron-build-identity.mjs';
async function make(t){
 const dir=await mkdtemp(join(tmpdir(),'omsi-m68-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 await mkdir(join(dir,'node_modules','electron'),{recursive:true});
 await writeFile(join(dir,'package.json'),JSON.stringify({devDependencies:{electron:'45.5.0'}}));
 await writeFile(join(dir,'node_modules','electron','package.json'),
  JSON.stringify({name:'electron',version:'45.5.0'}));
 await writeFile(join(dir,'OMSI-Manager-Preview'),Buffer.from([127,69,76,70,1,2,3,4,5]));
 return dir;
}
test('installed version is exactly passed through and ELF hashed without sandbox claims',async t=>{
 const dir=await make(t),v=await installedVersion(dir);
 assert.equal(v,'45.5.0');
 const r=await writeEvidence(dir,v);
 assert.equal(r.rendererSandboxVerified,false);
 assert.equal(r.releaseAuthorized,false);
 assert.deepEqual(await verifyEvidence(dir,v),r);
 await assert.rejects(writeEvidence(dir,v),/REFUSED/);
});
test('unsupported versions and inconsistent npm dependency declaration refuse',async t=>{
 const dir=await make(t);
 for(const v of ['38.8.6','45.5.0-beta','45.05.0','45.5','45.5.1','^45.5.0','46.0.0'])
  assert.throws(()=>validateVersion(v,'45.5.0'),/REFUSED/);
 await writeFile(join(dir,'node_modules','electron','package.json'),
  JSON.stringify({name:'electron',version:'45.5.1'}));
 await assert.rejects(installedVersion(dir),/REFUSED/);
 await writeFile(join(dir,'package.json'),JSON.stringify({devDependencies:{electron:'*'}}));
 await assert.rejects(installedVersion(dir),/REFUSED/);
});
test('corrupted ELF and forged claims fail closed',async t=>{
 const dir=await make(t),r=await writeEvidence(dir,'45.5.0');
 for(const change of [{rendererSandboxVerified:true},{releaseAuthorized:true},
  {explicitPackagerVersionInput:false},{newField:true}])
  assert.throws(()=>validateEvidence({...r,...change}),/REFUSED/);
 await assert.rejects(verifyEvidence(dir,'45.5.1'),/REFUSED/);
 await writeFile(join(dir,'OMSI-Manager-Preview'),Buffer.from([127,69,76,70,1,2,3,4,6]));
 await assert.rejects(verifyEvidence(dir),/REFUSED/);
 await writeFile(join(dir,'OMSI-Manager-Preview'),'bad ELF');
 await assert.rejects(verifyEvidence(dir),/REFUSED/);
});
test('symlinked metadata file is refused',async t=>{
 const dir=await make(t),r=await writeEvidence(dir,'45.5.0');
 const external=join(dir,'copy');
 await writeFile(external,JSON.stringify(r));
 await rm(join(dir,NAME));await symlink(external,join(dir,NAME));
 await assert.rejects(verifyEvidence(dir),/REFUSED/);
 assert.equal(JSON.parse(await readFile(external,'utf8')).releaseAuthorized,false);
});
