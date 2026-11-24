'use strict';
const {randomUUID}=require('node:crypto');
const path=require('node:path');
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
 function resolve(owner,proof,game,id){
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))return null;
  const r=records.get(owner)?.get(game);
  return r&&r.proof===proof?(r.options.get(id)??null):null;
 }
 return Object.freeze({clear,publish,resolve});
}
module.exports={createCandidateStore};
