'use strict';
// Test-only candidate observation. No dependency content reads, recursion,
// repair, native grant or runtime IPC. Path checks are not atomic containment.
const fs=require('node:fs/promises');
const path=require('node:path');
const {readCandidate}=require('./m102-bounded-omsi-config-reader.cjs');
const {admitRole,analyzeCandidateBytes}=require('./m103-omsi-config-format-admission.cjs');
const {decodeFormatFixture}=require('./m81c-config-format-contract.cjs');
const MAX_ENTRIES=4096,MAX_DEPTH=16,MAX_PATH=240;
const statuses=Object.freeze(['exact-observed','case-only-observed','ambiguous-case','invalid-reference','not-observed-in-directory','not-regular-path','link-refused','budget-limited','unresolved-argument']);
const refuse=()=>{throw Error('M104_DEPENDENCY_OBSERVATION_REFUSED');};
function active(signal){if(signal?.aborted)throw Error('M104_DEPENDENCY_OBSERVATION_CANCELLED');}
function segments(raw,extension){
 if(typeof raw!=='string'||!raw||raw.length>MAX_PATH||/[\x00-\x1f\x7f]/.test(raw))return null;
 const parts=raw.replace(/\\/g,'/').split('/');
 if(parts.length>MAX_DEPTH)return null;
 for(const p of parts){
  if(!/^[A-Za-z0-9_-][A-Za-z0-9_. -]{0,79}$/.test(p)||/[ .]$/.test(p)||
     /^(?:CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|$)/i.test(p))return null;
 }
 return parts.at(-1).toLowerCase().endsWith(extension)?parts:null;
}
function key(s){
 return [s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].join(':');
}
function dirKey(s){
 if(!s.isDirectory()||s.isSymbolicLink())refuse();
 return key(s);
}
function createDependencyObserver(api=fs,read=readCandidate){
 return async function observe(rootInput,basename,role,encoding,signal){
  try{
   active(signal);admitRole(basename,role);
   if(!['vehicle-definition','vehicle-model'].includes(role)||typeof rootInput!=='string'||
      !path.isAbsolute(rootInput)||rootInput.includes('\0'))refuse();
   const root=path.resolve(rootInput);
   if(await api.realpath(root)!==root)refuse();
   const rootRecord={file:root,key:dirKey(await api.lstat(root,{bigint:true}))};
   const source=path.join(root,basename);
   const sourceKey=key(await api.lstat(source,{bigint:true}));
   const candidate=await read(root,basename,signal);
   const format=analyzeCandidateBytes(candidate.bytes,role,encoding,signal);
   const {text}=decodeFormatFixture(candidate.bytes,role,encoding);
   const lines=text.split(/\r?\n/),keyword=role==='vehicle-definition'?'[model]':'[mesh]';
   const extension=role==='vehicle-definition'?'.cfg':'.o3d';
   let entriesScanned=0;
   async function verify(chain){
    active(signal);
    for(const item of chain){
     if(await api.realpath(item.file)!==item.file||dirKey(await api.lstat(item.file,{bigint:true}))!==item.key)refuse();
    }
    if(key(await api.lstat(source,{bigint:true}))!==sourceKey)refuse();
    active(signal);
   }
   async function lookup(parts){
    const chain=[rootRecord];let caseOnly=false;
    for(let i=0;i<parts.length;i++){
     await verify(chain);
     const folder=chain.at(-1).file,part=parts[i],matches=[];
     let dir;
     try{
      dir=await api.opendir(folder);
      await verify(chain);
      while(true){
       active(signal);
       if(entriesScanned>=MAX_ENTRIES)return 'budget-limited';
       const entry=await dir.read();
       if(entry===null)break;
       entriesScanned++;
       if(entry.name.toLowerCase()===part.toLowerCase())matches.push(entry.name);
      }
     }finally{if(dir)await dir.close();}
     await verify(chain);
     if(matches.length>1)return 'ambiguous-case';
     if(matches.length===0)return 'not-observed-in-directory';
     const actual=matches[0];
     // Only the validated ASCII component (with case variation) may be used.
     if(!/^[A-Za-z0-9_-][A-Za-z0-9_. -]{0,79}$/.test(actual))return 'invalid-reference';
     if(actual!==part)caseOnly=true;
     const target=path.join(folder,actual);
     if(path.dirname(target)!==folder)refuse();
     const stat=await api.lstat(target,{bigint:true});
     if(stat.isSymbolicLink())return 'link-refused';
     if(i===parts.length-1){
      if(!stat.isFile()||stat.nlink!==1n)return 'not-regular-path';
      if(await api.realpath(target)!==target||key(await api.lstat(target,{bigint:true}))!==key(stat))refuse();
      await verify(chain);
      return caseOnly?'case-only-observed':'exact-observed';
     }
     if(!stat.isDirectory())return 'not-regular-path';
     if(await api.realpath(target)!==target)return 'link-refused';
     chain.push({file:target,key:dirKey(stat)});
    }
    refuse();
   }
   const counts=Object.fromEntries(statuses.map(s=>[s,0]));
   let total=0;
   for(let i=0;i<lines.length;i++){
    active(signal);
    if(lines[i].trim()!==keyword)continue;
    total++;
    const raw=lines[i+1]?.trim()||'';
    if(!raw||raw.startsWith('[')||raw.startsWith(';')||raw.startsWith('#')){
     counts['unresolved-argument']++;continue;
    }
    const parts=segments(raw,extension);
    const status=parts?await lookup(parts):'invalid-reference';
    counts[status]++;
   }
   await verify([rootRecord]);
   const final=await read(root,basename,signal);
   if(!candidate.bytes.equals(final.bytes))refuse();
   await verify([rootRecord]);
   return Object.freeze({schema:'omsi-m104-dependency-observation-v1',scope:'bounded-selected-directory-candidate',
    role,encoding,referenceKind:role==='vehicle-definition'?'model':'mesh',referenceOccurrences:total,
    unexaminedKnownMarkers:format.knownMarkers-total,entriesScanned,entryBudget:MAX_ENTRIES,
    counts:Object.freeze(counts),budgetLimited:counts['budget-limited']>0,
    dependencyContentsRead:false,fullGrammarVerified:false,compatibilityVerified:false,
    atomicContainmentVerified:false,nativeIdentityVerified:false,realModValidated:false,operationsEnabled:false});
  }catch{
   if(signal?.aborted)throw Error('M104_DEPENDENCY_OBSERVATION_CANCELLED');
   refuse();
  }
 };
}
module.exports={segments,createDependencyObserver,observeDependencies:createDependencyObserver(),MAX_ENTRIES};
