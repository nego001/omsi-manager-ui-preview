'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
test('M124 Linux monotonic checkpoint expiry restores descriptor count and removes fixture',{skip:process.platform!=='linux',timeout:15000},()=>{
 const run=spawnSync('python3',['-I','-S','-B',path.join(__dirname,'..','native-lab','m121-linked-linux-diagnostic.py'),'--test-lifecycle-m124'],{encoding:'utf8',timeout:10000,maxBuffer:4096});
 assert.equal(run.status,0,run.stderr);
 const r=JSON.parse(run.stdout);
 assert.equal(r.schema,'omsi-m124-linux-lifecycle-fixture-v1');
 assert.deepEqual(r.cases.map(c=>[c.scenario,c.outcome,c.configReadCalls,c.referencesObserved]),[
  ['normal','completed',3,2],['expired-before','deadline-refused',0,0],
  ['expired-between','deadline-refused',2,0],['expired-during','deadline-refused',2,1],['cancel-during','cancelled',2,1]
 ]);
 for(const c of r.cases){assert.equal(c.descriptorCountRestored,true);assert.equal(c.temporaryRootRemoved,true);}
 for(const k of ['monotonicCheckpointDeadline','testClockOffsetUsed'])assert.equal(r[k],true);
 for(const k of ['partialReportPublished','osDeadlineProven','memoryErasureProven','realModValidated','operationsEnabled'])assert.equal(r[k],false);
});
