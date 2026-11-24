'use strict';
// Runtime metadata precheck only. No open/readFile, directory enumeration,
// grant issuance, content decoding, or dependency scan.
const fs=require('node:fs/promises');
const path=require('node:path');
const failure=()=>({status:'error',message:'Não foi possível conferir a configuração selecionada.'});
const unauthorized=()=>({status:'error',message:'Origem da inspeção não autorizada.'});
function data(o,k){const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&Object.hasOwn(d,'value')?d.value:undefined;}
function kind(name){
 if(typeof name!=='string'||name.length>160||!/^[A-Za-z0-9_][A-Za-z0-9_. -]*\.(?:bus|ovh|cfg)$/i.test(name)||
    /[\r\n]/.test(name)||/\.{2}/.test(name)||/[ .]\./.test(name)||
    /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name))return null;
 const ext=path.extname(name).toLowerCase();
 return ext==='.bus'?'bus-candidate':ext==='.ovh'?'ovh-candidate':'cfg-candidate';
}
function key(s,dir){
 if(dir?!s.isDirectory()||s.isSymbolicLink():!s.isFile()||s.isSymbolicLink()||s.nlink!==1n||s.size<1n||s.size>65536n)throw Error('REFUSED');
 return [s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].join(':');
}
function createConfigMetadataPrecheck(api=fs){
 return async function precheck(pick,isAuthorized,signal){
  const authorized=()=>!signal?.aborted&&typeof isAuthorized==='function'&&isAuthorized()===true;
  try{
   if(!authorized())return unauthorized();
   const result=await pick();
   if(!authorized())return unauthorized();
   const canceled=data(result,'canceled'),paths=data(result,'filePaths');
   if(typeof canceled!=='boolean'||!Array.isArray(paths))return failure();
   if(canceled&&paths.length===0)return {status:'cancelled'};
   if(canceled||paths.length!==1)return failure();
   const file=data(paths,'0');
   if(typeof file!=='string'||file.length>32767||file.includes('\0')||!path.isAbsolute(file)||path.resolve(file)!==file)return failure();
   const candidateKind=kind(path.basename(file));if(!candidateKind)return failure();
   const parent=path.dirname(file);
   async function observe(){
    if(!authorized())throw Error('REFUSED');
    if(await api.realpath(parent)!==parent||await api.realpath(file)!==file)throw Error('REFUSED');
    const p=key(await api.lstat(parent,{bigint:true}),true);
    const s=await api.lstat(file,{bigint:true});
    return {parentKey:p,fileKey:key(s,false),byteCount:Number(s.size)};
   }
   const a=await observe(),b=await observe();
   if(!authorized())return unauthorized();
   if(a.parentKey!==b.parentKey||a.fileKey!==b.fileKey||a.byteCount!==b.byteCount)return failure();
   return Object.freeze({status:'config-metadata-observed',scope:'selected-file-metadata-only',
    candidateKind,byteCount:a.byteCount,contentOpened:false,dependencyScanPerformed:false,
    nativeIdentityVerified:false,compatibilityVerified:false,operationsEnabled:false});
  }catch{return authorized()?failure():unauthorized();}
 };
}
module.exports={createConfigMetadataPrecheck,precheckConfigMetadata:createConfigMetadataPrecheck()};
