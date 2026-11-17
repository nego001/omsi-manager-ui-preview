import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interpretM35KernelCapabilityBoundary as analyze} from './auto-x11-capbset-boundary.mjs';

const refusal=/^Error: M35_CAPABILITY_BOUNDARY_REFUSED$/;
const line=(idx,errno='')=>
 'prctl(PR_CAPBSET_READ, '+idx+') = '+(errno?'-1 '+errno+' (Invalid argument)':'1')+'\n';
const mk=(traces,last='40\n')=>{
 const raws=typeof traces==='string'?[traces]:traces;
 const count=raws.join('\n').split('\n').filter(s=>s.includes('prctl(PR_CAPBSET_READ,')&&s.includes(' = '));
 const invalid=count.filter(s=>s.includes(' = -1 EINVAL')).length;
 return {
  runner:'ubuntu-24.04',kernelLastCapabilityText:last,traceTexts:raws,
  m34:{
   schema:'M34_UBUNTU24_PRCTL_ERRNO_CONTEXT_V1',
   prctlOperationCounts:{capBsetRead:count.length},
   prctlEINVALByOperation:{capBsetRead:invalid},
   strictNativeGateWaived:false,
   apparmorCausesSIGTRAPProven:false,
   rendererConfinementVerified:false
  }
 };
};
function safe(r){
 assert.equal(r.schema,'M35_CAPBSET_READ_BOUNDARY_OBSERVATION_V1');
 assert.equal(r.kernelCapabilityBoundReadOnly,true);
 assert.equal(r.sumsAgreeWithM34,true);
 for(const k of [
  'invalidIndexRootCauseIndependentlyProven','EINVALImpliesAppArmorDenial',
  'EINVALCausedSIGTRAP','apparmorCausesSIGTRAPProven',
  'rendererSandboxCertified','strictUbuntu24NativeGatePassed',
  'nativeGateWaived','policyChanged','realModRead',
  'mergeAuthorized','releaseAuthorized','installationAuthorized'
 ])assert.equal(r[k],false,k);
 assert.equal(r.traceCanAffectProcessBehavior,true);
 assert.equal(Object.isFrozen(r),true);
}
test('all eight EINVAL above cap_last_cap are plausible boundary probes, not cause',()=>{
 const s=line(39)+line(40)+Array.from({length:8},(_,i)=>line(41+i,'EINVAL')).join('');
 const r=analyze(mk(s));
 assert.equal(r.status,'outOfRangeCapReadEINVALPatternObserved');
 assert.equal(r.capReadCalls,10);
 assert.equal(r.capReadEINVAL,8);
 assert.equal(r.kernelLastCapabilityIndex,40);
 assert.equal(r.numericAboveKernelCapabilityBound,8);
 assert.equal(r.EINVALAboveKernelCapabilityBound,8);
 assert.equal(r.EINVALWithinKernelCapabilityBound,0);
 assert.equal(r.EINVALWithUnparsedOperand,0);safe(r);
});
test('EINVAL for an in-range numeric capability is not explained by index boundary',()=>{
 const r=analyze(mk(line(39,'EINVAL')));
 assert.equal(r.status,'inRangeCapReadEINVALRequiresInvestigation');
 assert.equal(r.EINVALWithinKernelCapabilityBound,1);safe(r);
});
test('symbolic capability index remains unknown, not falsely considered in range',()=>{
 const r=analyze(mk(line('CAP_SYS_ADMIN','EINVAL')));
 assert.equal(r.status,'symbolicCapabilityOperandsNeedIndependentDecode');
 assert.equal(r.symbolicOrUnrecognizedOperands,1);
 assert.equal(r.EINVALWithUnparsedOperand,1);
 assert.equal(r.numericIndicesParsed,0);safe(r);
});
test('hexadecimal capability index is decoded only when explicitly present',()=>{
 const r=analyze(mk(line('0x29','EINVAL')));
 assert.equal(r.EINVALAboveKernelCapabilityBound,1);
 assert.equal(r.numericAboveKernelCapabilityBound,1);safe(r);
});
test('kernel bound is inclusive: index exactly equal is not out of range',()=>{
 const r=analyze(mk(line(40,'EINVAL')));
 assert.equal(r.EINVALWithinKernelCapabilityBound,1);
 assert.equal(r.numericAboveKernelCapabilityBound,0);safe(r);
});
test('no EINVAL is reported as no direct failing capability call observed',()=>{
 const r=analyze(mk(line(0)+line(40)));
 assert.equal(r.status,'noCapReadEINVALObserved');
 assert.equal(r.capReadCalls,2);
 assert.equal(r.capReadEINVAL,0);safe(r);
});
test('PID-prefixed lines are recognized without outputting process identity',()=>{
 const r=analyze(mk('[pid 987654] '+line(45,'EINVAL')));
 assert.equal(r.EINVALAboveKernelCapabilityBound,1);
 assert.equal(JSON.stringify(r).includes('987654'),false);safe(r);
});
test('unrelated prctl and clone failures do not count as capability queries',()=>{
 const r=analyze(mk(
  'prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) = -1 EINVAL (Invalid argument)\n'+
  'clone3({flags=CLONE_NEWUSER}, 88) = -1 EPERM\n'+
  line(10)
 ));
 assert.equal(r.capReadCalls,1);
 assert.equal(r.capReadEINVAL,0);safe(r);
});
test('an EINVAL with unparsed annotation is counted as unknown, never invented',()=>{
 const r=analyze(mk(line('0x2a /* unknown */','EINVAL')));
 assert.equal(r.EINVALWithUnparsedOperand,1);
 assert.equal(r.numericAboveKernelCapabilityBound,0);
 assert.equal(r.status,'symbolicCapabilityOperandsNeedIndependentDecode');safe(r);
});
test('M34 aggregate disagreement refuses the entire interpretation',()=>{
 const a=mk(line(45,'EINVAL'));a.m34.prctlOperationCounts.capBsetRead=2;
 assert.throws(()=>analyze(a),refusal);
 const b=mk(line(45,'EINVAL'));b.m34.prctlEINVALByOperation.capBsetRead=0;
 assert.throws(()=>analyze(b),refusal);
});
test('unsupported kernel cap_last_cap formatting or bounds refuse',()=>{
 for(const value of ['40extra','40.0','-1','040','10000','1025','40 41','',null,41]){
  const a=mk(line(42,'EINVAL'),value);
  assert.throws(()=>analyze(a),refusal);
 }
});
test('host labels and false claims cannot extend the input schema',()=>{
 const a=mk(line(41,'EINVAL'));a.hostPath='/home/private';
 assert.throws(()=>analyze(a),refusal);
 const b=mk(line(41,'EINVAL'));b.m34.rendererConfinementVerified=true;
 assert.throws(()=>analyze(b),refusal);
 const c=mk(line(41,'EINVAL'));c.m34.strictNativeGateWaived=true;
 assert.throws(()=>analyze(c),refusal);
});
test('oversized, NUL, and non-string trace items refuse safely',()=>{
 for(const text of ['A'.repeat(262145),'prctl() = 0\u0000',null,3]){
  const a=mk(line(41,'EINVAL'));a.traceTexts=[text];
  assert.throws(()=>analyze(a),refusal);
 }
});
test('wrong runner and missing arrays cannot masquerade as Ubuntu24 evidence',()=>{
 const a=mk(line(42,'EINVAL'));a.runner='ubuntu-22.04';
 assert.throws(()=>analyze(a),refusal);
 const b=mk(line(42,'EINVAL'));b.traceTexts=[];
 assert.throws(()=>analyze(b),refusal);
});
test('an unfinished strace call must not count as a completed EINVAL',()=>{
 const r=analyze(mk('prctl(PR_CAPBSET_READ, 42 <unfinished ...>\n'));
 assert.equal(r.capReadCalls,0);safe(r);
});
test('report does not disclose raw strace, hashes, paths, or capability arguments',()=>{
 const trace=line(45,'EINVAL')+
  'openat(AT_FDCWD,"/home/private/tool", 0) = -1 EACCES\n';
 const text=JSON.stringify(analyze(mk(trace)));
 for(const word of ['/home/private','openat(','PR_CAPBSET_READ',
                      'Invalid argument','45)','Authorization','token'])
  assert.equal(text.includes(word),false,word);
});
