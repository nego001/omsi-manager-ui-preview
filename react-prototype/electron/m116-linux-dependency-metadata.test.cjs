'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
test('Linux descriptor-based dependency metadata distinguishes seven fixed cases',{skip:process.platform!=='linux',timeout:15000},()=>{
 const run=spawnSync('python3',['-I','-S','-B',path.join(__dirname,'..','native-lab','m116-linux-dependency-metadata.py')],{encoding:'utf8',timeout:10000,maxBuffer:4096});
 assert.equal(run.status,0,run.stderr);
 const r=JSON.parse(run.stdout);
 assert.equal(r.schema,'omsi-m116-linux-dependency-metadata-fixture-v1');
 assert.deepEqual(r.cases.map(c=>c.outcome),['exact-observed','case-only-observed','not-observed-in-directory','ambiguous-case','link-refused','not-regular-path','budget-limited']);
 assert.equal(r.cases[6].entriesScanned,1);
 assert.equal(r.nativeDirectoryDescriptorUsed,true);
 for(const k of ['dependencyContentsRead','realModValidated','atomicContainmentProven','operationsEnabled'])assert.equal(r[k],false);
 assert.doesNotMatch(run.stdout,/\.o3d|\/tmp\//);
});
