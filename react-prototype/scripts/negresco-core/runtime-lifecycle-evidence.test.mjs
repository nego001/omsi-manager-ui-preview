import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {consolidateFixtureLifecycleEvidence as consolidate,normalizeFixtureResourceEvidence as normalize,bindFixtureResourceObservation as bind} from './runtime-resource-evidence.mjs';
const denied={arbitraryTreeVerified:false,readerIntegrated:false,operationsEnabled:false,realReadsPerformed:false};
const fixture=()=>({scope:'synthetic-fixture',
 linuxParentDeath:{scope:'disposable-linux-parent-death',mechanism:'PR_SET_PDEATHSIG',positiveBefore:true,childReadyBeforeParentExit:true,parentNaturalExit:true,adoptedDescendantReaped:true,descendantSignal:'SIGKILL',positiveAfter:true,pidfdIdentityUsed:true,directDescendantOnly:true,...denied},
 windowsJobTree:{scope:'disposable-windows-job-tree',mechanism:'JobObjectKillOnClose',activeProcessLimit:2,positiveBefore:true,positiveAfter:true,parentAssignedSuspended:true,descendantInheritedMembership:true,bothReadyAndAlive:true,lastJobHandleClosed:true,bothTerminated:true,descendantIdentityHandshake:true,activeCountVerified:true,parentExitCode:0,descendantExitCode:0,...denied}
});
const refusal=/CORE_MEMORY_EVIDENCE_REFUSED/;
test('complete lifecycle fixture contracts cannot authorize production or arbitrary tree guarantees',()=>{
 const x=fixture(),r=consolidate(x);
 assert.equal(r.fixtureContractsComplete,true);assert.equal(r.observations.length,2);assert.equal(r.decision,'deny-real-access');
 for(const k of ['nativeAttestationVerified','independentCiVerification','arbitraryTreeVerified','guaranteedTerminationVerified','hardDeadlineVerified','readerIntegrated','osIsolationVerified','realReadsPerformed','operationsEnabled','releaseAuthorized'])assert.equal(r[k],false);
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.missing)&&Object.isFrozen(r.observations)&&Object.isFrozen(r.observations[0].report));
 const {evidenceDigest,...body}=r;assert.equal(evidenceDigest,createHash('sha256').update(JSON.stringify(body)).digest('hex'));
 assert.deepEqual(r,consolidate(x));
});
test('lifecycle consolidation records missing native report rather than manufacturing success',()=>{
 const x=fixture();x.windowsJobTree=null;
 const r=consolidate(x);assert.equal(r.fixtureContractsComplete,false);assert.deepEqual(r.missing,['windowsJobTree']);
 assert.equal(r.observations.length,1);delete x.windowsJobTree;assert.throws(()=>consolidate(x),refusal);
});
test('lifecycle contracts reject natural exits, unsupported mechanisms and false security claims',()=>{
 const x=fixture();
 for(const patch of [{parentExitCode:77},{descendantExitCode:78},{descendantExitCode:79},{parentExitCode:259},{parentExitCode:-1},{descendantExitCode:0x100000000},{bothTerminated:false},{descendantIdentityHandshake:false},{activeCountVerified:false},{descendantInheritedMembership:false},{lastJobHandleClosed:false},{activeProcessLimit:1},{positiveAfter:false},{arbitraryTreeVerified:true},{readerIntegrated:true},{operationsEnabled:true}])assert.throws(()=>normalize('windowsJobTree',{...x.windowsJobTree,...patch}),refusal);
 for(const patch of [{descendantSignal:'SIGTERM'},{adoptedDescendantReaped:false},{childReadyBeforeParentExit:false},{pidfdIdentityUsed:false},{directDescendantOnly:false},{arbitraryTreeVerified:true}])assert.throws(()=>normalize('linuxParentDeath',{...x.linuxParentDeath,...patch}),refusal);
 let invoked=false;Object.defineProperty(x.linuxParentDeath,'parentNaturalExit',{enumerable:true,get(){invoked=true;return true;}});
 assert.throws(()=>consolidate(x),refusal);assert.equal(invoked,false);
});
test('lifecycle report binding distinguishes platform, script and observed termination code',()=>{
 const x={scope:'synthetic-fixture',kind:'windowsJobTree',platform:'win32',report:fixture().windowsJobTree,checkoutSha:'a'.repeat(40),scriptSha256:'b'.repeat(64)};
 const a=bind(x);assert.equal(a.contractValidated,true);assert.equal(a.nativeAttestationVerified,false);assert.equal(a.releaseAuthorized,false);
 assert.throws(()=>bind({...x,platform:'linux'}),refusal);
 assert.notEqual(bind({...x,report:{...x.report,descendantExitCode:3}}).bindingDigest,a.bindingDigest);
 assert.notEqual(bind({...x,scriptSha256:'c'.repeat(64)}).bindingDigest,a.bindingDigest);
});
