// Linux packaged-renderer runtime observations. Read-only, CI-only, no privilege.
// Kernel flags are evidence of restrictions, NOT full Chromium sandbox certification.
import {readFile} from 'node:fs/promises';
import {basename} from 'node:path';

const refuse=()=>{throw Error('ELECTRON_RENDERER_KERNEL_EVIDENCE_REFUSED');};
const max=65536;
function one(raw,name,values){
 const matches=[...raw.matchAll(new RegExp('^'+name+':\\s*([0-9]+)\\s*$','gm'))];
 if(matches.length!==1||!values.includes(matches[0][1]))refuse();
 return Number(matches[0][1]);
}
export function classifyPackagedRendererKernelEvidence(status,cmdline){
 if(typeof status!=='string'||status.length<20||status.length>max||
    !Buffer.isBuffer(cmdline)||cmdline.length<20||cmdline.length>max||
    cmdline.at(-1)!==0)refuse();
 const argv=cmdline.toString('utf8').split('\0');
 if(argv.at(-1)!=='')refuse();
 argv.pop();
 if(argv.length<2||basename(argv[0])!=='OMSI-Manager-Preview'||
    argv.filter(a=>a==='--type=renderer').length!==1||
    argv.some(a=>/^(?:--no-sandbox|--disable-setuid-sandbox|--disable-seccomp-filter-sandbox)(?:=|$)/.test(a)))
   refuse();
 const seccomp=one(status,'Seccomp',['0','1','2']);
 const nnp=one(status,'NoNewPrivs',['0','1']);
 const observed=seccomp===2&&nnp===1;
 return Object.freeze({
  schema:'ELECTRON_PACKAGED_RENDERER_KERNEL_EVIDENCE_V1',
  processRole:'renderer',
  commandLineSandboxBypassDetected:false,
  seccompMode:seccomp===2?'filter':seccomp===1?'strict':'off',
  noNewPrivs:nnp===1?'enabled':'disabled',
  category:observed?'renderer-kernel-restrictions-observed':
   'renderer-kernel-restrictions-incomplete',
  runtimeRendererIdentityChecked:true,
  fullElectronSandboxCertified:false,
  userNamespaceIsolationCertified:false,
  apparmorCausalityProven:false,
  hostPolicyChanged:false,
  gameContentRead:false
 });
}

export async function probePackagedRendererKernelEvidence(pid){
 if(process.platform!=='linux'||process.getuid?.()===0||
    !Number.isSafeInteger(pid)||pid<=1||pid>2147483647)refuse();
 try{
  const [status,cmdline]=await Promise.all([
   readFile('/proc/'+pid+'/status','utf8'),
   readFile('/proc/'+pid+'/cmdline')
  ]);
  return classifyPackagedRendererKernelEvidence(status,cmdline);
 }catch{refuse();}
}
