import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyM37AnnotatedCapabilityIndexes as decode}
 from './auto-x11-annotated-capability-indices.mjs';

const REFUSAL=/^Error: M37_ANNOTATED_CAPABILITY_REFUSED$/;
const named=(s,result='1')=>'prctl(PR_CAPBSET_READ, '+s+') = '+result+'\n';
const annotated=(n,result='-1 EINVAL')=>
 'prctl(PR_CAPBSET_READ, '+n+' /* CAP_??? */) = '+result+
 (result==='-1 EINVAL'?' (Invalid argument)':'')+'\n';
const make=(trace,last='40\n')=>{
 const traces=typeof trace==='string'?[trace]:trace;
 const lines=traces.flatMap(t=>t.split('\n')).filter(
  x=>/prctl\(PR_CAPBSET_READ,\s*/.test(x)&&x.includes(' = '));
 const invalid=lines.filter(x=>x.includes(' = -1 EINVAL')).length;
 return {
  runner:'ubuntu-24.04',kernelLastCapabilityText:last,
  traceTexts:traces,
  m34:{
   schema:'M34_UBUNTU24_PRCTL_ERRNO_CONTEXT_V1',
   prctlOperationCounts:{capBsetRead:lines.length},
   prctlEINVALByOperation:{capBsetRead:invalid},
   strictNativeGateWaived:false,
   apparmorCausesSIGTRAPProven:false,
   rendererConfinementVerified:false
  }
 };
};
function locked(r){
 assert.equal(r.schema,'M37_UBUNTU24_ANNOTATED_CAPABILITY_BOUNDARY_V1');
 assert.equal(r.priorCountsPreserved,true);
 assert.equal(r.noRawTraceOrCapabilityOperandsEmitted,true);
 assert.equal(r.annotatedNumbersNotGuessed,true);
 assert.equal(r.tracerMayInfluenceProcess,true);
 assert.equal(Object.isFrozen(r),true);
 for(const k of [
  'invalidIndexExplainsSIGTRAPProven','apparmorDeniedTheseCallsProven',
  'apparmorCausesSIGTRAPProven','chromiumRendererSandboxCertified',
  'nativeStrictUbuntu24GatePassed','nativeGateWaived',
  'hostPolicyChanged','sandboxBypassApplied','mergeAuthorized',
  'releaseAuthorized','installationAuthorized'
 ])assert.equal(r[k],false,k);
}
test('8 EINVAL from literal 0x29..0x30 CAP unknown and 4 named valid calls',()=>{
 const trace=['CAP_CHOWN','CAP_SYS_ADMIN','CAP_BPF','CAP_CHECKPOINT_RESTORE']
  .map(x=>named(x)).join('')+
  Array.from({length:8},(_,i)=>annotated('0x'+(41+i).toString(16))).join('');
 const r=decode(make(trace));
 assert.equal(r.status,'allUnrecognizedEINVALHaveExplicitAboveBoundIndex');
 assert.equal(r.kernelLastCapabilityIndex,40);
 assert.equal(r.totalCapReadCalls,12);
 assert.equal(r.totalCapReadEINVAL,8);
 assert.equal(r.namesRecognizedByM36,4);
 assert.equal(r.unknownAfterM36,8);
 assert.equal(r.decodedExplicitCAPUnknownNumericAnnotations,8);
 assert.equal(r.annotatedEINVALAboveKernelBound,8);
 assert.equal(r.annotatedEINVALWithinKernelBound,0);
 assert.equal(r.EINVALOperandsStillUnresolved,0);
 locked(r);
});
test('annotated decimal 41 is also explicit, without guessing',()=>{
 const r=decode(make(annotated(41)));
 assert.equal(r.annotatedNumericAboveKernelBound,1);
 assert.equal(r.annotatedEINVALAboveKernelBound,1);locked(r);
});
test('index 40 is inclusive and not above capability limit',()=>{
 const r=decode(make(annotated('0x28')));
 assert.equal(r.status,'annotatedInRangeCapabilityEINVALNeedsReview');
 assert.equal(r.annotatedNumericWithinKernelBound,1);
 assert.equal(r.annotatedEINVALWithinKernelBound,1);locked(r);
});
test('a non-EINVAL successful annotated return is not a denied call',()=>{
 const r=decode(make(annotated('0x2a','0')));
 assert.equal(r.decodedExplicitCAPUnknownNumericAnnotations,1);
 assert.equal(r.annotatedEINVALAboveKernelBound,0);
 assert.equal(r.totalCapReadEINVAL,0);locked(r);
});
test('unknown CAP symbolic without a number stays unresolved',()=>{
 const r=decode(make(named('CAP_???','-1 EINVAL')));
 assert.equal(r.unknownOperandsStillUnresolved,1);
 assert.equal(r.EINVALOperandsStillUnresolved,1);
 assert.equal(r.status,'someEINVALOperandsStillUnresolved');locked(r);
});
test('partially annotated EINVAL cannot be treated as all decoded',()=>{
 const r=decode(make(annotated('0x29')+
  named('CAP_FUTURE_UNKNOWN','-1 EINVAL')));
 assert.equal(r.annotatedEINVALAboveKernelBound,1);
 assert.equal(r.EINVALOperandsStillUnresolved,1);
 assert.equal(r.status,'someEINVALOperandsStillUnresolved');locked(r);
});
test('in-range EINVAL takes priority over out-of-range observations',()=>{
 const r=decode(make(annotated('0x25')+annotated('0x29')));
 assert.equal(r.annotatedEINVALWithinKernelBound,1);
 assert.equal(r.annotatedEINVALAboveKernelBound,1);
 assert.equal(r.status,'annotatedInRangeCapabilityEINVALNeedsReview');locked(r);
});
test('annotated known CAP label not the unknown exact token is not decoded',()=>{
 const r=decode(make(
 'prctl(PR_CAPBSET_READ, 0x29 /* CAP_SYS_ADMIN */) = -1 EINVAL\n'));
 assert.equal(r.decodedExplicitCAPUnknownNumericAnnotations,0);
 assert.equal(r.EINVALOperandsStillUnresolved,1);locked(r);
});
test('comments with arbitrary text or extra suffixes are never trusted',()=>{
 for(const x of [
 '0x29 /* CAP_??? AND ADMIN */',
 '0x29 /* CAP_??? */ extra',
 '0x29 /* not CAP_??? */',
 '0x29 /* CAP_FUTURE */'
 ]){
  const r=decode(make(named(x,'-1 EINVAL')));
  assert.equal(r.decodedExplicitCAPUnknownNumericAnnotations,0,x);
  assert.equal(r.EINVALOperandsStillUnresolved,1,x);locked(r);
 }
});
test('unfinished syscall and unrelated prctl cannot count as decoded',()=>{
 const r=decode(make(
 'prctl(PR_CAPBSET_READ, 0x29 /* CAP_??? */ <unfinished ...>\n'+
 'prctl(PR_SET_NO_NEW_PRIVS, 1) = -1 EINVAL\n'+
 named('CAP_CHOWN')));
 assert.equal(r.totalCapReadCalls,1);
 assert.equal(r.decodedExplicitCAPUnknownNumericAnnotations,0);locked(r);
});
test('PID-prefixed strace call is decoded but PID never emitted',()=>{
 const r=decode(make('[pid 987654] '+annotated('0x2a')));
 assert.equal(r.annotatedEINVALAboveKernelBound,1);
 assert.equal(JSON.stringify(r).includes('987654'),false);locked(r);
});
test('negative, nonnumeric and unsafe giant hex indexes stay unresolved',()=>{
 for(const idx of ['-1','what','0xfffffffffffffffffffff']){
  const r=decode(make(annotated(idx)));
  assert.equal(r.decodedExplicitCAPUnknownNumericAnnotations,0,idx);
  assert.equal(r.EINVALOperandsStillUnresolved,1,idx);locked(r);
 }
});
test('unannotated numeric operand belongs to M35, not the M37 annotation decoder',()=>{
 const r=decode(make(
 named('0x29','-1 EINVAL')+
 annotated('0x2a')));
 assert.equal(r.decodedExplicitCAPUnknownNumericAnnotations,1);
 // M35 already decodes plain 0x29. Only annotated 0x2a is new to M37.
 assert.equal(r.totalCapReadEINVAL,2);
 assert.equal(r.EINVALOperandsStillUnresolved,0);
 assert.equal(r.annotatedEINVALAboveKernelBound,1);
 locked(r);
});
test('M34 declared totals mismatch and false native gate waiver refuse',()=>{
 const a=make(annotated('0x29'));
 a.m34.prctlOperationCounts.capBsetRead=2;
 assert.throws(()=>decode(a),REFUSAL);
 const b=make(annotated('0x29'));
 b.m34.prctlEINVALByOperation.capBsetRead=0;
 assert.throws(()=>decode(b),REFUSAL);
 const c=make(annotated('0x29'));
 c.m34.strictNativeGateWaived=true;
 assert.throws(()=>decode(c),REFUSAL);
});
test('wrong runner, leaked freeform paths or malformed kernel limits refuse',()=>{
 const a=make(annotated('0x29'));a.runner='ubuntu-22.04';
 assert.throws(()=>decode(a),REFUSAL);
 const b=make(annotated('0x29'));b.secretPath='/home/user/file';
 assert.throws(()=>decode(b),REFUSAL);
 const c=make(annotated('0x29'),'9999\n');
 assert.throws(()=>decode(c),REFUSAL);
});
test('redacted report never contains capability operands or raw trace',()=>{
 const r=decode(make(annotated('0x2a')+
 'openat(AT_FDCWD,"/home/private/sensitive",0) = -1 EACCES\n'));
 const s=JSON.stringify(r);
 for(const secret of ['0x2a','CAP_???','/home/private','openat(',
                       'traceTexts','Authorization','secretPath']){
  assert.equal(s.includes(secret),false,secret);
 }
 locked(r);
});
