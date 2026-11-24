'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {reviewFixedNativeFormat:review}=require('../scripts/m115-fixed-native-format-bridge.cjs');
const example=()=>({schema:'omsi-m115-fixed-native-format-fixture-v1',platform:'win32',realModRead:false,operationsEnabled:false,
 cases:[['vehicle-definition','[model]\r\nmodel\\vehicle.cfg\r\n[sound]\r\nsound.cfg\r\n'],['vehicle-model','[mesh]\r\nbody.o3d\r\n[mesh]\r\nmissing.o3d\r\n']].map(([role,text])=>({role,fixtureBase64:Buffer.from(text).toString('base64'),opened:1,readCalls:2,bytesRead:2*Buffer.byteLength(text)}))});
function verify(r){
 assert.deepEqual(r.rows,[{role:'vehicle-definition',knownMarkers:2,references:1,exact:1,absentFromVirtualFixture:0},{role:'vehicle-model',knownMarkers:2,references:2,exact:1,absentFromVirtualFixture:1}]);
 assert.equal(r.actualDependencyFilesInspected,false);assert.equal(r.contentReadAuthorized,false);
 assert.doesNotMatch(JSON.stringify(r),/fixtureBase64|body\.o3d|missing\.o3d|vehicle\.cfg/);
}
test('native Linux fixed content fixture reaches shared format parser and virtual resolver',{skip:process.platform!=='linux',timeout:20000},()=>{
 const run=spawnSync('python3',['-I','-S','-B',path.join(__dirname,'..','native-lab','m111-linux-dirfd-config-reader.py'),'--test-format-m115'],{encoding:'utf8',timeout:15000,maxBuffer:4096});
 assert.equal(run.status,0,run.stderr);verify(review(JSON.parse(run.stdout),'linux'));
});
test('fixed wire protocol rejects altered bytes, scopes, counters and platform',()=>{
 const raw=example();verify(review(raw,'win32'));
 const alter=(key,value)=>({...raw,cases:raw.cases.map((r,i)=>i===0?{...r,[key]:value}:r)});
 for(const bad of [alter('fixtureBase64',Buffer.from('different').toString('base64')),alter('bytesRead',1),alter('path','private'),{...raw,realModRead:true},{...raw,cases:raw.cases.slice(1)}])
  assert.throws(()=>review(bad,'win32'),/M115_FIXED_FORMAT_FIXTURE_REFUSED/);
 assert.throws(()=>review(raw,'linux'));
});
