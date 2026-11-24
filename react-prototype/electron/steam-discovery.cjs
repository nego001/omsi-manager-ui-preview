'use strict';
// Read only bounded Steam library index metadata and fixed game markers.
// No arbitrary renderer paths, recursive scans, game content reads, or writes.
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const path=require('node:path');
const {assertInspectionActive,requireGameId}=require('./game-inspection.cjs');
const MAX_INDEX=512*1024, MAX_LIBRARIES=24;
const SPEC=Object.freeze({
 omsi:{folder:'OMSI 2',dirs:['Vehicles','maps'],files:[['Omsi.exe'],['OMSI.exe'],['omsi.exe']]},
 ets2:{folder:'Euro Truck Simulator 2',dirs:['bin'],files:[['bin','linux_x64','eurotrucks2'],['bin','win_x64','eurotrucks2.exe']]},
 ats:{folder:'American Truck Simulator',dirs:['bin'],files:[['bin','linux_x64','amtrucks'],['bin','win_x64','amtrucks.exe']]}
});
const missing=e=>['ENOENT','ENOTDIR'].includes(e?.code);
const fail=()=>{throw Error('STEAM_DISCOVERY_INCONCLUSIVE');};
function parseKeyValues(text,expectedRoot){
 if(typeof text!=='string'||Buffer.byteLength(text)>MAX_INDEX)fail();
 // Narrow KeyValues tokenizer: quoted strings, braces and line comments.
 const re=/"((?:\\["\\]|[^"\\\r\n])*)"|([{}])|\/\/[^\r\n]*|\s+/gy;
 const tokens=[];
 while(re.lastIndex<text.length){
  const m=re.exec(text);if(!m)fail();
  if(m[1]!==undefined)tokens.push({value:m[1].replace(/\\(["\\])/g,'$1')});
  else if(m[2])tokens.push({brace:m[2]});
  if(tokens.length>30000)fail();
 }
 let i=0;
 function word(){const v=tokens[i++];if(!v||typeof v.value!=='string')fail();return v.value;}
 function brace(c){if(tokens[i++]?.brace!==c)fail();}
 function object(depth){
  if(depth>8)fail();
  brace('{');const o=new Map();
  while(tokens[i]&&tokens[i].brace!=='}'){
   const k=word().toLowerCase();if(o.has(k))fail();
   o.set(k,tokens[i]?.brace==='{'?object(depth+1):word());
  }
  brace('}');return o;
 }
 if(word().toLowerCase()!==expectedRoot)fail();
 const root=object(0);if(i!==tokens.length)fail();
 return root;
}
function parseLibraries(text){
 const root=parseKeyValues(text,'libraryfolders');
 const libraries=[];
 for(const [key,v] of root){
  if(!/^\d+$/.test(key))continue;
  const candidate=v instanceof Map?v.get('path'):v;
  if(typeof candidate!=='string')fail();
  libraries.push(candidate);
  if(libraries.length>MAX_LIBRARIES)fail();
 }
 return libraries;
}
function safeAbsolute(p){
 return typeof p==='string'&&p.length<=1024&&!/[\x00-\x1f\x7f]/.test(p)&&
 path.isAbsolute(p)&&!p.startsWith('\\\\')&&p===path.normalize(p)&&p!==path.parse(p).root;
}
function createSteamDiscovery(fsApi=fs){
 async function stat(p,signal){
  assertInspectionActive(signal);
  try{const s=await fsApi.lstat(p);assertInspectionActive(signal);return s.isSymbolicLink()?null:s;}
  catch(e){if(missing(e))return null;throw e;}
 }
 async function chain(p,signal,file=false){
  if(!safeAbsolute(p))return false;
  const root=path.parse(p).root,parts=p.slice(root.length).split(path.sep);
  if(parts.length>32)return false;
  let current=root;
  for(let i=0;i<parts.length;i++){
   current=path.join(current,parts[i]);
   const s=await stat(current,signal);
   if(!s||(file&&i===parts.length-1?!s.isFile():!s.isDirectory()))return false;
  }
  return true;
 }
 async function index(root,signal){
  const p=path.join(root,'steamapps','libraryfolders.vdf');
  if(!(await chain(p,signal,true)))return [];
  let fd;
  try{
   fd=await fsApi.open(p,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
   const s=await fd.stat();if(!s.isFile()||s.size>MAX_INDEX)fail();
   const data=Buffer.alloc(MAX_INDEX+1);
   const {bytesRead}=await fd.read(data,0,data.length,0);
   assertInspectionActive(signal);
   if(bytesRead!==s.size||bytesRead>MAX_INDEX)fail();
   return parseLibraries(data.subarray(0,bytesRead).toString('utf8'));
  }finally{await fd?.close();}
 }
 return async function discover(game,{home,platform,programFiles=[]},signal){
  requireGameId(game);assertInspectionActive(signal);
  const spec=SPEC[game];
  if(!safeAbsolute(home))fail();
  let roots=platform==='linux'?[
   path.join(home,'.local','share','Steam'),
   path.join(home,'.var','app','com.valvesoftware.Steam','data','Steam'),
   path.join(home,'.steam','steam')
  ]:platform==='win32'?programFiles.filter(safeAbsolute).slice(0,2).map(p=>path.join(p,'Steam')):[];
  if(!roots.length)return [];
  const known=[];
  for(const root of new Set(roots)){
   if(!await chain(root,signal))continue;
   known.push(root);
   // O_NOFOLLOW is not portable on Windows; index parsing stays Linux-only.
   if(platform==='linux')known.push(...await index(root,signal));
  }
  const unique=[...new Set(known)];
  if(unique.length>MAX_LIBRARIES+3)fail();
  const matches=[];
  for(const root of unique){
   if(!safeAbsolute(root))continue;
   const candidate=path.join(root,'steamapps','common',spec.folder);
   if(!await chain(candidate,signal))continue;
   let ok=true;
   for(const dir of spec.dirs)if(!await chain(path.join(candidate,dir),signal)){ok=false;break;}
   if(!ok)continue;
   for(const parts of spec.files){
    if(await chain(path.join(candidate,...parts),signal,true)){matches.push(candidate);break;}
   }
  }
  assertInspectionActive(signal);
  return matches;
 };
}
module.exports={parseKeyValues,parseLibraries,createSteamDiscovery,discoverSteam:createSteamDiscovery()};
