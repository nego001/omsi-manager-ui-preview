'use strict';
// Fixed, bounded Linux Steam path hints. Never enumerate a disk or open game files.
// This is not installation verification or atomic path containment.
const fs=require('node:fs/promises');
const path=require('node:path');
const {assertInspectionActive}=require('./game-inspection.cjs');
const ROOTS=Object.freeze([
 ['.local','share','Steam'],
 ['.var','app','com.valvesoftware.Steam','data','Steam'],
 ['.steam','steam']
].map(Object.freeze));
const missing=e=>['ENOENT','ENOTDIR'].includes(e?.code);
function createOmsiSteamLocator(fsApi=fs){
 async function stat(target,signal){
  assertInspectionActive(signal);
  try{
   const s=await fsApi.lstat(target);
   assertInspectionActive(signal);
   return s.isSymbolicLink()?null:s;
  }catch(e){if(missing(e))return null;throw e;}
 }
 return async function locate(home,signal){
  if(typeof home!=='string'||!path.isAbsolute(home)||home===path.parse(home).root)
   throw Error('Localização indisponível.');
  const base=await stat(home,signal);
  if(!base?.isDirectory())return null;
  const matches=[];
  for(const root of ROOTS){
   let current=home,ok=true;
   for(const part of [...root,'steamapps','common','OMSI 2']){
    current=path.join(current,part);
    if(!(await stat(current,signal))?.isDirectory()){ok=false;break;}
   }
   if(!ok)continue;
   const vehicles=await stat(path.join(current,'Vehicles'),signal);
   const maps=await stat(path.join(current,'maps'),signal);
   const exe=await stat(path.join(current,'Omsi.exe'),signal);
   const alt=exe?.isFile()?null:await stat(path.join(current,'OMSI.exe'),signal);
   if(vehicles?.isDirectory()&&maps?.isDirectory()&&(exe?.isFile()||alt?.isFile()))
    matches.push(current);
  }
  assertInspectionActive(signal);
  // Ambiguous candidates require manual selection, not a silent first match.
  return matches.length===1?matches[0]:null;
 };
}
module.exports={createOmsiSteamLocator,locateOmsiSteam:createOmsiSteamLocator()};
