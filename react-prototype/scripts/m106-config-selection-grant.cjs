'use strict';
// TEST ONLY. Trusted controller dependencies are injected here, never by IPC.
// A picker result is not OS handle provenance or atomic path containment.
const fs=require('node:fs/promises');
const path=require('node:path');
const {admitRole}=require('./m103-omsi-config-format-admission.cjs');
const {observeDependencies}=require('./m104-bounded-local-dependency-observation.cjs');
const MAX_AGE=15000;
const encodings=['utf-8','windows-1250','windows-1251','windows-1252'];
const deny=()=>{throw Error('M106_CONFIG_GRANT_REFUSED');};
const bounded=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
function record(v,keys){
 if(!v||typeof v!=='object'||Array.isArray(v)||
    ![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length)deny();
 const out=Object.create(null);
 for(const k of keys){
  const d=Object.getOwnPropertyDescriptor(v,k);
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable)deny();
  out[k]=d.value;
 }
 return out;
}
async function sanitize(raw,role,encoding){
 const {validateDependencyObservation}=await import('../src/omsi-dependency-contract.mjs');
 const result=validateDependencyObservation(raw);
 if(!result||result.role!==role||result.encoding!==encoding)deny();
 return result;
}
function identity(s,kind){
 if(kind==='directory'?!s.isDirectory()||s.isSymbolicLink():
    !s.isFile()||s.isSymbolicLink()||s.nlink!==1n||s.size<1n||s.size>65536n)deny();
 return [s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].join(':');
}
function createConfigSelectionGate({picker,observe=observeDependencies,api=fs,now=Date.now}={}){
 if(typeof picker!=='function'||typeof observe!=='function'||typeof now!=='function')deny();
 const tickets=new WeakMap(),latest=new WeakMap(),active=new WeakSet();
 function checkOwner(owner,epoch,proof){
  if(!owner||typeof owner!=='object'||!epoch||!proof||
     !epoch.isCurrent(proof)||!epoch.signalFor(proof)||epoch.signalFor(proof).aborted)deny();
  return epoch.signalFor(proof);
 }
 function checkTime(created){
  const n=now();
  if(!bounded(n,Number.MAX_SAFE_INTEGER)||n<created||n-created>MAX_AGE)deny();
 }
 async function capture(file){
  const parent=path.dirname(file);
  if(await api.realpath(parent)!==parent||await api.realpath(file)!==file)deny();
  return {parent,file,parentKey:identity(await api.lstat(parent,{bigint:true}),'directory'),
   fileKey:identity(await api.lstat(file,{bigint:true}),'file')};
 }
 async function verify(g){
  checkOwner(g.owner,g.epoch,g.proof);checkTime(g.created);
  const current=await capture(g.file);
  if(current.parent!==g.parent||current.parentKey!==g.parentKey||current.fileKey!==g.fileKey)deny();
  checkOwner(g.owner,g.epoch,g.proof);checkTime(g.created);
 }
 async function select(owner,epoch,proof,role,encoding){
  checkOwner(owner,epoch,proof);
  if(active.has(owner)||!['vehicle-definition','vehicle-model'].includes(role)||!encodings.includes(encoding))deny();
  // Any new selection supersedes previous outstanding selection.
  latest.delete(owner);active.add(owner);
  try{
   const choice=record(await picker(role,encoding),['canceled','filePaths']);
   checkOwner(owner,epoch,proof);
   if(!Array.isArray(choice.filePaths)||typeof choice.canceled!=='boolean')deny();
   if(choice.canceled&&choice.filePaths.length===0)return Object.freeze({status:'cancelled'});
   if(choice.canceled||choice.filePaths.length!==1)deny();
   const descriptor=Object.getOwnPropertyDescriptor(choice.filePaths,'0');
   const file=descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:null;
   if(typeof file!=='string'||file.length>32767||file.includes('\0')||!path.isAbsolute(file)||path.resolve(file)!==file)deny();
   admitRole(path.basename(file),role);
   const created=now();if(!bounded(created,Number.MAX_SAFE_INTEGER))deny();
   const captured=await capture(file);
   const grant={...captured,basename:path.basename(file),owner,epoch,proof,role,encoding,created};
   await verify(grant);
   const ticket=Object.freeze({scope:'test-only-selected-config',operationsEnabled:false});
   tickets.set(ticket,grant);latest.set(owner,ticket);
   return Object.freeze({status:'selected',ticket});
  }catch{deny();}finally{active.delete(owner);}
 }
 async function inspectOnce(ticket,owner,epoch,proof){
  const g=ticket&&typeof ticket==='object'?tickets.get(ticket):null;
  if(!g)deny();
  tickets.delete(ticket);
  const current=latest.get(g.owner)===ticket;
  if(current)latest.delete(g.owner);
  if(!current||g.owner!==owner||g.epoch!==epoch||g.proof!==proof||active.has(owner))deny();
  active.add(owner);
  try{
   await verify(g);
   const signal=checkOwner(owner,epoch,proof);
   const result=await observe(g.parent,g.basename,g.role,g.encoding,signal);
   await verify(g);
   const safe=await sanitize(result,g.role,g.encoding);
   checkOwner(owner,epoch,proof);checkTime(g.created);
   return safe;
  }catch{deny();}finally{active.delete(owner);}
 }
 function revoke(ticket){
  const g=ticket&&typeof ticket==='object'?tickets.get(ticket):null;
  if(!g)return false;
  tickets.delete(ticket);if(latest.get(g.owner)===ticket)latest.delete(g.owner);return true;
 }
 return Object.freeze({select,inspectOnce,revoke});
}
module.exports={createConfigSelectionGate,MAX_AGE};
