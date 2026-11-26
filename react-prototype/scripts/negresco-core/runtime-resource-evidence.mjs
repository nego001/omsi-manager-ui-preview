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
