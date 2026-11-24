'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const script=path.join(__dirname,'..','native-lab','m121-linked-linux-diagnostic.py');
test('Linux linked fixture keeps config and directory handles across content and dependency metadata phases',
 {skip:process.platform!=='linux',timeout:20000},()=>{
 const run=spawnSync('python3',['-I','-S','-B',script],{encoding:'utf8',timeout:15000,maxBuffer:8192});
 assert.equal(run.status,0,run.stderr);
 const r=JSON.parse(run.stdout);
 assert.equal(r.schema,'omsi-m121-linked-linux-diagnostic-fixture-v1');
 assert.equal(r.scope,'fixed-synthetic-tree-only');
 assert.equal(r.sameRetainedHandlesUsed,true);
 assert.equal(r.cases.length,8);
 const rows=Object.fromEntries(r.cases.map(c=>[c.scenario,c]));
 for(const [name,outcome] of [['normal','exact-observed'],['case-only','case-only-observed'],['link','link-refused']]){
  assert.equal(rows[name].status,'linked-fixture-observed');
  assert.deepEqual(rows[name].outcomes,[outcome,'not-observed-in-directory']);
  assert.equal(rows[name].referencesObserved,2);
  assert.equal(rows[name].configReadCalls,3);
 }
 for(const name of ['parent-replaced','config-replaced','cancel-between','directory-changed','cancel-during-metadata']){
  assert.equal(rows[name].status,'linked-fixture-refused');
  assert.deepEqual(rows[name].outcomes,[]);
  assert.equal(rows[name].configReadCalls,2);
  assert.equal(rows[name].referencesObserved,['directory-changed','cancel-during-metadata'].includes(name)?1:0);
 }
 for(const row of r.cases)assert.ok(row.entriesScanned<=64);
 for(const k of ['dependencyContentsRead','realModValidated','atomicContainmentProven','nativeConsentVerified','operationsEnabled'])assert.equal(r[k],false);
 assert.doesNotMatch(run.stdout,/\.o3d|\.cfg|\/tmp\//);
});
test('linked fixture refuses caller arguments',{skip:process.platform!=='linux',timeout:10000},()=>{
 const run=spawnSync('python3',['-I','-S','-B',script,'/not-authorized'],{encoding:'utf8',timeout:5000,maxBuffer:4096});
 assert.equal(run.status,3);assert.equal(run.stdout,'');assert.equal(run.stderr.trim(),'M121_LINKED_FIXTURE_REFUSED');
});
