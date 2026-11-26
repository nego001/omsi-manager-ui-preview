// F4.02b.7: pure fixture capability contracts. Caller reports are not attestation.
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('CORE_MEMORY_EVIDENCE_REFUSED');};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const noAuthority={readerLimitIntegrated:false,operationsEnabled:false,realReadsPerformed:false};
const noIsolation={osIsolationVerified:false,operationsEnabled:false,realReadsPerformed:false};
const memoryCodes=[8,14,1455,1816];
const bool=v=>typeof v==='boolean';
const oneOf=values=>v=>values.includes(v);
const exitCode=v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff&&v!==77&&v!==259;
function exact(input,shape){
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).length!==Object.keys(shape).length)fail();
 const out={};for(const [key,expected] of Object.entries(shape)){
  const d=Object.getOwnPropertyDescriptor(input,key);
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();
  const v=d.value;
  if(typeof expected==='function'){if(!expected(v))fail();}
  else if(v!==expected)fail();
  out[key]=v;
 }return out;
}
const schemas={
 linuxAddress:{scope:'disposable-linux-memory-fixture',mechanism:'RLIMIT_AS',limitBytes:134217728,positiveBeforeBytes:8388608,refusedRequestBytes:134217728,refusal:'ENOMEM',positiveAfterBytes:8388608,addressSpaceLimitObserved:true,hardRssLimitVerified:false,processTreeLimitVerified:false,...noAuthority},
 windowsProcess:{scope:'disposable-windows-memory-fixture',mechanism:'JobObjectProcessMemory',limitBytes:536870912,positiveBeforeBytes:8388608,refusedRequestBytes:536870912,refusalWin32Code:oneOf(memoryCodes),positiveAfterBytes:8388608,processCommitLimitObserved:true,hardRssLimitVerified:false,processTreeLimitVerified:false,killOnJobCloseVerified:false,...noAuthority},
 windowsLifecycle:{scope:'disposable-windows-job-lifecycle',jobCommitLimitBytes:536870912,activeProcessLimit:1,limitsReadBack:true,suspendedAssignmentObserved:true,ownedChildReadyObserved:true,ownedChildAliveBeforeClose:true,ownedChildTerminatedAfterClose:true,childExitCode:exitCode,aggregateAllocationRefusalVerified:false,descendantLimitVerified:false,readerLimitIntegrated:false,...noIsolation},
 windowsDescendant:{scope:'disposable-windows-job-descendant',activeProcessLimit:1,outsideJobPositiveControl:true,descendantAttemptOutcome:oneOf(['create-refused-5','create-refused-1816','created-but-terminated-before-resume']),insideJobRaisedLimitPositiveControl:true,controlChildMembershipVerified:true,restoredLimitVerified:true,descendantLimitObserved:true,allChildrenCreatedSuspended:true,aggregateAllocationRefusalVerified:false,readerLimitIntegrated:false,...noIsolation},
 windowsAggregate:{scope:'disposable-windows-aggregate-memory',jobLimitBytes:201326592,individualRequestBytes:117440512,twoOwnedChildrenAssigned:true,allChildrenSuspended:true,individualProcessLimitConfigured:false,positiveBefore:true,firstAllocationHeld:true,combinedAllocationRefused:true,refusalWin32Code:oneOf(memoryCodes),positiveAfterRelease:true,limitReadbackVerified:true,aggregateCommitLimitObserved:true,hardRssLimitVerified:false,readerLimitIntegrated:false,...noIsolation}
};
const cpuKinds=Object.freeze(['linuxCpuTime','windowsCpuTime','windowsCpuRateConfig','windowsCpuRateLoad']);
const positiveTicks=v=>Number.isSafeInteger(v)&&v>=100000000;
const limitedTicks=v=>Number.isSafeInteger(v)&&v>=20000000&&v<100000000;
const safePositive=v=>Number.isSafeInteger(v)&&v>0;
const wallTicks=v=>Number.isSafeInteger(v)&&v>=38000000&&v<=65000000;
const cpuNoAuthority={cpuRateThrottleVerified:false,processTreeLimitVerified:false,...noAuthority};
Object.assign(schemas,{
 linuxCpuTime:{scope:'disposable-linux-cpu-fixture',mechanism:'RLIMIT_CPU',softSeconds:1,hardSeconds:2,positiveBefore:true,softSignal:'SIGXCPU',softHandlerExit:77,hardSignal:'SIGKILL',positiveAfter:true,cpuTimeLimitObserved:true,...cpuNoAuthority},
 windowsCpuTime:{scope:'disposable-windows-cpu-fixture',mechanism:'JobObjectJobUserTime',controlSeconds:20,limitSeconds:2,naturalCompletionCpuSeconds:10,naturalExitCode:77,limitedExitCode:oneOf([1816,3221225540]),documentedQuotaExitObserved:bool,ntStatusQuotaExitObserved:bool,beforeUserTicks:positiveTicks,limitedUserTicks:limitedTicks,afterUserTicks:positiveTicks,jobSignaled:true,controlJobsUnsignaled:true,positiveBefore:true,positiveAfter:true,cpuTimeLimitObserved:true,...cpuNoAuthority},
 windowsCpuRateConfig:{scope:'disposable-windows-cpu-rate-config',mechanism:'JobObjectCpuRateControlInformation',controlFlags:5,initialRate:2000,reducedRate:500,invalidZeroRejected:true,previousRatePreserved:true,restoredRate:10000,configurationReadbackVerified:true,childProcessesAssigned:0,...cpuNoAuthority},
 windowsCpuRateLoad:{scope:'disposable-windows-cpu-rate-load',mechanism:'JobObjectCpuRateControlInformation',controlRate:10000,limitedRate:safePositive,logicalProcessors:v=>Number.isInteger(v)&&v>=1&&v<=32,sampleMilliseconds:4000,beforeCpuTicks:safePositive,beforeWallTicks:wallTicks,limitedCpuTicks:safePositive,limitedWallTicks:wallTicks,afterCpuTicks:safePositive,afterWallTicks:wallTicks,sameOwnedChild:true,readyObserved:true,rateReadbackVerified:true,differentialObserved:true,exactCpuRateGuaranteeVerified:false,processTreeLimitVerified:false,...noAuthority}
});
export function consolidateFixtureCpuEvidence(input){
 const x=exact(input,{scope:'synthetic-fixture',...Object.fromEntries(cpuKinds.map(k=>[k,v=>v===null||typeof v==='object']))});
 const observations=Object.freeze(cpuKinds.filter(k=>x[k]!==null).map(k=>normalizeFixtureResourceEvidence(k,x[k])));
 const missing=Object.freeze(cpuKinds.filter(k=>x[k]===null));
 const body={schemaVersion:1,scope:x.scope,observations,missing,fixtureContractsComplete:missing.length===0,nativeAttestationVerified:false,independentCiVerification:false,cpuRateThrottleVerified:false,processTreeLimitVerified:false,readerLimitIntegrated:false,osIsolationVerified:false,realReadsPerformed:false,operationsEnabled:false,releaseAuthorized:false,decision:'deny-real-access'};
 return Object.freeze({...body,evidenceDigest:hash(body)});
}
const lifecycleKinds=Object.freeze(['linuxParentDeath','windowsJobTree']);
const treeExitCode=v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff&&![77,78,79,259].includes(v);
const lifecycleNoAuthority={arbitraryTreeVerified:false,readerIntegrated:false,operationsEnabled:false,realReadsPerformed:false};
Object.assign(schemas,{
 linuxParentDeath:{scope:'disposable-linux-parent-death',mechanism:'PR_SET_PDEATHSIG',positiveBefore:true,childReadyBeforeParentExit:true,parentNaturalExit:true,adoptedDescendantReaped:true,descendantSignal:'SIGKILL',positiveAfter:true,pidfdIdentityUsed:true,directDescendantOnly:true,...lifecycleNoAuthority},
 windowsJobTree:{scope:'disposable-windows-job-tree',mechanism:'JobObjectKillOnClose',activeProcessLimit:2,positiveBefore:true,positiveAfter:true,parentAssignedSuspended:true,descendantInheritedMembership:true,bothReadyAndAlive:true,lastJobHandleClosed:true,bothTerminated:true,descendantIdentityHandshake:true,activeCountVerified:true,parentExitCode:treeExitCode,descendantExitCode:treeExitCode,...lifecycleNoAuthority}
});
export function consolidateFixtureLifecycleEvidence(input){
 const x=exact(input,{scope:'synthetic-fixture',...Object.fromEntries(lifecycleKinds.map(k=>[k,v=>v===null||typeof v==='object']))});
 const observations=Object.freeze(lifecycleKinds.filter(k=>x[k]!==null).map(k=>normalizeFixtureResourceEvidence(k,x[k])));
 const missing=Object.freeze(lifecycleKinds.filter(k=>x[k]===null));
 const body={schemaVersion:1,scope:x.scope,observations,missing,fixtureContractsComplete:missing.length===0,
  nativeAttestationVerified:false,independentCiVerification:false,arbitraryTreeVerified:false,
  guaranteedTerminationVerified:false,hardDeadlineVerified:false,readerIntegrated:false,
  osIsolationVerified:false,realReadsPerformed:false,operationsEnabled:false,releaseAuthorized:false,decision:'deny-real-access'};
 return Object.freeze({...body,evidenceDigest:hash(body)});
}
function controllers(v){
 if(!Array.isArray(v)||v.length>3||Reflect.ownKeys(v).length!==v.length+1)return false;
 let prev='';for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d||!Object.hasOwn(d,'value')||!d.enumerable||!['cpu','memory','pids'].includes(d.value)||d.value<=prev)return false;prev=d.value;}return true;
}
function cgroup(input){
 const c=exact(input,{scope:'disposable-linux-cgroup-discovery',status:oneOf(['unavailable','membership-unresolved','not-writable','candidate-unverified']),cgroupV2Observed:bool,membershipResolved:bool,mountReadOnly:bool,controllers,interfaces:v=>!!v,directoryWriteAccessHint:bool,delegationVerified:false,limitsApplied:false,memoryEnforcementVerified:false,descendantLimitVerified:false,cgroupKillVerified:false,realReadsPerformed:false,operationsEnabled:false});
 c.interfaces=Object.freeze(exact(c.interfaces,{memoryMax:bool,memoryCurrent:bool,pidsMax:bool,cpuMax:bool,cgroupKill:bool}));
 c.controllers=Object.freeze(Array.from({length:c.controllers.length},(_,i)=>Object.getOwnPropertyDescriptor(c.controllers,String(i)).value));
 if(c.membershipResolved&&!c.cgroupV2Observed)fail();
 if(!c.membershipResolved&&(c.mountReadOnly||c.directoryWriteAccessHint||c.controllers.length||Object.values(c.interfaces).some(Boolean)))fail();
 if(c.mountReadOnly&&c.directoryWriteAccessHint)fail();
 if(c.status!==(!c.cgroupV2Observed?'unavailable':!c.membershipResolved?'membership-unresolved':c.directoryWriteAccessHint?'candidate-unverified':'not-writable'))fail();
 return c;
}
export function normalizeFixtureResourceEvidence(kind,report){
 if(typeof kind!=='string'||(!Object.hasOwn(schemas,kind)&&kind!=='linuxCgroup'))fail();
 const normalized=Object.freeze(kind==='linuxCgroup'?cgroup(report):exact(report,schemas[kind]));
 if(kind==='windowsCpuTime'&&(normalized.documentedQuotaExitObserved!==(normalized.limitedExitCode===1816)||normalized.ntStatusQuotaExitObserved!==(normalized.limitedExitCode===3221225540)))fail();
 if(kind==='windowsCpuRateLoad'){
  const r=normalized;
  for(const phase of ['before','limited','after'])if(r[phase+'CpuTicks']>r[phase+'WallTicks']*2)fail();
  const a=r.beforeCpuTicks/r.beforeWallTicks,b=r.limitedCpuTicks/r.limitedWallTicks,c=r.afterCpuTicks/r.afterWallTicks;
  if(r.limitedRate!==Math.floor(1000/r.logicalProcessors)||a<0.5||c<0.5||b>Math.min(a,c)*0.5||b>r.logicalProcessors*r.limitedRate/10000+0.15)fail();
 }
 const body={kind,report:normalized,origin:'caller-supplied-fixture-report',nativeAttestationVerified:false,independentCiVerification:false,operationsEnabled:false};
 return Object.freeze({...body,evidenceDigest:hash(body)});
}
export function consolidateFixtureResourceEvidence(input){
 const kinds=['linuxAddress','linuxCgroup','windowsProcess','windowsLifecycle','windowsDescendant','windowsAggregate'];
 const x=exact(input,{scope:'synthetic-fixture',...Object.fromEntries(kinds.map(k=>[k,v=>v===null||typeof v==='object']))});
 const observations=Object.freeze(kinds.filter(k=>x[k]!==null).map(k=>normalizeFixtureResourceEvidence(k,x[k])));
 const missing=Object.freeze(kinds.filter(k=>x[k]===null));
 const body={schemaVersion:1,scope:x.scope,observations,missing,fixtureContractsComplete:missing.length===0,
  nativeAttestationVerified:false,independentCiVerification:false,linuxCgroupEnforcementVerified:false,
  hardRssLimitVerified:false,readerLimitIntegrated:false,osIsolationVerified:false,realReadsPerformed:false,operationsEnabled:false,releaseAuthorized:false,decision:'deny-real-access'};
 return Object.freeze({...body,evidenceDigest:hash(body)});
}

export function bindFixtureResourceObservation(input){
 const x=exact(input,{scope:'synthetic-fixture',kind:v=>typeof v==='string',platform:oneOf(['linux','win32']),report:v=>!!v,checkoutSha:v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v),scriptSha256:v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)});
 const observation=normalizeFixtureResourceEvidence(x.kind,x.report);
 if(x.platform!==(x.kind.startsWith('linux')?'linux':'win32'))fail();
 const body={schemaVersion:1,scope:x.scope,platform:x.platform,checkoutSha:x.checkoutSha,scriptSha256:x.scriptSha256,observation,contractValidated:true,checkoutAttested:false,nativeAttestationVerified:false,independentCiVerification:false,readerLimitIntegrated:false,realReadsPerformed:false,operationsEnabled:false,releaseAuthorized:false};
 return Object.freeze({...body,bindingDigest:hash(body)});
}
