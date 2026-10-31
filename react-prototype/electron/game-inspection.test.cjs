'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {requireGameId,inspectGameDirectory,countDirectChildren,MAX_ENTRIES_PER_GROUP} = require('./game-inspection.cjs');

test('only allow explicit game identifiers',()=>{
  for(const id of ['../etc','C:\\Games','omsi2','',null,{},['omsi']]) {
    assert.throws(()=>requireGameId(id),/Jogo inválido/);
  }
  assert.equal(requireGameId('omsi'),'omsi');
  assert.equal(requireGameId('ets2'),'ets2');
  assert.equal(requireGameId('ats'),'ats');
});
test('count only direct entries, no recursive traversal and no file content',async(t)=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-inspect-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'Vehicles','Bus A'),{recursive:true});
  await fs.mkdir(path.join(root,'Vehicles','Bus B'),{recursive:true});
  await fs.writeFile(path.join(root,'Vehicles','Bus A','main.bus'),'TEST_ONLY');
  await fs.mkdir(path.join(root,'maps'));
  await fs.mkdir(path.join(root,'maps','Sample Map'));
  const result=await inspectGameDirectory(root,'omsi');
  assert.deepEqual(result.groups.map(g=>[g.key,g.found,g.count]),[
    ['vehicles',true,2],['maps',true,1],['scenery',false,0],['splines',false,0]
  ]);
  assert.equal(result.status,'ok');
  assert.equal(result.recognized,true);
  assert.equal(result.mode,'read-only');
  assert.equal(JSON.stringify(result).includes(root),false,'Absolute paths must never be returned');
  const file=await fs.readFile(path.join(root,'Vehicles','Bus A','main.bus'),'utf8');
  assert.equal(file,'TEST_ONLY','Inspection did not change content');
});
test('do not traverse symlinked game-content folders',async(t)=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-symlink-'));
  const outside=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-outside-'));
  t.after(async()=>{await fs.rm(root,{recursive:true,force:true});await fs.rm(outside,{recursive:true,force:true});});
  await fs.mkdir(path.join(outside,'Secret'));
  try {await fs.symlink(outside,path.join(root,'Vehicles'),'dir');}
  catch(err){if(['EPERM','EACCES','ENOTSUP'].includes(err.code)){t.skip('Symlinks not available');return;}throw err;}
  const result=await inspectGameDirectory(root,'omsi');
  assert.equal(result.groups[0].found,false);
  await assert.rejects(inspectGameDirectory(path.join(root,'Vehicles'),'omsi'));
});
test('large folders are capped without recursion',async(t)=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-cap-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const dir=path.join(root,'mod');await fs.mkdir(dir);
  for(let i=0;i<12;i++)await fs.writeFile(path.join(dir,i+'.scs'),'x');
  const result=await countDirectChildren(dir,5);
  assert.equal(result.count,5);assert.equal(result.limited,true);
  assert.equal(MAX_ENTRIES_PER_GROUP,2000);
  const exact=await countDirectChildren(dir,12);
  assert.equal(exact.count,12);
  assert.equal(exact.limited,false,'Exactly the limit is a complete count');
});
test('unknown or empty directories cannot be mistaken for recognized game folders',async(t)=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-empty-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const result=await inspectGameDirectory(root,'ets2');
  assert.equal(result.recognized,false);assert.equal(result.groups[0].count,0);
});

test('ETS2 and ATS classify package name candidates without opening mod files',async(t)=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-packages-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const mod=path.join(root,'mod');
 await fs.mkdir(mod);
 await fs.mkdir(path.join(mod,'loose-folder'));
 for(const file of ['test.SCS','another.zip','notes.txt','download.zip.exe']){
   await fs.writeFile(path.join(mod,file),'SENTINEL_DO_NOT_READ');
 }
 for(const game of ['ets2','ats']){
   const report=await inspectGameDirectory(root,game);
   const group=report.groups[0];
   assert.equal(group.found,true);
   assert.equal(group.directories,1);
   assert.equal(group.files,4);
   assert.equal(group.packageCandidates,2);
   assert.equal(group.count,5);
   assert.equal(report.notices.some(n=>n.code==='mods-not-verified'),true);
   assert.equal(JSON.stringify(report).includes(path.join(mod,'notes.txt')),false);
 }
 assert.equal(await fs.readFile(path.join(mod,'test.SCS'),'utf8'),'SENTINEL_DO_NOT_READ');
});
test('inspection diagnostics explicitly distinguish unknown folders and partial enumerations',async(t)=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-diag-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 let report=await inspectGameDirectory(root,'omsi');
 assert.deepEqual(report.notices.map(n=>n.code),['no-known-folders']);
 await fs.mkdir(path.join(root,'Vehicles'));
 report=await inspectGameDirectory(root,'omsi');
 assert.equal(report.recognized,true);
 assert.equal(report.groups[0].found,true);
 assert.equal(report.groups[0].count,0);
 assert.equal(report.notices.some(n=>n.code==='omsi-structure-incomplete'),true);
});
test('symlink entries are ignored and included in the scan budget',async(t)=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-links-budget-'));
 const outside=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-links-out-'));
 t.after(async()=>{await fs.rm(root,{recursive:true,force:true});await fs.rm(outside,{recursive:true,force:true});});
 const folder=path.join(root,'mod');await fs.mkdir(folder);
 try{for(let i=0;i<6;i++)await fs.symlink(outside,path.join(folder,'link'+i),'dir');}
 catch(err){if(['EPERM','EACCES','ENOTSUP'].includes(err.code)){t.skip('Links unavailable');return;}throw err;}
 const report=await countDirectChildren(folder,4,true);
 assert.equal(report.count,0);
 assert.equal(report.files,0);
 assert.equal(report.linksSkipped,4);
 assert.equal(report.limited,true);
});

test('ETS2 and ATS support selecting the mod folder itself as well as its parent',async(t)=>{
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-direct-mod-'));
 t.after(()=>fs.rm(base,{recursive:true,force:true}));
 const mod=path.join(base,'mod');
 await fs.mkdir(mod);
 await fs.writeFile(path.join(mod,'bus_sound.SCS'),'SENTINEL');
 await fs.writeFile(path.join(mod,'livery.zip'),'SENTINEL');
 for(const game of ['ets2','ats']){
  const parent=await inspectGameDirectory(base,game);
  const direct=await inspectGameDirectory(mod,game);
  assert.equal(parent.selectionMode,'parent-folder');
  assert.equal(direct.selectionMode,'direct-mod-folder');
  assert.equal(parent.groups[0].count,2);
  assert.equal(direct.groups[0].count,2);
  assert.equal(direct.groups[0].packageCandidates,2);
  assert.equal(direct.recognized,true);
  assert.equal(direct.assessment.compatibilityVerified,false);
  assert.equal(direct.assessment.installationVerified,false);
  assert.equal(direct.assessment.scope,'directory-structure-only');
  assert.equal(direct.notices.some(n=>n.code==='direct-mod-folder'),true);
  assert.equal(JSON.stringify(direct).includes(base),false);
  assert.equal(JSON.stringify(parent).includes(base),false);
 }
});
test('empty mod folder never implies installation, validation, or compatibility',async(t)=>{
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-empty-mod-'));
 t.after(()=>fs.rm(base,{recursive:true,force:true}));
 await fs.mkdir(path.join(base,'mod'));
 const r=await inspectGameDirectory(path.join(base,'mod'),'ets2');
 assert.equal(r.recognized,true);
 assert.equal(r.groups[0].files,0);
 assert.equal(r.groups[0].packageCandidates,0);
 assert.equal(r.assessment.compatibilityVerified,false);
 assert.equal(r.assessment.installationVerified,false);
 assert.equal(r.notices.some(n=>n.code==='no-package-candidates'),true);
});
test('partial OMSI directory structure is informational, not failed compatibility',async(t)=>{
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-partial-'));
 t.after(()=>fs.rm(base,{recursive:true,force:true}));
 await fs.mkdir(path.join(base,'Vehicles'));
 const r=await inspectGameDirectory(base,'omsi');
 assert.equal(r.recognized,true);
 assert.equal(r.groups.filter(x=>x.found).length,1);
 assert.equal(r.notices.some(n=>n.code==='omsi-structure-incomplete'),true);
 assert.equal(r.assessment.compatibilityVerified,false);
 assert.equal(r.assessment.installationVerified,false);
});
