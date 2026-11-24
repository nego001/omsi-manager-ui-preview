'use strict';
// Bounded search only within an explicitly chosen folder. No game contents.
const fs=require('node:fs/promises');
const path=require('node:path');
const {directoryIdentity,assertInspectionActive}=require('./game-inspection.cjs');
const MAX_DEPTH=3,MAX_DIRECTORIES=128,MAX_ENTRIES=1024;
const missing=e=>['ENOENT','ENOTDIR'].includes(e?.code);
const changed=()=>{throw Error('CUSTOM_DISCOVERY_INCONCLUSIVE');};
function createCustomOmsiDiscovery(fsApi=fs){
 return async function discover(root,signal){
  assertInspectionActive(signal);
  if(typeof root!=='string'||!path.isAbsolute(root)||root===path.parse(root).root)changed();
  async function metadata(p){
   assertInspectionActive(signal);
   try{
    const s=await fsApi.lstat(p,{bigint:true});
    assertInspectionActive(signal);
    return s.isSymbolicLink()?null:s;
   }catch(e){if(missing(e))return null;throw e;}
  }
  const base=directoryIdentity(await metadata(root));
  if(!base)changed();
  const canonical=await fsApi.realpath(root);
  assertInspectionActive(signal);
  if(!directoryIdentity(await metadata(canonical))||
     directoryIdentity(await metadata(root))!==base)changed();
  const rootId=directoryIdentity(await metadata(canonical));
  if(rootId!==base)changed();
  async function check(p,id){
   if(directoryIdentity(await metadata(p))!==id)changed();
  }
  const pending=[{p:canonical,depth:0,id:rootId}],matches=[];
  let visited=0,entries=0,limited=false;
  while(pending.length){
   assertInspectionActive(signal);
   if(visited>=MAX_DIRECTORIES){limited=true;break;}
   const {p,depth,id}=pending.shift();visited++;
   await check(p,id);
   const vehicles=await metadata(path.join(p,'Vehicles'));
   const maps=await metadata(path.join(p,'maps'));
   if(vehicles?.isDirectory()&&maps?.isDirectory()){
    let marker=false;
    for(const name of ['Omsi.exe','OMSI.exe','omsi.exe']){
     if((await metadata(path.join(p,name)))?.isFile()){marker=true;break;}
    }
    await check(p,id);
    if(marker){matches.push(p);continue;}
   }
   // Do not open directories beyond the documented depth.
   if(depth>=MAX_DEPTH){limited=true;continue;}
   let dir;
   try{
    dir=await fsApi.opendir(p);
    await check(p,id);
    for await(const entry of dir){
     assertInspectionActive(signal);
     if(entries>=MAX_ENTRIES){limited=true;break;}
     entries++;
     if(!entry.isDirectory()||entry.isSymbolicLink()||entry.name.startsWith('.')||
        entry.name==='..'||entry.name.includes('/')||entry.name.includes('\\'))continue;
     const child=path.join(p,entry.name);
     const childId=directoryIdentity(await metadata(child));
     if(childId&&pending.length+visited<MAX_DIRECTORIES)
      pending.push({p:child,depth:depth+1,id:childId});
     else if(childId)limited=true;
    }
    await check(p,id);
   }finally{
    if(dir){try{await dir.close();}catch(e){if(e?.code!=='ERR_DIR_CLOSED')throw e;}}
   }
   if(entries>=MAX_ENTRIES){limited=true;break;}
  }
  await check(root,base);
  if(await fsApi.realpath(root)!==canonical)changed();
  await check(canonical,rootId);
  assertInspectionActive(signal);
  return {matches,limited};
 };
}
module.exports={createCustomOmsiDiscovery,discoverCustomOmsi:createCustomOmsiDiscovery(),MAX_DEPTH,MAX_DIRECTORIES,MAX_ENTRIES};
