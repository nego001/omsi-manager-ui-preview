// CI-only snapshot at the Node child 'spawn' event, before a short-lived
// Electron process can exit. The spawn event alone is NOT process identity.
// Read only bounded /proc state and return categorical, privacy-safe data.
import {readFileSync} from 'node:fs';
import {verifyNativeCommandLine} from './auto-real-x11-contract.mjs';
import {categorizeEarlyNativeSecurity,EARLY_NATIVE_UNAVAILABLE}
 from './auto-x11-early-native-kernel.mjs';

export function captureNativeAtSpawn(pid,backend,read=readFileSync){
 const unavailable=Object.freeze({
  nativeProcess:false,earlyNativeKernel:EARLY_NATIVE_UNAVAILABLE,
  processImageVerifiedByCmdline:false,spawnEventAloneAccepted:false
 });
 if(process.platform!=='linux'||!Number.isSafeInteger(pid)||
    pid<=1||pid>2147483647||!['x11','wayland'].includes(backend))
  return unavailable;
 try{
  // This may still be the launcher before exec, or /proc may have vanished.
  // Refuse silently and let the existing asynchronous check attempt again.
  const command=read('/proc/'+pid+'/cmdline');
  verifyNativeCommandLine(command,backend);
 }catch{return unavailable;}
 let status=null,label=null;
 try{status=read('/proc/'+pid+'/status','utf8');}catch{}
 try{label=read('/proc/'+pid+'/attr/current','utf8');}catch{}
 return Object.freeze({
  nativeProcess:true,
  earlyNativeKernel:categorizeEarlyNativeSecurity(status,label),
  processImageVerifiedByCmdline:true,spawnEventAloneAccepted:false
 });
}


// Source attribution is only metadata after successful command-line
// verification. The event alone never earns a positive identity source.
// Preserve the FIRST verified observation, not a later poll that repeats it.
export function recordVerifiedIdentitySource(previous,source,verified){
 const sources=new Set(['unobserved','spawn-callback','polling']);
 if(!sources.has(previous)||!sources.has(source)||
    source==='unobserved'||typeof verified!=='boolean')
  return 'unobserved';
 if(previous!=='unobserved')return previous;
 return verified===true?source:'unobserved';
}
