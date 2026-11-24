'use strict';
// Fixed local mod-folder hints only. No enumeration or game content reads.
const fs=require('node:fs/promises');
const path=require('node:path');
const {assertInspectionActive}=require('./game-inspection.cjs');
const names=Object.freeze({ets2:'Euro Truck Simulator 2',ats:'American Truck Simulator'});
function createTruckModLocator(fsApi=fs){
 return async function locate(game,{platform,home,documents},signal){
  assertInspectionActive(signal);
  if(!Object.hasOwn(names,game))throw Error('Simulador inválido.');
  const base=platform==='linux'&&typeof home==='string'?path.join(home,'.local','share'):
   platform==='win32'?documents:null;
  if(typeof base!=='string'||!path.isAbsolute(base)||base!==path.normalize(base)||
     base.startsWith('\\\\')||base===path.parse(base).root||/[\x00-\x1f\x7f]/.test(base))
   throw Error('Localização indisponível.');
  const candidate=path.join(base,names[game],'mod');
  const root=path.parse(candidate).root,parts=candidate.slice(root.length).split(path.sep);
  if(parts.length>32||candidate.length>4096)throw Error('Localização indisponível.');
  let current=root;
  for(const part of parts){
   current=path.join(current,part);
   assertInspectionActive(signal);
   let stat;
   try{stat=await fsApi.lstat(current);}
   catch(e){if(['ENOENT','ENOTDIR'].includes(e?.code))return null;throw e;}
   assertInspectionActive(signal);
   if(!stat.isDirectory()||stat.isSymbolicLink())return null;
  }
  return candidate;
 };
}
module.exports={createTruckModLocator,locateTruckMod:createTruckModLocator()};
