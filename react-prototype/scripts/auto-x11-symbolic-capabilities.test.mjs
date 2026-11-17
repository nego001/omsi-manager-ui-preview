import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interpretM36NamedCapabilityIndexes as decode,M36_CAPABILITY_NAMES}
 from './auto-x11-symbolic-capabilities.mjs';

const REFUSAL=/^Error: M36_SYMBOLIC_CAPABILITY_REFUSED$/;
const line=(name,result='1')=>'prctl(PR_CAPBSET_READ, '+name+') = '+result+
 (result==='-1 EINVAL'?' (Invalid argument)':'')+'\n';
const make=(source,last='40\n')=>{
 const traces=typeof source==='string'?[source]:source;
 const matched=traces.flatMap(x=>x.split('\n')).filter(
  s=>/prctl\(PR_CAPBSET_READ,\s*/.test(s)&&s.includes(' = '));
 const invalid=matched.filter(s=>s.includes(' = -1 EINVAL')).length;
 return {
  runner:'ubuntu-24.04',kernelLastCapabilityText:last,
  traceTexts:traces,
  m34:{
   schema:'M34_UBUNTU24_PRCTL_ERRNO_CONTEXT_V1',
   prctlOperationCounts:{capBsetRead:matched.length},
   prctlEINVALByOperation:{capBsetRead:invalid},
   strictNativeGateWaived:false,
   apparmorCausesSIGTRAPProven:false,
   rendererConfinementVerified:false
  }
 };
};
function locked(r){
 assert.equal(r.schema,'M36_LINUX_SYMBOLIC_CAPABILITY_BOUNDARY_V1');
 assert.equal(r.symbolicCountsReconciledWithM35,true);
 assert.equal(r.fixedCapabilityNameTableOnly,true);
 assert.equal(r.numericOrUnknownCapabilityIndexesNotGuessed,true);
 assert.equal(r.traceInstrumentationMayChangeBehavior,true);
 assert.equal(Object.isFrozen(r),true);
 for(const key of [
  'recognizedNameImpliesCapabilityGranted',
  'unknownSymbolicIsProofAboveKernelBound',
  'capabilityRangeCausesSIGTRAPProven',
  'apparmorDenialFromPRCTLProven','apparmorCausesSIGTRAPProven',
  'chromiumRendererSandboxCertified','strictUbuntu24NativeGatePassed',
  'nativeGateWaived','hostPolicyChanged','sandboxBypassApplied',
  'mergeAuthorized','releaseAuthorized','installationAuthorized'
 ]) assert.equal(r[key],false,key);
}
test('41 official Linux UAPI names correspond to their fixed numeric order',()=>{
 assert.equal(M36_CAPABILITY_NAMES.length,41);
 assert.equal(M36_CAPABILITY_NAMES[0],'CAP_CHOWN');
 assert.equal(M36_CAPABILITY_NAMES[21],'CAP_SYS_ADMIN');
 assert.equal(M36_CAPABILITY_NAMES[37],'CAP_AUDIT_READ');
 assert.equal(M36_CAPABILITY_NAMES[38],'CAP_PERFMON');
 assert.equal(M36_CAPABILITY_NAMES[39],'CAP_BPF');
 assert.equal(M36_CAPABILITY_NAMES[40],'CAP_CHECKPOINT_RESTORE');
 assert.equal(new Set(M36_CAPABILITY_NAMES).size,41);
 assert.equal(Object.isFrozen(M36_CAPABILITY_NAMES),true);
});
test('named known capabilities within bound are decoded but not granted',()=>{
 const r=decode(make(line('CAP_SYS_ADMIN')+line('CAP_CHOWN')+
                       line('CAP_CHECKPOINT_RESTORE')));
 assert.equal(r.recognizedSymbolicCapabilityOperands,3);
 assert.equal(r.knownSymbolicIndexesWithinKernelBound,3);
 assert.equal(r.unrecognizedSymbolicOrAnnotatedOperands,0);
 assert.equal(r.status,'noSymbolicCapabilityEINVALObserved');locked(r);
});
test('known symbolic capability above lower kernel bound with EINVAL is categorized',()=>{
 const r=decode(make(line('CAP_BPF','-1 EINVAL')+
                       line('CAP_CHECKPOINT_RESTORE','-1 EINVAL'),'37\n'));
 assert.equal(r.kernelLastCapabilityIndex,37);
 assert.equal(r.knownSymbolicIndexesAboveKernelBound,2);
 assert.equal(r.knownSymbolicAboveBoundEINVAL,2);
 assert.equal(r.knownSymbolicWithinBoundEINVAL,0);
 assert.equal(r.status,'knownSymbolicCapabilityAboveBoundReturnedEINVAL');
 locked(r);
});
test('in-bound symbolic EINVAL needs investigation even if other calls above bound',()=>{
 const r=decode(make(line('CAP_SYS_ADMIN','-1 EINVAL')+
                       line('CAP_BPF','-1 EINVAL'),'30\n'));
 assert.equal(r.knownSymbolicWithinBoundEINVAL,1);
 assert.equal(r.knownSymbolicAboveBoundEINVAL,1);
 assert.equal(r.status,'knownSymbolicCapabilityWithinBoundReturnedEINVAL');
 locked(r);
});
test('unknown CAP names are left undecoded and never assumed out of range',()=>{
 const r=decode(make(line('CAP_FUTURE_LINUX','-1 EINVAL')+
                       line('CAP_???','-1 EINVAL')));
 assert.equal(r.recognizedSymbolicCapabilityOperands,0);
 assert.equal(r.unrecognizedSymbolicOrAnnotatedOperands,2);
 assert.equal(r.unrecognizedSymbolicEINVAL,2);
 assert.equal(r.status,'unknownSymbolicCapabilityEINVALStillInconclusive');locked(r);
});
test('unknown invalid index has priority over compatible known out-of-range pattern',()=>{
 const r=decode(make(line('CAP_UNKNOWN','-1 EINVAL')+
                       line('CAP_BPF','-1 EINVAL'),'37\n'));
 assert.equal(r.unrecognizedSymbolicEINVAL,1);
 assert.equal(r.knownSymbolicAboveBoundEINVAL,1);
 assert.equal(r.status,'unknownSymbolicCapabilityEINVALStillInconclusive');locked(r);
});
test('numeric arguments are M35 responsibility and not counted as symbolic',()=>{
 const r=decode(make(line(45,'-1 EINVAL')+
                       line('CAP_SYS_ADMIN','1')));
 assert.equal(r.numericCapReadOperandsHandledByM35,1);
 assert.equal(r.recognizedSymbolicCapabilityOperands,1);
 assert.equal(r.totalCapReadCalls,2);
 assert.equal(r.unrecognizedSymbolicOrAnnotatedOperands,0);
 locked(r);
});
test('an annotated numeric operand stays unknown if M35 cannot decode it',()=>{
 const r=decode(make(line('42 /* strange annotation */','-1 EINVAL')));
 assert.equal(r.numericCapReadOperandsHandledByM35,0);
 assert.equal(r.unrecognizedSymbolicOrAnnotatedOperands,1);
 assert.equal(r.unrecognizedSymbolicEINVAL,1);locked(r);
});
test('PID prefixed trace calls remain classifiable without PID in output',()=>{
 const r=decode(make('[pid 987654] '+line('CAP_NET_ADMIN','-1 EINVAL')));
 assert.equal(r.recognizedSymbolicCapabilityOperands,1);
 assert.equal(r.knownSymbolicWithinBoundEINVAL,1);
 assert.equal(JSON.stringify(r).includes('987654'),false);locked(r);
});
test('unknown annotated symbolic suffix cannot be interpreted as trusted index',()=>{
 const r=decode(make(line('CAP_SYS_ADMIN /* comment */','-1 EINVAL')));
 assert.equal(r.recognizedSymbolicCapabilityOperands,0);
 assert.equal(r.unrecognizedSymbolicEINVAL,1);locked(r);
});
test('only completed PR_CAPBSET_READ calls count, not unrelated names',()=>{
 const r=decode(make(
  'write(2,"CAP_BPF",7) = 7\n'+
  'prctl(PR_GET_NO_NEW_PRIVS, CAP_SYS_ADMIN) = -1 EINVAL\n'+
  'prctl(PR_CAPBSET_READ, CAP_SYS_ADMIN <unfinished ...>\n'+
  line('CAP_NET_RAW')));
 assert.equal(r.totalCapReadCalls,1);
 assert.equal(r.recognizedSymbolicCapabilityOperands,1);locked(r);
});
test('M34 sum mismatch or policy waiver fails closed',()=>{
 const a=make(line('CAP_BPF','-1 EINVAL'));
 a.m34.prctlOperationCounts.capBsetRead=2;
 assert.throws(()=>decode(a),REFUSAL);
 const b=make(line('CAP_BPF','-1 EINVAL'));
 b.m34.prctlEINVALByOperation.capBsetRead=0;
 assert.throws(()=>decode(b),REFUSAL);
 const c=make(line('CAP_CHOWN'));c.m34.strictNativeGateWaived=true;
 assert.throws(()=>decode(c),REFUSAL);
});
test('unknown kernel range, wrong runner, or malformed list refused',()=>{
 for(const bound of ['-1','1040','42 extra','',true]){
  assert.throws(()=>decode(make(line('CAP_BPF'),bound)),REFUSAL);
 }
 const wrong=make(line('CAP_BPF'));wrong.runner='ubuntu-22.04';
 assert.throws(()=>decode(wrong),REFUSAL);
 const noTrace=make(line('CAP_BPF'));noTrace.traceTexts=[];
 assert.throws(()=>decode(noTrace),REFUSAL);
});
test('oversized traces, unexpected paths, and new private metadata refuse',()=>{
 const v=make(line('CAP_CHOWN'));
 v.privatePath='/home/private';
 assert.throws(()=>decode(v),REFUSAL);
 const x=make(line('CAP_CHOWN'));
 x.traceTexts=['X'.repeat(262145)];
 assert.throws(()=>decode(x),REFUSAL);
});
test('raw traces, symbols and private strings never appear in result',()=>{
 const raw=line('CAP_SYS_ADMIN')+
  'openat(AT_FDCWD,"/home/person/secret-profile",0) = -1 EACCES\n';
 const result=JSON.stringify(decode(make(raw)));
 for(const secret of ['CAP_SYS_ADMIN','/home/person/secret-profile',
                       'openat(', '987654','traceTexts','ghp_']){
  assert.equal(result.includes(secret),false,secret);
 }
});
test('malformed objects and non-data inputs are rejected with fixed refusal',()=>{
 for(const x of [null,false,'',[],{},new Date(),undefined]){
  assert.throws(()=>decode(x),REFUSAL);
 }
});
