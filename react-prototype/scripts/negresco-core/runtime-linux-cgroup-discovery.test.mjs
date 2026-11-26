import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../../native-lab/negresco-linux-cgroup-discovery.py',import.meta.url));
test('Linux cgroup discovery reports capability without asserting delegation or enforcement',t=>{
 if(process.platform!=='linux'){
  t.diagnostic('Linux cgroup v2 discovery not executed on this host.');
  return;
 }
 const p=spawnSync('python3',['-I','-B',script],{encoding:'utf8',timeout:10000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.ok(['unavailable','membership-unresolved','candidate-unverified','not-writable'].includes(r.status));
 for(const k of ['cgroupV2Observed','membershipResolved','mountReadOnly','directoryWriteAccessHint'])assert.equal(typeof r[k],'boolean');
 assert.ok(Array.isArray(r.controllers));assert.deepEqual(r.controllers,[...new Set(r.controllers)].sort());
 assert.ok(r.controllers.every(x=>['cpu','memory','pids'].includes(x)));
 assert.deepEqual(Object.keys(r.interfaces).sort(),['cgroupKill','cpuMax','memoryCurrent','memoryMax','pidsMax']);
 assert.ok(Object.values(r.interfaces).every(x=>typeof x==='boolean'));
 assert.deepEqual(r,{scope:'disposable-linux-cgroup-discovery',status:r.status,cgroupV2Observed:r.cgroupV2Observed,membershipResolved:r.membershipResolved,mountReadOnly:r.mountReadOnly,controllers:r.controllers,interfaces:r.interfaces,directoryWriteAccessHint:r.directoryWriteAccessHint,delegationVerified:false,limitsApplied:false,memoryEnforcementVerified:false,descendantLimitVerified:false,cgroupKillVerified:false,realReadsPerformed:false,operationsEnabled:false});
 const expected=!r.cgroupV2Observed?'unavailable':!r.membershipResolved?'membership-unresolved':r.directoryWriteAccessHint?'candidate-unverified':'not-writable';
 assert.equal(r.status,expected);
 if(!r.membershipResolved){assert.equal(r.directoryWriteAccessHint,false);assert.deepEqual(r.controllers,[]);assert.ok(Object.values(r.interfaces).every(x=>!x));}
 if(r.mountReadOnly)assert.equal(r.directoryWriteAccessHint,false);
 t.diagnostic('Linux cgroup discovery: '+JSON.stringify(r));
});
