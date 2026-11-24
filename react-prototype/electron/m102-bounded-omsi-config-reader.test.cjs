'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {MAX_BYTES,candidateKind,createCandidateReader,readCandidate}=require('../scripts/m102-bounded-omsi-config-reader.cjs');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'omsi-m102-config-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 return root;
}
test('direct bus, ovh and cfg candidates are read without modifying bytes',async t=>{
 const root=await fixture(t);
 for(const [name,kind] of [['Vehicle.bus','bus-candidate'],['AI.OVH','ovh-candidate'],['Model 1.cfg','cfg-candidate']]){
  const bytes=Buffer.from('[model]\nmodel\\fixture.cfg\n');
  const file=path.join(root,name);await fs.writeFile(file,bytes,{flag:'wx'});
  const r=await readCandidate(root,name);
  assert.equal(r.kind,kind);assert.equal(r.byteCount,bytes.length);assert.deepEqual(r.bytes,bytes);
  assert.deepEqual(await fs.readFile(file),bytes);
  for(const key of ['contentFormatVerified','nativeIdentityVerified','operationsEnabled'])assert.equal(r[key],false);
  assert.equal(Object.hasOwn(r,'path'),false);assert.equal(Object.hasOwn(r,'filename'),false);
 }
});
test('bounded basename admission refuses traversal, unsupported extensions, devices and hidden controls',()=>{
 for(const bad of ['../a.cfg','a/b.cfg','a\\b.cfg','C:a.cfg','a.cfg:stream','a.o3d','a.cfg\n','a..cfg','a .cfg','NUL.cfg','COM1.txt.cfg','.hidden.cfg','a\u202ecfg','é.cfg',null])
  assert.throws(()=>candidateKind(bad),/M102_CONFIG_READ_REFUSED/);
 assert.equal(candidateKind('Bus v2.BUS'),'bus-candidate');
});
test('empty, oversized, directory, missing and hardlinked candidates refuse',async t=>{
 const root=await fixture(t);
 await fs.writeFile(path.join(root,'empty.cfg'),'');
 await fs.writeFile(path.join(root,'big.cfg'),Buffer.alloc(MAX_BYTES+1));
 await fs.mkdir(path.join(root,'folder.cfg'));
 await fs.writeFile(path.join(root,'linked.cfg'),'fixture');
 await fs.link(path.join(root,'linked.cfg'),path.join(root,'alias.cfg'));
 for(const name of ['empty.cfg','big.cfg','folder.cfg','missing.cfg','linked.cfg','alias.cfg'])
  await assert.rejects(readCandidate(root,name),/^Error: M102_CONFIG_READ_REFUSED$/);
 const bytes=Buffer.alloc(MAX_BYTES,0x41);await fs.writeFile(path.join(root,'max.cfg'),bytes);
 assert.equal((await readCandidate(root,'max.cfg')).byteCount,MAX_BYTES);
});
test('symlink candidate and noncanonical root are refused on Linux',{skip:process.platform!=='linux'},async t=>{
 const root=await fixture(t),other=await fixture(t);
 await fs.writeFile(path.join(other,'secret.cfg'),'outside sentinel');
 await fs.symlink(path.join(other,'secret.cfg'),path.join(root,'alias.cfg'));
 await fs.symlink(other,path.join(root,'outside'),'dir');
 await assert.rejects(readCandidate(root,'alias.cfg'),/M102_CONFIG_READ_REFUSED/);
 await assert.rejects(readCandidate(path.join(root,'outside'),'secret.cfg'),/M102_CONFIG_READ_REFUSED/);
 assert.equal(await fs.readFile(path.join(other,'secret.cfg'),'utf8'),'outside sentinel');
});
test('cancellation before and during positional read refuses and closes the handle',async t=>{
 const root=await fixture(t);await fs.writeFile(path.join(root,'cancel.cfg'),Buffer.alloc(8192,0x41));
 const before=new AbortController();before.abort();
 await assert.rejects(readCandidate(root,'cancel.cfg',before.signal),/M102_CONFIG_READ_CANCELLED/);
 const mid=new AbortController();let closed=0;
 const reader=createCandidateReader({...fs,open:async(...args)=>{
  const h=await fs.open(...args);
  return {stat:(...a)=>h.stat(...a),read:async(...a)=>{const r=await h.read(...a);mid.abort();return r;},
   close:async()=>{closed++;await h.close();}};
 }});
 await assert.rejects(reader(root,'cancel.cfg',mid.signal),/M102_CONFIG_READ_CANCELLED/);
 assert.equal(closed,1);
});
test('two snapshots disagree even when injected metadata remains unchanged',async t=>{
 const root=await fixture(t);await fs.writeFile(path.join(root,'drift.cfg'),'fixed bytes');
 let reads=0,closed=0;
 const reader=createCandidateReader({...fs,open:async(...args)=>{
  const h=await fs.open(...args);
  return {stat:(...a)=>h.stat(...a),read:async(...a)=>{
   const r=await h.read(...a);if(++reads===2)a[0][0]^=1;return r;
  },close:async()=>{closed++;await h.close();}};
 }});
 await assert.rejects(reader(root,'drift.cfg'),/M102_CONFIG_READ_REFUSED/);
 assert.equal(reads,2);assert.equal(closed,1);
});
