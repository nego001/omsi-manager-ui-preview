'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {segments,observeDependencies:observe,createDependencyObserver,MAX_ENTRIES}=require('../scripts/m104-bounded-local-dependency-observation.cjs');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'omsi-m104-deps-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;
}
async function write(root,name,text){await fs.writeFile(path.join(root,name),text,{flag:'wx'});}
test('exact and case-only observations, absent entry, invalid path and unresolved argument are distinct',async t=>{
 const root=await fixture(t);await fs.mkdir(path.join(root,'Model'));
 await write(root,'Model/Real.cfg','not parsed');
 await write(root,'Test.bus','[model]\nModel\\Real.cfg\n[model]\nmodel\\real.cfg\n[model]\nModel\\missing.cfg\n[model]\n..\\escape.cfg\n[model]\n; comment\n[sound]\nsound.cfg\n');
 const r=await observe(root,'Test.bus','vehicle-definition','utf-8');
 for(const s of ['exact-observed','case-only-observed','not-observed-in-directory','invalid-reference','unresolved-argument'])assert.equal(r.counts[s],1);
 assert.equal(r.referenceOccurrences,5);assert.equal(r.unexaminedKnownMarkers,1);
 assert.doesNotMatch(JSON.stringify(r),/Real\.cfg|Test\.bus|escape\.cfg/);
});
test('mesh checks relative to explicitly selected model folder and does not parse dependency',async t=>{
 const root=await fixture(t);await write(root,'Model.cfg','[mesh]\nmesh.o3d\n[mesh]\nfolder.o3d\n');
 await write(root,'mesh.o3d',Buffer.from([0,255,0]));await fs.mkdir(path.join(root,'folder.o3d'));
 const r=await observe(root,'Model.cfg','vehicle-model','utf-8');
 assert.equal(r.counts['exact-observed'],1);assert.equal(r.counts['not-regular-path'],1);
 assert.equal(r.dependencyContentsRead,false);assert.equal(r.operationsEnabled,false);
 assert.deepEqual(await fs.readFile(path.join(root,'mesh.o3d')),Buffer.from([0,255,0]));
});
test('path admission rejects absolute, traversal, devices, streams, controls and unsupported suffixes',()=>{
 for(const p of ['/a.cfg','C:\\a.cfg','\\\\server\\a.cfg','a/../b.cfg','a//b.cfg','a.cfg:stream','NUL.cfg','a.cfg\n','a /b.cfg','é.cfg','a.o3d'])
  assert.equal(segments(p,'.cfg'),null,p);
 assert.deepEqual(segments('model\\a.cfg','.cfg'),['model','a.cfg']);
});
test('case collisions are ambiguous where the filesystem supports distinct spellings',async t=>{
 const root=await fixture(t);await write(root,'Mesh.o3d','one');
 try{await write(root,'mesh.o3d','two');}catch(e){if(e.code==='EEXIST'){t.skip('case-insensitive fixture filesystem');return;}throw e;}
 await write(root,'Model.cfg','[mesh]\nMesh.o3d\n');
 assert.equal((await observe(root,'Model.cfg','vehicle-model','utf-8')).counts['ambiguous-case'],1);
});
test('linked dependency and directory are not followed on Linux',{skip:process.platform!=='linux'},async t=>{
 const root=await fixture(t),outside=await fixture(t);await write(outside,'secret.cfg','untouched');
 await fs.symlink(path.join(outside,'secret.cfg'),path.join(root,'alias.cfg'));
 await fs.symlink(outside,path.join(root,'linked'),'dir');
 await write(root,'Test.bus','[model]\nalias.cfg\n[model]\nlinked\\secret.cfg\n');
 const r=await observe(root,'Test.bus','vehicle-definition','utf-8');
 assert.equal(r.counts['link-refused'],2);assert.equal(await fs.readFile(path.join(outside,'secret.cfg'),'utf8'),'untouched');
});
test('global enumeration budget cannot become a missing dependency claim',async t=>{
 const root=await fixture(t);await write(root,'Test.bus','[model]\nmissing.cfg\n[model]\nother.cfg\n');
 let reads=0,closes=0;
 const api={...fs,opendir:async()=>({read:async()=>{reads++;return {name:'irrelevant'+reads};},close:async()=>{closes++;}})};
 const r=await createDependencyObserver(api)(root,'Test.bus','vehicle-definition','utf-8');
 assert.equal(reads,MAX_ENTRIES);assert.equal(r.entriesScanned,MAX_ENTRIES);
 assert.equal(r.counts['budget-limited'],2);assert.equal(r.counts['not-observed-in-directory'],0);
 assert.equal(closes,2);
});
test('cancelled scan and source drift refuse without reporting private paths',async t=>{
 const root=await fixture(t);await write(root,'Test.bus','[model]\na.cfg\n');
 const c=new AbortController();let closed=0;
 const api={...fs,opendir:async()=>({read:async()=>{c.abort();return {name:'a.cfg'};},close:async()=>{closed++;}})};
 await assert.rejects(createDependencyObserver(api)(root,'Test.bus','vehicle-definition','utf-8',c.signal),/M104_DEPENDENCY_OBSERVATION_CANCELLED/);
 assert.equal(closed,1);
 const changed={...fs,opendir:async()=>({read:async()=>{await fs.writeFile(path.join(root,'Test.bus'),'changed');return null;},close:async()=>{}})};
 await assert.rejects(createDependencyObserver(changed)(root,'Test.bus','vehicle-definition','utf-8'),/^Error: M104_DEPENDENCY_OBSERVATION_REFUSED$/);
});
