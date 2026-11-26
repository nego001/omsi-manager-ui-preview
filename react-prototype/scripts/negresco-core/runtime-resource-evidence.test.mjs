import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeFixtureResourceEvidence as normalize,consolidateFixtureResourceEvidence as consolidate,bindFixtureResourceObservation as bind,consolidateFixtureCpuEvidence as consolidateCpu} from './runtime-resource-evidence.mjs';
const authority={readerLimitIntegrated:false,operationsEnabled:false,realReadsPerformed:false};
const isolation={osIsolationVerified:false,...authority};
const f=()=>({scope:'synthetic-fixture',
 linuxAddress:{scope:'disposable-linux-memory-fixture',mechanism:'RLIMIT_AS',limitBytes:134217728,positiveBeforeBytes:8388608,refusedRequestBytes:134217728,refusal:'ENOMEM',positiveAfterBytes:8388608,addressSpaceLimitObserved:true,hardRssLimitVerified:false,processTreeLimitVerified:false,...authority},
 linuxCgroup:{scope:'disposable-linux-cgroup-discovery',status:'not-writable',cgroupV2Observed:true,membershipResolved:true,mountReadOnly:false,controllers:['cpu','memory','pids'],interfaces:{memoryMax:true,memoryCurrent:true,pidsMax:true,cpuMax:true,cgroupKill:true},directoryWriteAccessHint:false,delegationVerified:false,limitsApplied:false,memoryEnforcementVerified:false,descendantLimitVerified:false,cgroupKillVerified:false,realReadsPerformed:false,operationsEnabled:false},
 windowsProcess:{scope:'disposable-windows-memory-fixture',mechanism:'JobObjectProcessMemory',limitBytes:536870912,positiveBeforeBytes:8388608,refusedRequestBytes:536870912,refusalWin32Code:1455,positiveAfterBytes:8388608,processCommitLimitObserved:true,hardRssLimitVerified:false,processTreeLimitVerified:false,killOnJobCloseVerified:false,...authority},
 windowsLifecycle:{scope:'disposable-windows-job-lifecycle',jobCommitLimitBytes:536870912,activeProcessLimit:1,limitsReadBack:true,suspendedAssignmentObserved:true,ownedChildReadyObserved:true,ownedChildAliveBeforeClose:true,ownedChildTerminatedAfterClose:true,childExitCode:0,aggregateAllocationRefusalVerified:false,descendantLimitVerified:false,...isolation},
 windowsDescendant:{scope:'disposable-windows-job-descendant',activeProcessLimit:1,outsideJobPositiveControl:true,descendantAttemptOutcome:'create-refused-1816',insideJobRaisedLimitPositiveControl:true,controlChildMembershipVerified:true,restoredLimitVerified:true,descendantLimitObserved:true,allChildrenCreatedSuspended:true,aggregateAllocationRefusalVerified:false,...isolation},
 windowsAggregate:{scope:'disposable-windows-aggregate-memory',jobLimitBytes:201326592,individualRequestBytes:117440512,twoOwnedChildrenAssigned:true,allChildrenSuspended:true,individualProcessLimitConfigured:false,positiveBefore:true,firstAllocationHeld:true,combinedAllocationRefused:true,refusalWin32Code:1455,positiveAfterRelease:true,limitReadbackVerified:true,aggregateCommitLimitObserved:true,hardRssLimitVerified:false,...isolation}
});
const refusal=/CORE_MEMORY_EVIDENCE_REFUSED/;
test('complete synthetic resource contracts never grant real permission',()=>{
 const r=consolidate(f());assert.equal(r.observations.length,6);assert.equal(r.fixtureContractsComplete,true);
 assert.deepEqual(r.missing,[]);assert.equal(r.decision,'deny-real-access');
 for(const k of ['nativeAttestationVerified','independentCiVerification','linuxCgroupEnforcementVerified','hardRssLimitVerified','readerLimitIntegrated','osIsolationVerified','realReadsPerformed','operationsEnabled','releaseAuthorized'])assert.equal(r[k],false);
});
test('missing reports remain missing instead of fabricated qualification',()=>{
 const x=f();x.windowsAggregate=null;x.linuxCgroup=null;
 const r=consolidate(x);assert.deepEqual(r.missing,['linuxCgroup','windowsAggregate']);assert.equal(r.fixtureContractsComplete,false);assert.equal(r.observations.length,4);
 delete x.windowsProcess;assert.throws(()=>consolidate(x),refusal);
});
test('resource evidence refuses unsupported outcomes and authority claims',()=>{
 for(const mutate of [x=>x.windowsAggregate.combinedAllocationRefused=false,x=>x.windowsAggregate.refusalWin32Code=87,x=>x.windowsLifecycle.childExitCode=77,x=>x.windowsDescendant.descendantAttemptOutcome='unknown',x=>x.linuxAddress.hardRssLimitVerified=true,x=>x.windowsProcess.operationsEnabled=true,x=>x.windowsProcess=x.linuxAddress,x=>x.linuxAddress.path='/tmp',x=>x.scope='real-mod']){
  const x=f();mutate(x);assert.throws(()=>consolidate(x),refusal);
 }
});
test('cgroup discovery cannot be transformed into delegation or contradictory capability evidence',()=>{
 const x=f();x.linuxCgroup.directoryWriteAccessHint=true;x.linuxCgroup.status='candidate-unverified';
 assert.equal(consolidate(x).linuxCgroupEnforcementVerified,false);
 for(const patch of [{delegationVerified:true},{limitsApplied:true},{mountReadOnly:true},{controllers:['memory','cpu']},{controllers:['cpu','cpu']},{membershipResolved:false},{cgroupV2Observed:false},{status:'not-writable'}])assert.throws(()=>normalize('linuxCgroup',{...x.linuxCgroup,...patch}),refusal);
});
test('resource evidence rejects accessors and unexpected properties without invoking getters',()=>{
 const x=f();let invoked=false;
 Object.defineProperty(x.windowsAggregate,'positiveBefore',{get(){invoked=true;return true;}});
 assert.throws(()=>consolidate(x),refusal);assert.equal(invoked,false);
 const y=f();Object.defineProperty(y.linuxCgroup.controllers,'0',{get(){invoked=true;return 'cpu';}});
 assert.throws(()=>consolidate(y),refusal);assert.equal(invoked,false);
 const z=f();z.linuxCgroup.interfaces.extra=true;assert.throws(()=>consolidate(z),refusal);
});
test('resource evidence digests are stable, immutable and bound to report contents',()=>{
 const x=f(),r=consolidate(x);assert.deepEqual(consolidate(x),r);
 const {evidenceDigest,...body}=r;assert.equal(evidenceDigest,createHash('sha256').update(JSON.stringify(body)).digest('hex'));
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.observations)&&Object.isFrozen(r.missing));
 for(const o of r.observations){assert.ok(Object.isFrozen(o)&&Object.isFrozen(o.report));assert.equal(o.nativeAttestationVerified,false);}
 const c=r.observations[1].report;assert.ok(Object.isFrozen(c.controllers)&&Object.isFrozen(c.interfaces));
 x.linuxCgroup.controllers.pop();assert.equal(c.controllers.length,3);
 assert.notEqual(consolidate(x).evidenceDigest,r.evidenceDigest);
});

const binding=()=>({scope:'synthetic-fixture',kind:'windowsAggregate',platform:'win32',report:f().windowsAggregate,checkoutSha:'a'.repeat(40),scriptSha256:'b'.repeat(64)});
test('resource binding commits to exact normalized observation and checkout identity without attestation',()=>{
 const x=binding(),r=bind(x);
 assert.deepEqual(r,bind(x));assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.observation));
 const {bindingDigest,...body}=r;assert.equal(bindingDigest,createHash('sha256').update(JSON.stringify(body)).digest('hex'));
 assert.equal(r.contractValidated,true);
 for(const k of ['checkoutAttested','nativeAttestationVerified','independentCiVerification','readerLimitIntegrated','realReadsPerformed','operationsEnabled','releaseAuthorized'])assert.equal(r[k],false);
 for(const patch of [{checkoutSha:'c'.repeat(40)},{scriptSha256:'d'.repeat(64)},{report:{...x.report,refusalWin32Code:8}}])assert.notEqual(bind({...x,...patch}).bindingDigest,bindingDigest);
});
test('resource binding rejects platform mismatch malformed identity and authority injection',()=>{
 const x=binding();
 for(const patch of [{platform:'linux'},{checkoutSha:'A'.repeat(40)},{scriptSha256:'bad'},{scope:'real-mod'},{releaseAuthorized:true},{kind:'linuxAddress'},{report:{...x.report,operationsEnabled:true}}])assert.throws(()=>bind({...x,...patch}),refusal);
 let invoked=false;Object.defineProperty(x,'checkoutSha',{get(){invoked=true;return 'a'.repeat(40);}});
 assert.throws(()=>bind(x),refusal);assert.equal(invoked,false);
});

const cpuAuthority={cpuRateThrottleVerified:false,processTreeLimitVerified:false,readerLimitIntegrated:false,operationsEnabled:false,realReadsPerformed:false};
const cpuReports=()=>({scope:'synthetic-fixture',
 linuxCpuTime:{scope:'disposable-linux-cpu-fixture',mechanism:'RLIMIT_CPU',softSeconds:1,hardSeconds:2,positiveBefore:true,softSignal:'SIGXCPU',softHandlerExit:77,hardSignal:'SIGKILL',positiveAfter:true,cpuTimeLimitObserved:true,...cpuAuthority},
 windowsCpuTime:{scope:'disposable-windows-cpu-fixture',mechanism:'JobObjectJobUserTime',controlSeconds:20,limitSeconds:2,naturalCompletionCpuSeconds:10,naturalExitCode:77,limitedExitCode:3221225540,documentedQuotaExitObserved:false,ntStatusQuotaExitObserved:true,beforeUserTicks:100000000,limitedUserTicks:36718750,afterUserTicks:100000000,jobSignaled:true,controlJobsUnsignaled:true,positiveBefore:true,positiveAfter:true,cpuTimeLimitObserved:true,...cpuAuthority},
 windowsCpuRateConfig:{scope:'disposable-windows-cpu-rate-config',mechanism:'JobObjectCpuRateControlInformation',controlFlags:5,initialRate:2000,reducedRate:500,invalidZeroRejected:true,previousRatePreserved:true,restoredRate:10000,configurationReadbackVerified:true,childProcessesAssigned:0,...cpuAuthority}
});
test('CPU evidence separates native time observations from rate configuration and grants no authority',()=>{
 const x=cpuReports(),r=consolidateCpu(x);assert.equal(r.fixtureContractsComplete,true);assert.equal(r.observations.length,3);
 assert.equal(r.decision,'deny-real-access');assert.deepEqual(r,consolidateCpu(x));
 for(const k of ['nativeAttestationVerified','independentCiVerification','cpuRateThrottleVerified','processTreeLimitVerified','readerLimitIntegrated','osIsolationVerified','realReadsPerformed','operationsEnabled','releaseAuthorized'])assert.equal(r[k],false);
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.observations)&&Object.isFrozen(r.observations[1].report));
 const {evidenceDigest,...body}=r;assert.equal(evidenceDigest,createHash('sha256').update(JSON.stringify(body)).digest('hex'));
});
test('CPU evidence requires explicit missing reports and denies false claims',()=>{
 const x=cpuReports();x.windowsCpuTime=null;const r=consolidateCpu(x);
 assert.equal(r.fixtureContractsComplete,false);assert.deepEqual(r.missing,['windowsCpuTime']);
 delete x.windowsCpuTime;assert.throws(()=>consolidateCpu(x),refusal);
 for(const mutate of [x=>x.windowsCpuRateConfig.cpuRateThrottleVerified=true,x=>x.windowsCpuRateConfig.childProcessesAssigned=1,x=>x.linuxCpuTime.hardSignal='SIGTERM',x=>x.windowsCpuTime.limitedUserTicks=19999999,x=>x.windowsCpuTime.limitedUserTicks=100000000,x=>x.windowsCpuTime.beforeUserTicks=99999999,x=>x.windowsCpuTime.jobSignaled=false,x=>x.windowsCpuTime.controlJobsUnsignaled=false,x=>x.windowsCpuTime.limitedExitCode=77,x=>x.windowsCpuTime.documentedQuotaExitObserved=true,x=>x.windowsCpuTime.ntStatusQuotaExitObserved=false]){
  const y=cpuReports();mutate(y);assert.throws(()=>consolidateCpu(y),refusal);
 }
});
test('CPU identity binding validates platform, quota status and digest changes',()=>{
 const report=cpuReports().windowsCpuTime;
 const x={scope:'synthetic-fixture',kind:'windowsCpuTime',platform:'win32',report,checkoutSha:'a'.repeat(40),scriptSha256:'b'.repeat(64)};
 const a=bind(x);assert.equal(a.observation.report.ntStatusQuotaExitObserved,true);
 assert.equal(a.nativeAttestationVerified,false);assert.equal(a.operationsEnabled,false);
 assert.throws(()=>bind({...x,platform:'linux'}),refusal);
 const b=bind({...x,report:{...report,limitedExitCode:1816,documentedQuotaExitObserved:true,ntStatusQuotaExitObserved:false}});
 assert.notEqual(a.bindingDigest,b.bindingDigest);
 assert.throws(()=>bind({...x,report:{...report,limitedExitCode:1816}}),refusal);
});
