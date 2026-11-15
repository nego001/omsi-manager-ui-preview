// Read-only Linux packaged Electron renderer diagnostics. No privileges or
// host changes. A kernel flag is not proof of complete Chromium sandboxing.
// Errors reveal only a fixed category, never pid, path, argv, /proc or stderr.
import {readFile} from 'node:fs/promises';
import {basename} from 'node:path';
const allowedReasons=new Set([
 'invalid-probe-context','invalid-process-id','proc-read-unavailable',
 'invalid-proc-status','invalid-proc-command-line','unexpected-executable',
 'renderer-role-unverified','renderer-role-duplicate-type-switch',
 'renderer-role-conflicting-gpu','renderer-role-conflicting-utility',
 'renderer-role-conflicting-zygote','renderer-role-conflicting-other',
 'electron-metric-role-unverified',
 'sandbox-bypass-switch','invalid-seccomp-field',
 'invalid-no-new-privileges-field'
]);
const refuse=reason=>{
 const error=new Error('ELECTRON_RENDERER_KERNEL_EVIDENCE_REFUSED');
 Object.defineProperty(error,'reason',{value:allowedReasons.has(reason)?reason:'invalid-probe-context'});
 throw error;
};
export const PACKAGED_RENDERER_REFUSAL_REASONS=Object.freeze([...allowedReasons]);
const max=65536;
// Parse only a read-only /proc/<renderer>/attr/current snapshot. The actual
// AppArmor profile name can contain private paths; it is never returned.
export function categorizeRendererAppArmorLabel(raw){
 if(raw==null)return 'unavailable';
 if(typeof raw!=='string'||raw.length===0||raw.length>2048)
  return 'unknown';
 const value=raw.endsWith('\n')?raw.slice(0,-1):raw;
 if(value==='unconfined')return 'unconfined';
 if(/[\r\n\0\x00-\x1f\x7f]/.test(value))return 'unknown';
 const matched=/^.{1,1024} \((enforce|complain|kill)\)$/.exec(value);
 if(!matched)return 'unknown';
 return matched[1]==='enforce'?'enforce-label-observed':
  matched[1]==='complain'?'complain-label-observed':'kill-label-observed';
}

// A private token guarantees the classifier only accepts a renderer role that
// has passed the Electron main-process metric check, never a caller-supplied boolean.
const metricRoleProofs=new WeakSet();
export function verifyElectronRendererMetric(pid,records){
 if(!Number.isSafeInteger(pid)||pid<=1||pid>2147483647)
  refuse('invalid-process-id');
 if(!Array.isArray(records)||records.length!==1)
  refuse('electron-metric-role-unverified');
 const row=records[0];
 if(!row||typeof row!=='object'||Array.isArray(row)||
    row.pid!==pid||row.type!=='Tab'||
    typeof row.creationTime!=='number'||!Number.isFinite(row.creationTime)||
    row.creationTime<=0)
  refuse('electron-metric-role-unverified');
 const proof=Object.freeze({source:'electron-main-process-metrics'});
 metricRoleProofs.add(proof);
 return proof;
}

function one(raw,name,values,reason){
 const found=[...raw.matchAll(new RegExp('^'+name+':\\s*([0-9]+)\\s*$','gm'))];
 if(found.length!==1||!values.includes(found[0][1]))refuse(reason);
 return Number(found[0][1]);
}
export function classifyPackagedRendererKernelEvidence(status,cmdline,metricProof,apparmorLabel=null){
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
 const declaredRoles=argv.filter(a=>a.startsWith('--type='));
 const trustedTabMetric=metricRoleProofs.has(metricProof);
 if(declaredRoles.length>1)refuse('renderer-role-duplicate-type-switch');
 if(declaredRoles.length===1&&declaredRoles[0]!=='--type=renderer'){
  // Chromium forks renderers from a zygote on Linux. After fork, cmdline
  // can retain --type=zygote; ONLY a matched Electron Tab metric may
  // disambiguate that inherited command line. Other roles stay blocked.
  const role=declaredRoles[0];
  if(role==='--type=gpu-process')refuse('renderer-role-conflicting-gpu');
  if(role==='--type=utility')refuse('renderer-role-conflicting-utility');
  if(role==='--type=zygote'){
   if(!trustedTabMetric)refuse('renderer-role-conflicting-zygote');
  }else{
   refuse('renderer-role-conflicting-other');
  }
 }
 if(declaredRoles.length===0&&!trustedTabMetric)
  refuse('renderer-role-unverified');
 if(argv.some(a=>/^(?:--no-sandbox|--disable-setuid-sandbox|--disable-seccomp-filter-sandbox|--no-zygote|--single-process)(?:=|$)/.test(a)))
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
  // Observes the process label only, never the profile name or policy content.
  apparmorRendererLabelCategory:categorizeRendererAppArmorLabel(apparmorLabel),
  apparmorTargetPolicyIndependentlyVerified:false,
  category:observed?'renderer-kernel-restrictions-observed':
   'renderer-kernel-restrictions-incomplete',
  runtimeRendererIdentityChecked:true,
  roleEvidence:declaredRoles[0]==='--type=zygote'?
   'electron-tab-metric-and-zygote-fork-cmdline':
   trustedTabMetric?'electron-metrics-and-process-command-line':
   'renderer-process-command-line-only',
  fullElectronSandboxCertified:false,
  userNamespaceIsolationCertified:false,
  apparmorCausalityProven:false,
  hostPolicyChanged:false,
  gameContentRead:false
 });
}
export async function probePackagedRendererKernelEvidence(pid,records){
 if(process.platform!=='linux'||process.getuid?.()===0)
  refuse('invalid-probe-context');
 if(!Number.isSafeInteger(pid)||pid<=1||pid>2147483647)
  refuse('invalid-process-id');
 const metricProof=verifyElectronRendererMetric(pid,records);
 let status,cmdline,apparmorLabel;
 try{
  [status,cmdline,apparmorLabel]=await Promise.all([
   readFile('/proc/'+pid+'/status','utf8'),
   readFile('/proc/'+pid+'/cmdline'),
   // AppArmor might not be active or accessible. Missing label remains an
   // unknown diagnostic, never an excuse to skip Seccomp or NoNewPrivs.
   readFile('/proc/'+pid+'/attr/current','utf8').catch(()=>null)
  ]);
 }catch{refuse('proc-read-unavailable');}
 return classifyPackagedRendererKernelEvidence(status,cmdline,metricProof,apparmorLabel);
}
