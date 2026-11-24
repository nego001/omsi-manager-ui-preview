'use strict';
// Bounded search only within an explicitly chosen folder. No game contents.
const fs=require('node:fs/promises');
const path=require('node:path');
const {directoryIdentity,assertInspectionActive,requireGameId}=require('./game-inspection.cjs');
const MAX_DEPTH=3,MAX_DIRECTORIES=128,MAX_ENTRIES=1024;
const missing=e=>['ENOENT','ENOTDIR'].includes(e?.code);
const changed=()=>{throw Error('CUSTOM_DISCOVERY_INCONCLUSIVE');};
function createCustomGameDiscovery(fsApi=fs){
 return async function discover(root,game,signal){
  requireGameId(game);
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
   let marker=false;
   if(game==='omsi'){
    const vehicles=await metadata(path.join(p,'Vehicles'));
    const maps=await metadata(path.join(p,'maps'));
    if(vehicles?.isDirectory()&&maps?.isDirectory()){
     for(const name of ['Omsi.exe','OMSI.exe','omsi.exe']){
      if((await metadata(path.join(p,name)))?.isFile()){marker=true;break;}
     }
    }
   }else{
    // Installation markers only: a Documents/mod folder is not a game.
    const bin=path.join(p,'bin'),binId=directoryIdentity(await metadata(bin));
    if(binId){
     const executable=game==='ets2'?'eurotrucks2':'amtrucks';
     for(const [sub,name] of [['linux_x64',executable],['win_x64',executable+'.exe']]){
      const arch=path.join(bin,sub),archId=directoryIdentity(await metadata(arch));
      if(!archId)continue;
      await check(bin,binId);
      await check(arch,archId);
      const found=(await metadata(path.join(arch,name)))?.isFile();
      await check(arch,archId);
      await check(bin,binId);
      if(found){marker=true;break;}
     }
    }
   }
   await check(p,id);
   if(marker){matches.push(p);continue;}
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
function createCustomOmsiDiscovery(fsApi=fs){
 const discover=createCustomGameDiscovery(fsApi);
 return (root,signal)=>discover(root,'omsi',signal);
}
module.exports={createCustomOmsiDiscovery,discoverCustomOmsi:createCustomOmsiDiscovery(),
 createCustomGameDiscovery,discoverCustomGame:createCustomGameDiscovery(),MAX_DEPTH,MAX_DIRECTORIES,MAX_ENTRIES};
