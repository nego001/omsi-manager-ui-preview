'use strict';
// Main-process read-only inspection boundary.
// Only Electron's directory-picker grant calls this with a selected absolute
// path. The renderer never receives the path, native helper or OS handle.
const path=require('node:path');
const {inspectGameDirectory,requireGameId}=require('./game-inspection.cjs');

const NATIVE_UNAVAILABLE='not-connected';
const NATIVE_AUXILIARY='auxiliary-untrusted-observation';

function makeProvenance(nativeStatus){
 return Object.freeze({
  inspectionBackend:'node-directory-metadata',
  nativeDirectoryEnumeration:nativeStatus,
  nativeIdentityAuthorizesOperations:false,
  atomicPathContainmentProven:false,
  abaRuledOut:false,
  gameFilesOpenedForContent:false,
  canInstall:false,
  canUninstall:false,
  canRecover:false,
  operationsEnabled:false
 });
}

// A future native adapter may be supplied ONLY by the main process, never by
// IPC, and must be explicitly required rather than silently trusted/fallback.
// No native adapter is shipped or invoked in production in this milestone.
function createInspectionExecutor(options={}){
 const inspect=options.inspect||inspectGameDirectory;
 const nativeProbe=options.nativeProbe??null;
 const requireNative=options.requireNative===true;
 const platform=options.platform||process.platform;
 if(typeof inspect!=='function'||
    (nativeProbe!==null&&typeof nativeProbe!=='function')||
    typeof platform!=='string' ||
    (options.requireNative!==undefined&&typeof options.requireNative!=='boolean'))
  throw new TypeError('Configuração do executor de inspeção inválida.');

 async function inspectSelectedDirectory(selectedRoot,game){
  requireGameId(game);
  if(typeof selectedRoot!=='string'||selectedRoot.length===0||
     selectedRoot.length>32767||selectedRoot.includes('\0')||
     !path.isAbsolute(selectedRoot))
   throw new Error('Pasta não autorizada para o diagnóstico.');
  // A requested native-only session must fail *before* any directory scan if
  // the native adapter is absent or this is not Windows.
  if(requireNative&&(platform!=='win32'||!nativeProbe))
   throw new Error('Verificação nativa indisponível. Nenhuma inspeção efetuada.');
  let nativeStatus=NATIVE_UNAVAILABLE;
  if(requireNative){
   // This function is injected by trusted main-process code. The production
   // executor does not inject it and does not run PowerShell/child processes.
   // Result fields MUST be read without consulting getters on untrusted data.
   const evidence=await nativeProbe(selectedRoot,game);
   const descriptor=evidence&&typeof evidence==='object'?
    Object.getOwnPropertyDescriptors(evidence):null;
   function data(key){
    const d=descriptor&&Object.hasOwn(descriptor,key)?descriptor[key]:null;
    return d&&Object.hasOwn(d,'value')?d.value:undefined;
   }
   if(Object.getPrototypeOf(evidence)!==Object.prototype||
      Object.keys(descriptor).length!==4||
      data('source')!=='main-process-native-directory-test'||
      data('outcome')!=='observed-bounded-untrusted'||
      data('nativeHandleUsed')!==true||
      data('operationsEnabled')!==false)
    throw new Error('Evidência nativa inválida. Nenhuma contagem autorizada.');
   nativeStatus=NATIVE_AUXILIARY;
  }
  const report=await inspect(selectedRoot,game);
  // Contract validation avoids returning a raw privileged filesystem object.
  // Existing scanner supplies its own bounded, path-free summary.
  if(!report||typeof report!=='object'||
     report.status!=='ok'||report.game!==game||
     report.mode!=='read-only'||!Array.isArray(report.groups)||
     !report.assessment||report.assessment.compatibilityVerified!==false||
     report.assessment.installationVerified!==false)
   throw new Error('Relatório de inspeção inválido.');
  return {...report,provenance:makeProvenance(nativeStatus)};
 }
 return Object.freeze({inspectSelectedDirectory});
}

const defaultExecutor=createInspectionExecutor();
module.exports={createInspectionExecutor,
 inspectSelectedDirectory:defaultExecutor.inspectSelectedDirectory,
 NATIVE_UNAVAILABLE,NATIVE_AUXILIARY};
