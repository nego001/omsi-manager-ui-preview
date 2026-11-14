// Nonprivileged, read-only startup snapshot of a CI-owned native process.
// This is a time-limited observation of the MAIN executable, not renderer
// sandbox certification. No PID, private label, raw /proc or errors escape.
import {readFile} from 'node:fs/promises';
import {categorizeRendererAppArmorLabel} from './electron-renderer-kernel-evidence.mjs';

const field=(status,key,allowed)=>{
 if(typeof status!=='string'||status.length<20||status.length>65536)
  return 'unknown';
 const hits=[...status.matchAll(new RegExp('^'+key+':\\s*([0-9]+)\\s*$','gm'))];
 return hits.length===1&&allowed.includes(hits[0][1])?hits[0][1]:'unknown';
};
export function categorizeEarlyNativeSecurity(status,apparmorLabel){
 const seccomp=field(status,'Seccomp',['0','1','2']);
 const nnp=field(status,'NoNewPrivs',['0','1']);
 return Object.freeze({
  schema:'AUTO_X11_EARLY_NATIVE_KERNEL_V1',
  phase:'after-command-line-check-before-window-search',
  seccompMode:seccomp==='2'?'filter':seccomp==='1'?'strict':
   seccomp==='0'?'off':'unknown',
  noNewPrivs:nnp==='1'?'enabled':nnp==='0'?'disabled':'unknown',
  apparmorLabelCategory:categorizeRendererAppArmorLabel(apparmorLabel),
  processIdentityIndependentAttestation:false,
  rendererSandboxCertified:false,
  fullElectronSandboxCertified:false,
  hostPolicyChanged:false,
  userNamespaceIsolationCertified:false
 });
}
export const EARLY_NATIVE_UNAVAILABLE=categorizeEarlyNativeSecurity(null,null);
export async function observeEarlyNativeSecurity(pid){
 if(process.platform!=='linux'||!Number.isSafeInteger(pid)||pid<=1||
    pid>2147483647)return EARLY_NATIVE_UNAVAILABLE;
 try{
  const [status,label]=await Promise.all([
   readFile('/proc/'+pid+'/status','utf8'),
   readFile('/proc/'+pid+'/attr/current','utf8').catch(()=>null)
  ]);
  return categorizeEarlyNativeSecurity(status,label);
 }catch{return EARLY_NATIVE_UNAVAILABLE;}
}
