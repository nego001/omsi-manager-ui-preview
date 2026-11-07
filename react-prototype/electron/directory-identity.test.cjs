'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {
 directoryIdentity,createDirectoryCounter,createGameDirectoryInspector
}=require('./game-inspection.cjs');
async function fixture(t){
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'omsi-native-count-'));
 t.after(()=>fsp.rm(root,{recursive:true,force:true}));
 return root;
}
function changed(error){return /identidade da pasta mudou/.test(error.message);}
test('directory identity rejects files and compares inode, mode and change timestamps',async(t)=>{
 const root=await fixture(t);
 const file=path.join(root,'not-a-folder.zip');
 await fsp.writeFile(file,'PRIVATE-CONTENTS');
 const [a,b]=await Promise.all([
  fsp.lstat(root,{bigint:true}),fsp.lstat(file,{bigint:true})
 ]);
 assert.equal(directoryIdentity(b),null);
 assert.match(directoryIdentity(a),/^[0-9]+:[0-9]+:/);
 const modified={...a,ino:a.ino+1n,
  isDirectory:()=>true,isSymbolicLink:()=>false};
 assert.notEqual(directoryIdentity(a),directoryIdentity(modified));
});
test('unchanged directory is counted without exposing entry names or reading file bytes',async(t)=>{
 const root=await fixture(t),dir=path.join(root,'mod');
 await fsp.mkdir(dir);
 await fsp.writeFile(path.join(dir,'secret.scs'),'NEVER-OPEN-ME');
 let opened=0;
 const counter=createDirectoryCounter({
  ...fsp,
  opendir:async folder=>{opened++;return fsp.opendir(folder);},
  readFile:async()=>{throw Error('file content must not be read');}
 });
 const result=await counter(dir,5,true);
 assert.equal(opened,1);
 assert.equal(result.packageCandidates,1);
 assert.equal(result.count,1);
 assert.equal(JSON.stringify(result).includes('secret.scs'),false);
});
test('replacement after initial lstat and before opendir is refused',async(t)=>{
 const root=await fixture(t),dir=path.join(root,'mod');
 await fsp.mkdir(dir);
 await fsp.writeFile(path.join(dir,'private.zip'),'AAA');
 let opened=0;
 const counter=createDirectoryCounter({
  ...fsp,opendir:async folder=>{
   await fsp.rename(folder,folder+'.parked');
   await fsp.mkdir(folder);
   opened++;
   return fsp.opendir(folder);
  }
 });
 await assert.rejects(counter(dir,5,true),changed);
 assert.equal(opened,1);
});
test('directory disappearance between initial check and opening is not an empty scan',async(t)=>{
 const root=await fixture(t),dir=path.join(root,'mod');
 await fsp.mkdir(dir);
 const counter=createDirectoryCounter({
  ...fsp,opendir:async folder=>{
   await fsp.rmdir(folder);
   return fsp.opendir(folder);
  }
 });
 await assert.rejects(counter(dir),changed);
});
test('metadata change observed only after enumeration fails closed',async(t)=>{
 const root=await fixture(t),dir=path.join(root,'mod');
 await fsp.mkdir(dir);
 await fsp.writeFile(path.join(dir,'one.scs'),'A');
 let stats=0;
 const counter=createDirectoryCounter({
  ...fsp,lstat:async(folder,options)=>{
   const result=await fsp.lstat(folder,options);
   if(++stats===3){
    return Object.assign(Object.create(Object.getPrototypeOf(result)),
     result,{ino:result.ino+7n});
   }
   return result;
  }
 });
 await assert.rejects(counter(dir),changed);
 assert.equal(stats,3);
});
test('unsafe link introduced between check and opening is refused before enumeration',async(t)=>{
 const root=await fixture(t),dir=path.join(root,'mod');
 await fsp.mkdir(dir);
 let scans=0,probes=0;
 const counter=createDirectoryCounter({
  ...fsp,
  opendir:async folder=>{
   scans++;return fsp.opendir(folder);
  },
  lstat:async(folder,options)=>{
   const stat=await fsp.lstat(folder,options);
   probes++;
   if(probes===2){
    return Object.assign(Object.create(Object.getPrototypeOf(stat)),
     stat,{isSymbolicLink:()=>true});
   }
   return stat;
  }
 });
 await assert.rejects(counter(dir),changed);
 assert.equal(scans,1);
});
test('root replaced during realpath resolution cannot produce plausible counts',async(t)=>{
 const root=await fixture(t);
 t.after(()=>fsp.rm(root+'.old',{recursive:true,force:true}));
 await fsp.mkdir(path.join(root,'Vehicles'));
 let switched=false;
 const inspector=createGameDirectoryInspector({
  ...fsp,
  realpath:async selected=>{
   if(!switched){
    switched=true;
    await fsp.rename(root,root+'.old');
    await fsp.mkdir(root);
   }
   return fsp.realpath(selected);
  }
 });
 await assert.rejects(inspector(root,'omsi'),changed);
});
test('root identity changes before the next group are rejected',async(t)=>{
 const root=await fixture(t);
 await fsp.mkdir(path.join(root,'Vehicles'));
 await fsp.mkdir(path.join(root,'maps'));
 let seen=0;
 const inspector=createGameDirectoryInspector({
  ...fsp,
  lstat:async(folder,options)=>{
   const stat=await fsp.lstat(folder,options);
   if(folder===root&&++seen>=7){
    return Object.assign(Object.create(Object.getPrototypeOf(stat)),
     stat,{ino:stat.ino+1n});
   }
   return stat;
  }
 });
 await assert.rejects(inspector(root,'omsi'),changed);
 assert.ok(seen>=7);
});
test('a real symlink at a group path is reported absent and not traversed',async(t)=>{
 const root=await fixture(t),outside=await fixture(t);
 await fsp.mkdir(path.join(outside,'secret'));
 try{await fsp.symlink(outside,path.join(root,'Vehicles'),'dir');}
 catch(error){
  if(['EPERM','EACCES','ENOTSUP'].includes(error.code)){
   t.skip('symlink support unavailable');return;
  }
  throw error;
 }
 const report=await createGameDirectoryInspector()(root,'omsi');
 assert.equal(report.groups[0].found,false);
 assert.equal(report.recognized,false);
 assert.equal(JSON.stringify(report).includes(outside),false);
});
test('unchanged real hierarchy keeps standard counters and read-only assessment',async(t)=>{
 const root=await fixture(t);
 await fsp.mkdir(path.join(root,'Vehicles'));
 await fsp.mkdir(path.join(root,'maps'));
 await fsp.writeFile(path.join(root,'maps','readme.txt'),'DONOTREAD');
 const report=await createGameDirectoryInspector()(root,'omsi');
 assert.equal(report.groups[0].found,true);
 assert.equal(report.groups[1].files,1);
 assert.equal(report.assessment.compatibilityVerified,false);
 assert.equal(report.mode,'read-only');
 assert.equal(JSON.stringify(report).includes(root),false);
});
