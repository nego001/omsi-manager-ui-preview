import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {consolidateFixturePermissionEvidence as consolidate,normalizeFixtureResourceEvidence as normalize,bindFixtureResourceObservation as bind} from './runtime-resource-evidence.mjs';
// Synthetic reports only, independently specified from native wrapper expectations.
const fixture=()=>({scope:'synthetic-fixture',
 linuxSocketRestriction:{
  scope:'disposable-linux-socket-restriction',mechanism:'seccomp',
  positiveBefore:true,positiveAfter:true,noNewPrivilegesReadback:true,
  inetSocketRefused:true,inet6SocketRefused:true,unixSocketRefused:true,
  socketpairRefused:true,preexistingSocketConnectRefused:true,
  refusal:'EPERM',loopbackListenerUnreached:true,
  inheritedConnectedSocketsVerified:false,allNetworkDeniedVerified:false,
  readerIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 },
 windowsAppContainerNetwork:{
  scope:'disposable-windows-appcontainer-network',mechanism:'AppContainer',
  positiveBefore:true,positiveAfter:true,appContainerTokenVerified:true,zeroCapabilitiesVerified:true,profileSidVerified:true,
  loopbackConnectRefused:true,refusalWin32Code:10013,loopbackListenerUnreached:true,
  profileDeleteSucceeded:true,temporaryFilesRemoved:true,firewallChanged:false,
  allNetworkDeniedVerified:false,readerIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 },
 linuxLandlockFilesystem:{
  scope:'disposable-linux-landlock-filesystem',mechanism:'Landlock',abi:4,
  positiveBefore:true,positiveAfter:true,allowedRead:true,allowedList:true,
  outsideReadRefused:true,outsideListRefused:true,writeRefused:true,truncateRefused:true,
  createRefused:true,deleteRefused:true,refusal:'EACCES',fixturesUnchanged:true,
  inheritedDescriptorsVerified:false,universalFilesystemIsolationVerified:false,
  readerIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 },
 windowsAppContainerFilesystem:{
  scope:'disposable-windows-appcontainer-filesystem',mechanism:'AppContainerFixtureAcl',
  positiveBefore:true,positiveAfter:true,appContainerTokenVerified:true,zeroCapabilitiesVerified:true,profileSidVerified:true,
  allowedRead:true,outsideReadRefused:true,writeRefused:true,truncateRefused:true,createRefused:true,deleteRefused:true,
  explicitFixtureAcl:true,fixturesUnchanged:true,profileDeleteSucceeded:true,temporaryFilesRemoved:true,
  inheritedHandlesVerified:false,universalFilesystemIsolationVerified:false,readerIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 },
 linuxInheritedResources:{
  scope:'disposable-linux-inherited-resources',mechanism:'seccomp+Landlock',abi:4,
  preopenedFileReadObserved:true,preconnectedSocketSendObserved:true,parentMarkerObserved:true,
  closedFileRefused:true,closedSocketRefused:true,outsideReopenRefused:true,newSocketRefused:true,
  fixtureUnchanged:true,descriptorBoundaryDemonstrated:true,automaticDescriptorHygieneVerified:false,
  allNetworkDeniedVerified:false,universalFilesystemIsolationVerified:false,readerIntegrated:false,
  operationsEnabled:false,realReadsPerformed:false
 },
 linuxDescriptorHygiene:{
  scope:'disposable-linux-descriptor-hygiene',mechanism:'close_range+seccomp+Landlock',
  abi:4,positiveFileControl:true,positiveSocketControl:true,preexistingDescriptorsObserved:true,
  closeRangeSucceeded:true,exactPipeAllowlistVerified:true,preopenedFileClosed:true,
  preconnectedSocketClosed:true,receiverEofObserved:true,outsideReopenRefused:true,
  newSocketRefused:true,allowedRead:true,fixtureUnchanged:true,
  readerIntegrated:false,automaticProductionHygieneVerified:false,allNetworkDeniedVerified:false,
  universalFilesystemIsolationVerified:false,operationsEnabled:false,realReadsPerformed:false
 },
 windowsHandleAllowlist:{
  scope:'disposable-windows-file-handle-allowlist',mechanism:'PROC_THREAD_ATTRIBUTE_HANDLE_LIST',
  positiveBefore:true,positiveAfter:true,bothSourceHandlesInheritable:true,
  explicitHandleListApplied:true,allowedHandleRead:true,omittedHandleRefused:true,
  refusalWin32Code:6,fixturesUnchanged:true,temporaryFilesRemoved:true,
  allHandlesEnumerated:false,inheritedSocketsVerified:false,automaticProductionHygieneVerified:false,
  readerIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 }
});
const refusal=/CORE_MEMORY_EVIDENCE_REFUSED/;
test('permission completeness never grants operational or universal isolation authority',()=>{
 const x=fixture(),r=consolidate(x);
 assert.equal(r.fixtureContractsComplete,true);assert.equal(r.observations.length,7);
 assert.deepEqual(r.missing,[]);assert.equal(r.decision,'deny-real-access');
 for(const k of ['nativeAttestationVerified','independentCiVerification','allNetworkDeniedVerified','universalFilesystemIsolationVerified','automaticProductionHygieneVerified','windowsInheritedSocketsVerified','readerIntegrated','osIsolationVerified','realReadsPerformed','operationsEnabled','releaseAuthorized'])assert.equal(r[k],false);
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.missing)&&Object.isFrozen(r.observations)&&r.observations.every(o=>Object.isFrozen(o)&&Object.isFrozen(o.report)));
 const {evidenceDigest,...body}=r;
 assert.equal(evidenceDigest,createHash('sha256').update(JSON.stringify(body)).digest('hex'));
 assert.deepEqual(r,consolidate(x));
 x.linuxLandlockFilesystem.abi=5;assert.notEqual(consolidate(x).evidenceDigest,r.evidenceDigest);
});
test('missing Windows network evidence stays missing and timeout is not denial',()=>{
 const x=fixture();x.windowsAppContainerNetwork=null;
 const r=consolidate(x);assert.equal(r.fixtureContractsComplete,false);assert.deepEqual(r.missing,['windowsAppContainerNetwork']);assert.equal(r.observations.length,6);
 assert.equal(r.decision,'deny-real-access');
 delete x.windowsAppContainerNetwork;assert.throws(()=>consolidate(x),refusal);
 for(const patch of [{refusalWin32Code:10060},{refusalWin32Code:83},{loopbackConnectRefused:false},{zeroCapabilitiesVerified:false},{firewallChanged:true},{profileDeleteSucceeded:false}]){
  assert.throws(()=>normalize('windowsAppContainerNetwork',{...fixture().windowsAppContainerNetwork,...patch}),refusal);
 }
});
test('permission evidence rejects unsupported guarantees, weak controls and unknown fields',()=>{
 const x=fixture();
 for(const [kind,patch] of [
  ['linuxSocketRestriction',{refusal:'ETIMEDOUT'}],
  ['linuxLandlockFilesystem',{abi:2}],
  ['linuxLandlockFilesystem',{writeRefused:false}],
  ['windowsAppContainerFilesystem',{fixturesUnchanged:false}],
  ['linuxInheritedResources',{preconnectedSocketSendObserved:false}],
  ['linuxDescriptorHygiene',{exactPipeAllowlistVerified:false}],
  ['windowsHandleAllowlist',{inheritedSocketsVerified:true}],
  ['windowsHandleAllowlist',{allHandlesEnumerated:true}],
  ['windowsHandleAllowlist',{refusalWin32Code:5}]
 ])assert.throws(()=>normalize(kind,{...x[kind],...patch}),refusal);
 for(const [kind,report] of Object.entries(x).filter(([k])=>k!=='scope')){
  assert.throws(()=>normalize(kind,{...report,operationsEnabled:true}),refusal);
  assert.throws(()=>normalize(kind,{...report,unexpected:true}),refusal);
 }
 let invoked=false;Object.defineProperty(x.linuxSocketRestriction,'positiveBefore',{enumerable:true,get(){invoked=true;return true;}});
 assert.throws(()=>consolidate(x),refusal);assert.equal(invoked,false);
});
test('permission binding verifies platform and digest but does not attest actual execution',()=>{
 const input={scope:'synthetic-fixture',kind:'linuxDescriptorHygiene',platform:'linux',report:fixture().linuxDescriptorHygiene,checkoutSha:'a'.repeat(40),scriptSha256:'b'.repeat(64)};
 const r=bind(input);assert.equal(r.contractValidated,true);assert.equal(r.checkoutAttested,false);assert.equal(r.nativeAttestationVerified,false);assert.equal(r.releaseAuthorized,false);
 assert.throws(()=>bind({...input,platform:'win32'}),refusal);
 assert.notEqual(bind({...input,scriptSha256:'c'.repeat(64)}).bindingDigest,r.bindingDigest);
 assert.notEqual(bind({...input,report:{...input.report,abi:5}}).bindingDigest,r.bindingDigest);
});
