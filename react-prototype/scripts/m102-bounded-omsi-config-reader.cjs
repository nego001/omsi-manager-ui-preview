'use strict';
// Candidate adapter, test-only until a reviewed native grant is integrated.
// Root/basename arguments are not authorization and must never be passed
// directly from renderer IPC. No writes, directory scan, decoding or parser.
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const path=require('node:path');
const MAX_BYTES=65536,CHUNK=4096;
const refuse=()=>{throw Error('M102_CONFIG_READ_REFUSED');};
const active=signal=>{if(signal?.aborted)throw Error('M102_CONFIG_READ_CANCELLED');};
function candidateKind(name){
 // Deliberately narrow first admission: ASCII basenames only, no traversal,
 // NTFS streams, device names, separators, trailing spaces/dots or paths.
 if(typeof name!=='string'||name.length>160||!/^[A-Za-z0-9_][A-Za-z0-9_. -]*\.(?:bus|ovh|cfg)$/i.test(name)||
    /[\r\n]/.test(name)||/\.{2}/.test(name)||/[ .]\./.test(name)||
    /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name))refuse();
 const ext=path.extname(name).toLowerCase();
 return ext==='.bus'?'bus-candidate':ext==='.ovh'?'ovh-candidate':'cfg-candidate';
}
function directoryKey(s){
 if(!s.isDirectory()||s.isSymbolicLink())refuse();
 return [s.dev,s.ino,s.mode,s.mtimeNs,s.ctimeNs].join(':');
}
function fileKey(s){
 if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1n||s.size<1n||s.size>BigInt(MAX_BYTES))refuse();
 return [s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].join(':');
}
function createCandidateReader(api=fs){
 return async function readCandidate(selectedRoot,basename,signal){
  let h;
  try{
   active(signal);
   const kind=candidateKind(basename);
   if(typeof selectedRoot!=='string'||!path.isAbsolute(selectedRoot)||selectedRoot.includes('\0'))refuse();
   const selected=path.resolve(selectedRoot);
   const rootKey=directoryKey(await api.lstat(selected,{bigint:true}));
   const root=await api.realpath(selected);
   // Require a canonical selected root for this candidate contract.
   // No aliases through ancestor links; Windows spelling may require review.
   if(root!==selected)refuse();
   const file=path.join(root,basename);
   if(path.dirname(file)!==root)refuse();
   async function verifyRoot(){
    active(signal);
    if(await api.realpath(selected)!==root||directoryKey(await api.lstat(root,{bigint:true}))!==rootKey)refuse();
    active(signal);
   }
   await verifyRoot();
   const before=await api.lstat(file,{bigint:true}),expected=fileKey(before);
   if(await api.realpath(file)!==file)refuse();
   await verifyRoot();
   h=await api.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0)|(process.platform==='linux'?(constants.O_NONBLOCK||0):0));
   async function verifyFile(){
    await verifyRoot();
    if(fileKey(await h.stat({bigint:true}))!==expected||
       fileKey(await api.lstat(file,{bigint:true}))!==expected||
       await api.realpath(file)!==file)refuse();
    active(signal);
   }
   await verifyFile();
   const size=Number(before.size),snapshots=[];
   for(let pass=0;pass<2;pass++){
    const bytes=Buffer.alloc(size);
    let offset=0;
    while(offset<size){
     await verifyFile();
     const length=Math.min(CHUNK,size-offset);
     const {bytesRead}=await h.read(bytes,offset,length,offset);
     if(!Number.isInteger(bytesRead)||bytesRead<1||bytesRead>length)refuse();
     offset+=bytesRead;
     active(signal);
    }
    await verifyFile();
    snapshots.push(bytes);
   }
   if(!snapshots[0].equals(snapshots[1]))refuse();
   // Internal bytes only, for the next format-admission stage. Never send
   // bytes, filenames or paths over IPC; no content type is verified here.
   const result={kind,byteCount:size,bytes:snapshots[0],scope:'single-direct-config-candidate',
    contentFormatVerified:false,nativeIdentityVerified:false,operationsEnabled:false};
   await h.close();h=null;
   await verifyRoot();active(signal);
   return Object.freeze(result);
  }catch{
   if(signal?.aborted)throw Error('M102_CONFIG_READ_CANCELLED');
   refuse();
  }finally{if(h)try{await h.close();}catch{/* fixed error above, no raw paths */}}
 };
}
module.exports={MAX_BYTES,candidateKind,createCandidateReader,readCandidate:createCandidateReader()};
