'use strict';
// TEST-ONLY main-process native backend proof.
// This file lives in scripts/, which Electron packaging excludes.
// It cannot be reached through renderer, preload, IPC or production main.cjs.
const fs=require('node:fs/promises');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {join}=require('node:path');
const {checkedRoot}=require('./temp-recovery-fixture.cjs');
const {requireGameId}=require('../electron/game-inspection.cjs');

const invokeNative=promisify(execFile);
const NATIVE_SCRIPT=join(__dirname,'temp-native-directory-enum.ps1');
const MAX_STDOUT=4096;
const TIMEOUT_MS=15000;
const NATIVE_KEYS=Object.freeze([
 'source','outcome','nativeDirectoryHandleUsed','nativeDirectoryEnumerationByHandle',
 'nativeFileIdChecked','targetIsSynthetic','entries','directories','files',
 'linksSkipped','packageCandidates','completedWithinBudget',
 'nativeIdentityAuthorizedForGameFolders','guaranteesNoABA',
 'atomicPathContainmentProven','supportsRealGameInspection',
 'canRecover','canInstall','canDelete','operationsEnabled','bytesReadFromMods'
]);
const FALSE_FIELDS=Object.freeze([
 'nativeIdentityAuthorizedForGameFolders','guaranteesNoABA',
 'atomicPathContainmentProven','supportsRealGameInspection',
 'canRecover','canInstall','canDelete','operationsEnabled'
]);
function refuse(){throw Error('Temporary native backend refused.');}
function ownDataOnly(value,key){
 const descriptor=Object.getOwnPropertyDescriptor(value,key);
 return descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined;
}
function checkResult(data){
 if(!data||typeof data!=='object'||Array.isArray(data)||
    Object.getPrototypeOf(data)!==Object.prototype||
    Reflect.ownKeys(data).length!==NATIVE_KEYS.length||
    !NATIVE_KEYS.every(key=>Object.hasOwn(data,key)))refuse();
 if(ownDataOnly(data,'source')!=='temporary-native-windows-directory-fixture'||
    ownDataOnly(data,'outcome')!=='observed-bounded-untrusted'||
    ownDataOnly(data,'nativeDirectoryHandleUsed')!==true||
    ownDataOnly(data,'nativeDirectoryEnumerationByHandle')!==true||
    ownDataOnly(data,'nativeFileIdChecked')!==true||
    ownDataOnly(data,'targetIsSynthetic')!==true||
    ownDataOnly(data,'completedWithinBudget')!==true||
    ownDataOnly(data,'bytesReadFromMods')!==0||
    FALSE_FIELDS.some(key=>ownDataOnly(data,key)!==false))refuse();
 for(const key of ['entries','directories','files','linksSkipped','packageCandidates']){
  const n=ownDataOnly(data,key);
  if(!Number.isSafeInteger(n)||n<0||n>=128)refuse();
 }
 if(ownDataOnly(data,'entries')!==
    ownDataOnly(data,'directories')+
    ownDataOnly(data,'files')+
    ownDataOnly(data,'linksSkipped')||
    ownDataOnly(data,'packageCandidates')>ownDataOnly(data,'files'))refuse();
 return Object.freeze({
  source:'main-process-native-directory-test',
  outcome:'observed-bounded-untrusted',
  nativeHandleUsed:true,
  operationsEnabled:false
 });
}
async function realNativeRunner(root,nonce){
 return invokeNative('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',NATIVE_SCRIPT,'-Root',root,'-Nonce',nonce
 ],{
  timeout:TIMEOUT_MS,maxBuffer:MAX_STDOUT,windowsHide:true,shell:false,
  env:{...process.env,POWERSHELL_TELEMETRY_OPTOUT:'1'}
 });
}
function createTemporaryNativeDirectoryBackend({
 root,nonce,game,platform=process.platform,
 runner=realNativeRunner
}={}){
 // The module is always test-only. Callers must bind exactly one known fixture,
 // one game and a random marker *before* any request is accepted.
 if(typeof root!=='string'||typeof nonce!=='string'||
    typeof platform!=='string'||typeof runner!=='function')refuse();
 requireGameId(game);
 let used=false;
 return async function probe(selectedRoot,requestedGame){
  if(used)refuse();
  used=true; // invalidate BEFORE validation, subprocess spawn, or any await
  if(platform!=='win32'||selectedRoot!==root||requestedGame!==game)refuse();
  try{
   const validated=await checkedRoot(root,nonce);
   if(validated!==root)refuse();
   const nativeFolder=join(validated,'native-enum');
   const stat=await fs.lstat(nativeFolder);
   if(!stat.isDirectory()||stat.isSymbolicLink())refuse();
   const output=await runner(validated,nonce);
   if(!output||typeof output!=='object'||typeof output.stdout!=='string'||
      typeof output.stderr!=='string'||output.stderr.trim()!==''||
      output.stdout.length>MAX_STDOUT||output.stdout.length<2)refuse();
   const report=JSON.parse(output.stdout);
   return checkResult(report);
  }catch{
   // Do not surface external command stderr, exceptions, paths or entry names.
   refuse();
  }
 };
}
module.exports={createTemporaryNativeDirectoryBackend,NATIVE_KEYS,
 MAX_STDOUT,TIMEOUT_MS,checkResult};
