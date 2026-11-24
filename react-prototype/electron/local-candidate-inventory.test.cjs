'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createGameDirectoryInspector,isSafeInventoryLabel}=require('./game-inspection.cjs');
const {projectInspectionReport:project}=require('./inspection-report-projection.cjs');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'m78-fixture-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.mkdir(path.join(root,'mod'));
 return root;
}
test('metadata only, no nested scan, package names and directories only, bounded labels',async t=>{
 const root=await fixture(t),mod=path.join(root,'mod');
 await fs.mkdir(path.join(mod,'Ônibus RJ'));
 await fs.writeFile(path.join(mod,'Ônibus RJ','private.scs'),'SECRET');
 await fs.writeFile(path.join(mod,'a.SCS'),'SECRET');
 await fs.writeFile(path.join(mod,'b.zip'),'SECRET');
 await fs.writeFile(path.join(mod,'notes.txt'),'SECRET');
 // Allowlist filesystem calls: a content read or child scan fails this test.
 const allowed=new Set([root,mod]);
 const api={};
 for(const method of ['lstat','realpath','opendir'])api[method]=async(p,...args)=>{
  assert.ok(allowed.has(p));return fs[method](p,...args);
 };
 const scan=createGameDirectoryInspector(api);
 for(const game of ['ets2','ats']){
  const report=project(await scan(root,game),game);
  assert.deepEqual(report.groups[0].inventory.map(x=>x.label),['a.SCS','b.zip','Ônibus RJ']);
  assert.ok(!JSON.stringify(report).includes(root));
  assert.ok(!JSON.stringify(report).includes('SECRET'));
  assert.equal(report.assessment.compatibilityVerified,false);
 }
});
test('label budget independent from scan count; unsafe names not emitted',async t=>{
 const root=await fixture(t),mod=path.join(root,'mod');
 for(let i=0;i<105;i++)await fs.writeFile(path.join(mod,i+'.scs'),'x');
 const r=project(await createGameDirectoryInspector()(root,'ets2'),'ets2');
 assert.equal(r.groups[0].packageCandidates,105);
 assert.equal(r.groups[0].inventory.length,100);
 assert.equal(r.limited,false);
 for(const bad of ['../secret','C:\\secret','a\u202eb.zip','x\nz','\ud800','a'.repeat(161)])assert.equal(isSafeInventoryLabel(bad),false);
 assert.equal(isSafeInventoryLabel('Ônibus 🚌 RJ'),true);
});
test('projection refuses forged names, unsupported kinds, inflated counts and accessors',async t=>{
 const root=await fixture(t);
 await fs.writeFile(path.join(root,'mod','a.scs'),'x');
 const scan=createGameDirectoryInspector();
 for(const rows of [[{kind:'package',label:'../secret.scs'}],[{kind:'package',label:'note.txt'}],[{kind:'directory',label:'fake'}],[{kind:'package',label:'a.scs'},{kind:'package',label:'b.scs'}]]){
  const r=await scan(root,'ets2');r.groups[0].inventory=rows;
  assert.throws(()=>project(r,'ets2'),/Relatório/);
 }
 const r=await scan(root,'ets2');let reads=0;
 Object.defineProperty(r.groups[0].inventory[0],'label',{get(){reads++;throw Error('secret');}});
 assert.throws(()=>project(r,'ets2'),/Relatório/);assert.equal(reads,0);
});
