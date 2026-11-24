'use strict';
// Advisory Steam manifest metadata only, not executable version or integrity.
// Linux-only until Windows reparse-point-safe manifest reads are validated.
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const path=require('node:path');
const {assertInspectionActive,requireGameId}=require('./game-inspection.cjs');
const {parseKeyValues}=require('./steam-discovery.cjs');
const MAX=128*1024;
const SPEC=Object.freeze({
 omsi:Object.freeze({id:'252530',folder:'OMSI 2'}),
 ets2:Object.freeze({id:'227300',folder:'Euro Truck Simulator 2'}),
 ats:Object.freeze({id:'270880',folder:'American Truck Simulator'})
});
function parseBuild(text,game){
 requireGameId(game);
 if(typeof text!=='string'||Buffer.byteLength(text)>MAX)throw Error('Manifesto inválido.');
 const spec=SPEC[game],root=parseKeyValues(text,'appstate');
 const build=root.get('buildid');
 if(root.get('appid')!==spec.id||root.get('installdir')!==spec.folder||
    typeof build!=='string'||!/^[1-9]\d{0,19}$/.test(build))throw Error('Manifesto inválido.');
 return build;
}
function identity(s){
 if(!s?.isFile()||s.isSymbolicLink())return null;
 return [s.dev,s.ino,s.mode,s.size,s.ctimeNs,s.mtimeNs].map(String).join(':');
}
function createSteamBuildReader(fsApi=fs){
 return async function read(game,candidate,platform,signal){
  requireGameId(game);assertInspectionActive(signal);
  if(platform!=='linux'||process.platform!=='linux')return null;
  const spec=SPEC[game];
  // Only a main-owned freshly discovered canonical-shaped candidate may
  // enter here; do not interpret path fields from manifest data.
  if(typeof candidate!=='string'||!path.isAbsolute(candidate)||candidate!==path.normalize(candidate)||
     candidate.length>4096||path.basename(candidate)!==spec.folder||
     path.basename(path.dirname(candidate))!=='common'||
     path.basename(path.dirname(path.dirname(candidate)))!=='steamapps')return null;
  const manifest=path.join(path.dirname(path.dirname(candidate)),'appmanifest_'+spec.id+'.acf');
  let fd;
  try{
   const root=path.parse(manifest).root,parts=manifest.slice(root.length).split(path.sep);
   if(parts.length>32)return null;
   let current=root;
   for(const part of parts.slice(0,-1)){
    current=path.join(current,part);
    assertInspectionActive(signal);
    const s=await fsApi.lstat(current,{bigint:true});
    if(!s.isDirectory()||s.isSymbolicLink())return null;
   }
   const initial=await fsApi.lstat(manifest,{bigint:true}),proof=identity(initial);
   if(!proof||initial.size>BigInt(MAX))return null;
   assertInspectionActive(signal);
   fd=await fsApi.open(manifest,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
   if(identity(await fd.stat({bigint:true}))!==proof)return null;
   const bytes=Buffer.alloc(MAX+1);
   const {bytesRead}=await fd.read(bytes,0,bytes.length,0);
   assertInspectionActive(signal);
   if(bytesRead!==Number(initial.size)||bytesRead>MAX||
      identity(await fd.stat({bigint:true}))!==proof||
      identity(await fsApi.lstat(manifest,{bigint:true}))!==proof)return null;
   const build=parseBuild(bytes.subarray(0,bytesRead).toString('utf8'),game);
   assertInspectionActive(signal);
   return build;
  }catch{
   assertInspectionActive(signal);
   return null;
  }finally{await fd?.close();}
 };
}
module.exports={parseBuild,createSteamBuildReader,readSteamBuild:createSteamBuildReader()};
