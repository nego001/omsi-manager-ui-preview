'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const lab=path.join(__dirname,'..','native-lab','m111-linux-dirfd-config-reader.py');
test('Linux native dirfd fixture refuses redirections and bounds positional reads',
 {skip:process.platform!=='linux',timeout:20000},()=>{
 const result=spawnSync('python3',['-I','-S','-B',lab],{encoding:'utf8',timeout:15000,maxBuffer:16384});
 assert.equal(result.error,undefined);
 assert.equal(result.status,0,result.stderr);
 const report=JSON.parse(result.stdout);
 assert.equal(report.schema,'omsi-m111-linux-dirfd-fixture-v1');
 assert.equal(report.nativeDirFdUsed,true);
 assert.equal(report.cases.length,12);
 const rows=Object.fromEntries(report.cases.map(r=>[r.scenario,r]));
 for(const name of ['normal','maximum'])assert.equal(rows[name].outcome,'matching-two-snapshots');
 assert.equal(rows.maximum.bytesRead,131072);
 for(const name of ['symlink','fifo','hardlink','oversized','empty','parent-replaced','file-replaced','cancel-before']){
  assert.equal(rows[name].outcome,'refused');
  assert.equal(rows[name].readCalls,0);
 }
 for(const name of ['changed-during-read','cancel-during-read']){
  assert.equal(rows[name].outcome,'refused');
  assert.equal(rows[name].readCalls,1);
 }
 for(const key of ['nativeIdentityVerifiedForRealMods','atomicContainmentProven','abaRuledOut','osDeadlineProven','realModRead','operationsEnabled'])assert.equal(report[key],false);
});
test('Linux fixture executable refuses caller-supplied path argument',
 {skip:process.platform!=='linux',timeout:10000},()=>{
 const result=spawnSync('python3',['-I','-S','-B',lab,'/not-authorized'],{encoding:'utf8',timeout:5000,maxBuffer:4096});
 assert.equal(result.status,3);
 assert.equal(result.stdout,'');
 assert.equal(result.stderr.trim(),'M111_LINUX_FIXTURE_REFUSED');
});
