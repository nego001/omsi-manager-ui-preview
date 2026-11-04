// Read-only Linux packaged Electron renderer diagnostics. No privileges or
// host changes. A kernel flag is not proof of complete Chromium sandboxing.
// Errors reveal only a fixed category, never pid, path, argv, /proc or stderr.
import {readFile} from 'node:fs/promises';
import {basename} from 'node:path';
const allowedReasons=new Set([
 'invalid-probe-context','invalid-process-id','proc-read-unavailable',
 'invalid-proc-status','invalid-proc-command-line','unexpected-executable',
 'renderer-role-unverified','sandbox-bypass-switch','invalid-seccomp-field',
 'invalid-no-new-privileges-field'
]);
const refuse=reason=>{
 const error=new Error('ELECTRON_RENDERER_KERNEL_EVIDENCE_REFUSED');
 Object.defineProperty(error,'reason',{value:allowedReasons.has(reason)?reason:'invalid-probe-context'});
 throw error;
};
export const PACKAGED_RENDERER_REFUSAL_REASONS=Object.freeze([...allowedReasons]);
const max=65536;
function one(raw,name,values,reason){
 const found=[...raw.matchAll(new RegExp('^'+name+':\\s*([0-9]+)\\s*$','gm'))];
 if(found.length!==1||!values.includes(found[0][1]))refuse(reason);
 return Number(found[0][1]);
}
export function classifyPackagedRendererKernelEvidence(status,cmdline){
 if(typeof status!=='string'||status.length<20||status.length>max)
  refuse('invalid-proc-status');
 if(!Buffer.isBuffer(cmdline)||cmdline.length<20||cmdline.length>max||
    cmdline.at(-1)!==0)refuse('invalid-proc-command-line');
 const argv=cmdline.toString('utf8').split('\0');
 if(argv.at(-1)!=='')refuse('invalid-proc-command-line');
 argv.pop();
 if(argv.length<2||!argv[0]||argv.some(a=>!a))
  refuse('invalid-proc-command-line');
 if(basename(argv[0])!=='OMSI-Manager-Preview')
  refuse('unexpected-executable');
 if(argv.filter(a=>a==='--type=renderer').length!==1)
  refuse('renderer-role-unverified');
 if(argv.some(a=>/^(?:--no-sandbox|--disable-setuid-sandbox|--disable-seccomp-filter-sandbox)(?:=|$)/.test(a)))
  refuse('sandbox-bypass-switch');
 const seccomp=one(status,'Seccomp',['0','1','2'],'invalid-seccomp-field');
 const nnp=one(status,'NoNewPrivs',['0','1'],'invalid-no-new-privileges-field');
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
 if(process.platform!=='linux'||process.getuid?.()===0)
  refuse('invalid-probe-context');
 if(!Number.isSafeInteger(pid)||pid<=1||pid>2147483647)
  refuse('invalid-process-id');
 let status,cmdline;
 try{
  [status,cmdline]=await Promise.all([
   readFile('/proc/'+pid+'/status','utf8'),
   readFile('/proc/'+pid+'/cmdline')
  ]);
 }catch{refuse('proc-read-unavailable');}
 return classifyPackagedRendererKernelEvidence(status,cmdline);
}
