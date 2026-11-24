'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createOmsiStructureInspector}=require('./omsi-structure-hints.cjs');
async function fixture(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-m80-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 return dir;
}
test('only selected folder metadata; no contents, nested enumeration or filenames returned',async t=>{
 const root=await fixture(t),canonical=await fs.realpath(root);
 await fs.writeFile(path.join(root,'Private.BUS'),'SENTINEL');
 await fs.writeFile(path.join(root,'ai.ovh'),'SENTINEL');
 await fs.writeFile(path.join(root,'fake.bus.txt'),'SENTINEL');
 await fs.mkdir(path.join(root,'folder.map'));
 await fs.writeFile(path.join(root,'folder.map','nested.map'),'SENTINEL');
 const api={};
 for(const method of ['realpath','lstat','opendir'])api[method]=async(p,...args)=>{
  assert.ok([root,canonical].includes(p));return fs[method](p,...args);
 };
 const result=await createOmsiStructureInspector(api)(root,'omsi');
 assert.equal(result.kind,'vehicle-candidate');assert.equal(result.busFiles,1);
 assert.equal(result.aiVehicleFiles,1);assert.equal(result.mapTiles,0);
 assert.equal(result.contentVerified,false);
 for(const secret of [root,'Private.BUS','SENTINEL'])assert.ok(!JSON.stringify(result).includes(secret));
});
test('map requires both marker types; mixed evidence is not resolved into a single class',async t=>{
 const root=await fixture(t),scan=createOmsiStructureInspector();
 await fs.writeFile(path.join(root,'global.cfg'),'x');
 assert.equal((await scan(root,'omsi')).kind,'inconclusive');
 await fs.writeFile(path.join(root,'tile_0_0.map'),'x');
 assert.equal((await scan(root,'omsi')).kind,'map-candidate');
 await fs.writeFile(path.join(root,'bus.bus'),'x');
 assert.equal((await scan(root,'omsi')).kind,'mixed');
});
test('symlinked entries are skipped and linked selected folders refused',async t=>{
 const root=await fixture(t),target=await fixture(t);
 await fs.writeFile(path.join(target,'secret.bus'),'x');
 try{await fs.symlink(path.join(target,'secret.bus'),path.join(root,'fake.bus'),'file');await fs.symlink(target,path.join(root,'link'),'dir');}
 catch(e){if(['EPERM','EACCES','ENOTSUP'].includes(e.code)){t.skip('symlinks unavailable');return;}throw e;}
 const scan=createOmsiStructureInspector();
 const r=await scan(root,'omsi');assert.equal(r.busFiles,0);assert.equal(r.linksSkipped,2);
 await assert.rejects(scan(path.join(root,'link'),'omsi'));
});
test('cancellation and changed selected identity fail closed',async t=>{
 const root=await fixture(t),controller=new AbortController();
 controller.abort();
 await assert.rejects(createOmsiStructureInspector()(root,'omsi',controller.signal));
 let changed=false;
 const scan=createOmsiStructureInspector({...fs,lstat:async(p,opts)=>{
  const info=await fs.lstat(p,opts);
  if(changed)info.mtimeNs+=1n;
  return info;
 },opendir:async p=>{
  const dir=await fs.opendir(p);
  await fs.mkdir(path.join(root,'changed'));
  // A real mutation may share a filesystem clock tick. Inject an observed
  // metadata difference below, independently of timestamp granularity.
  changed=true;
  return dir;
 }});
 await assert.rejects(scan(root,'omsi'),/identidade/);
});
test('budget counts all entries without reading content',async t=>{
 const root=await fixture(t);
 const scan=createOmsiStructureInspector({...fs,opendir:async()=>({
  async *[Symbol.asyncIterator](){for(let i=0;i<2001;i++)yield {name:'x.bus',isFile:()=>true,isSymbolicLink:()=>false};},
  async close(){}
 })});
 const r=await scan(root,'omsi');assert.equal(r.busFiles,2000);assert.equal(r.limited,true);
});
