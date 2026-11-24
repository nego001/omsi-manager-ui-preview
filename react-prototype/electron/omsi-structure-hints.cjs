'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {directoryIdentity,assertInspectionActive}=require('./game-inspection.cjs');
const MAX_ENTRIES=2000;
function createOmsiStructureInspector(api=fs){
 return async function inspectOmsiCandidate(selected,game,signal){
  if(game!=='omsi'||typeof selected!=='string'||!path.isAbsolute(selected)||selected.includes('\0'))
   throw Error('Seleção inválida.');
  assertInspectionActive(signal);
  const identity=directoryIdentity(await api.lstat(selected,{bigint:true}));
  if(!identity)throw Error('Pasta não autorizada.');
  const canonical=await api.realpath(selected);
  async function verify(){
   assertInspectionActive(signal);
   if(await api.realpath(selected)!==canonical||
      directoryIdentity(await api.lstat(selected,{bigint:true}))!==identity||
      directoryIdentity(await api.lstat(canonical,{bigint:true}))!==identity)
    throw Error('A identidade da pasta mudou.');
   assertInspectionActive(signal);
  }
  let dir;
  let busFiles=0,aiVehicleFiles=0,mapTiles=0,globalConfig=false,limited=false,linksSkipped=0,scanned=0;
  try{
   await verify();
   dir=await api.opendir(canonical);
   await verify();
   for await(const entry of dir){
    assertInspectionActive(signal);
    if(scanned++>=MAX_ENTRIES){limited=true;break;}
    if(entry.isSymbolicLink()){linksSkipped++;continue;}
    if(!entry.isFile())continue;
    const name=entry.name.toLowerCase();
    if(name.endsWith('.bus'))busFiles++;
    else if(name.endsWith('.ovh'))aiVehicleFiles++;
    else if(name.endsWith('.map'))mapTiles++;
    else if(name==='global.cfg')globalConfig=true;
   }
   await verify();
  }finally{
   if(dir)try{await dir.close();}catch(error){if(error?.code!=='ERR_DIR_CLOSED')throw error;}
  }
  await verify();
  const vehicle=busFiles+aiVehicleFiles>0;
  const map=globalConfig&&mapTiles>0;
  return {status:'structure-hints',scope:'direct-entry-names-only',
   kind:vehicle&&map?'mixed':vehicle?'vehicle-candidate':map?'map-candidate':'inconclusive',
   busFiles,aiVehicleFiles,mapTiles,globalConfig,limited,linksSkipped,
   contentVerified:false,compatibilityVerified:false};
 };
}
module.exports={createOmsiStructureInspector,inspectOmsiCandidate:createOmsiStructureInspector(),MAX_ENTRIES};
