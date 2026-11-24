'use strict';
const {randomUUID,createHash}=require('node:crypto');
const path=require('node:path');
// The stable fingerprint identifies a preferred PATH, not an installation
// identity or permission. Only compare it against fresh discovered candidates.
function preferenceFor(game,p){
 return createHash('sha256').update('omsi-preview-steam-preference-v1\0'+game+'\0'+p).digest('hex');
}
function isPreference(value){return typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);}
// Candidate IDs select native dialog hints, never inspection grants.
function createCandidateStore(){
 const records=new WeakMap();
 function clear(owner,game){records.get(owner)?.delete(game);}
 function publish(owner,proof,game,paths){
  clear(owner,game);
  if(!proof||!Array.isArray(paths)||paths.length>27)throw Error('Lista inválida.');
  const unique=[...new Set(paths)];
  if(unique.some(p=>typeof p!=='string'||!path.isAbsolute(p)||p.includes('\0')))throw Error('Lista inválida.');
  let games=records.get(owner);
  if(!games){games=new Map();records.set(owner,games);}
  const options=new Map(),rows=[];
  for(const p of unique){
   const id=randomUUID();
   options.set(id,p);
   rows.push({id,label:'Instalação Steam '+(rows.length+1)});
  }
  games.set(game,{proof,options});
  return rows;
 }
 function preferredId(owner,proof,game,preference){
  if(!isPreference(preference))return null;
  const r=records.get(owner)?.get(game);
  if(!r||r.proof!==proof)return null;
  for(const [id,p] of r.options)if(preferenceFor(game,p)===preference)return id;
  return null;
 }
 function resolve(owner,proof,game,id){
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))return null;
  const r=records.get(owner)?.get(game);
  return r&&r.proof===proof?(r.options.get(id)??null):null;
 }
 return Object.freeze({clear,publish,resolve,preferredId});
}
module.exports={createCandidateStore,preferenceFor,isPreference};
