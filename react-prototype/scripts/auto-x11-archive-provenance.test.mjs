import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {readVerifiedX11ArchiveSha256 as verify} from './auto-x11-archive-provenance.mjs';
const archive='OMSI-Manager-Preview-Linux-x64.tar.gz';
const sidecar='OMSI-Manager-Preview-Linux-x64.sha256';
const refusal=/^Error: AUTO_X11_ARCHIVE_PROVENANCE_REFUSED$/;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(callback){
 const root=await mkdtemp(join(tmpdir(),'omsi-ci-digest-'));
 const file=join(root,archive),side=join(root,sidecar);
 const content=Buffer.from('Disposable synthetic archive bytes, not a real application');
 await writeFile(file,content);
 await writeFile(side,digest(content)+'  '+archive+'\n');
 try{return await callback({root,file,side,content,hash:digest(content)});}
 finally{await rm(root,{recursive:true,force:true});}
}
test('computes actual package bytes and matches strict checksum sidecar',async()=>{
 await fixture(async({file,side,hash})=>assert.equal(await verify(file,side),hash));
});
test('tampered archive bytes are refused even when sidecar is unchanged',async()=>{
 await fixture(async({file,side})=>{
  await writeFile(file,'tampered payload');
  await assert.rejects(verify(file,side),refusal);
 });
});
test('forged or malformed sidecar content is refused',async()=>{
 await fixture(async({file,side,hash})=>{
  for(const value of [hash.toUpperCase()+'  '+archive+'\n',
   hash+' *'+archive+'\n',hash+'  '+archive,hash+'  /private/'+archive+'\n',
   'x'.repeat(64)+'  '+archive+'\n',hash+'  '+archive+'\nINJECTED',
   'a'.repeat(512)]){
   await writeFile(side,value);
   await assert.rejects(verify(file,side),refusal);
  }
 });
});
test('symlinked archive and sidecar are refused',async()=>{
 await fixture(async({root,file,side})=>{
  const altFile=join(root,'link-'+archive);
  const altSide=join(root,'link-'+sidecar);
  await symlink(file,altFile);await symlink(side,altSide);
  await assert.rejects(verify(altFile,side),refusal);
  await assert.rejects(verify(file,altSide),refusal);
  await rm(file);
  await symlink(altFile,file);
  await assert.rejects(verify(file,side),refusal);
 });
});
test('noncanonical archive names and unpaired directories are refused',async()=>{
 await fixture(async({file,side})=>{
  for(const [a,b] of [[file,side+'-extra'],
   [file+'.copy',side],[file,join(tmpdir(),sidecar)]])
   await assert.rejects(verify(a,b),refusal);
 });
});
test('malformed arguments never turn into a fingerprint',async()=>{
 for(const [a,b] of [[null,null],[42,''],[{},{}],[undefined,undefined]])
  await assert.rejects(verify(a,b),refusal);
});
