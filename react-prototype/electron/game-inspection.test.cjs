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
