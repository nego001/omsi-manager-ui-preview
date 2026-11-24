'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
test('M123 Linux linked dependency hardlink is refused as regular dependency without opening its contents',{skip:process.platform!=='linux',timeout:15000},()=>{
 const run=spawnSync('python3',['-I','-S','-B',path.join(__dirname,'..','native-lab','m121-linked-linux-diagnostic.py'),'--test-hardlink-m123'],{encoding:'utf8',timeout:10000,maxBuffer:4096});
 assert.equal(run.status,0,run.stderr);
 const r=JSON.parse(run.stdout);
 assert.equal(r.schema,'omsi-m123-linux-dependency-hardlink-fixture-v1');
 assert.equal(r.case.scenario,'hardlink');
 assert.equal(r.case.status,'linked-fixture-observed');
 assert.deepEqual(r.case.outcomes,['not-regular-path','not-observed-in-directory']);
 assert.equal(r.case.configReadCalls,3);assert.equal(r.case.referencesObserved,2);
 for(const k of ['dependencyContentsRead','realModValidated','operationsEnabled'])assert.equal(r[k],false);
 assert.doesNotMatch(run.stdout,/\.o3d|\.cfg/);
});
