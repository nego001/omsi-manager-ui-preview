'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {mkdtemp,writeFile,readFile,rm} = require('node:fs/promises');
const {join,dirname} = require('node:path');
const {tmpdir} = require('node:os');
const {randomBytes} = require('node:crypto');
const {PREFIX,MARKER,CRASH_EXIT,expectedRecord,validRecord} = require('./temp-recovery-fixture.cjs');
const worker = join(__dirname,'temp-recovery-worker.cjs');
const node = process.execPath;
const activeRoots = new Set();
async function tempFixture(){
 const root=await mkdtemp(join(tmpdir(),PREFIX));
 activeRoots.add(root);
 const nonce=randomBytes(16).toString('hex');
 await writeFile(join(root,MARKER),nonce,{flag:'wx',mode:0o600});
 return {root,nonce};
}
function child(mode,fixture,arg){
 const p=spawnSync(node,[worker,mode,fixture.root,fixture.nonce,...(arg?[arg]:[])],
  {encoding:'utf8',timeout:10000,windowsHide:true,env:{...process.env,NODE_OPTIONS:''}});
 assert.equal(p.error,undefined,JSON.stringify(p.error));
 return p;
}
function recover(fixture){
 const p=child('reconcile',fixture);
 assert.equal(p.status,0,p.stderr);
 const json=JSON.parse(p.stdout.trim());
 assert.equal(json.operationsEnabled,false);
 assert.equal(json.durabilityProven,false);
 assert.equal(json.newAnalysisRequired,true);
 assert.equal(json.filesModifiedInGames,0);
 return json;
}
test.after(async()=>{for(const root of activeRoots)await rm(root,{recursive:true,force:true});});
test('real child process exits before preparing and fresh process finds no record',async()=>{
 const fixture=await tempFixture();
 assert.equal(child('simulate',fixture,'before-prepare').status,CRASH_EXIT);
 const record=recover(fixture);
 assert.equal(record.outcome,'empty-untrusted');
});
test('process ends after synced prepare; new process finds incomplete journal',async()=>{
 const fixture=await tempFixture();
 assert.equal(child('simulate',fixture,'after-prepare').status,CRASH_EXIT);
 const x=recover(fixture);
 assert.equal(x.outcome,'incomplete-untrusted');
 assert.equal(x.retainedStage,true);assert.equal(x.retainedIntent,false);
});
test('process ends after intent; fresh process does not publish it',async()=>{
 const fixture=await tempFixture();
 assert.equal(child('simulate',fixture,'after-intent').status,CRASH_EXIT);
 const x=recover(fixture);
 assert.equal(x.outcome,'incomplete-untrusted');
 assert.equal(x.retainedStage,true);assert.equal(x.retainedIntent,true);
 assert.equal(x.publicationObserved,false);
});
test('published fixture survives intentional process exit but remains untrusted',async()=>{
 const fixture=await tempFixture();
 assert.equal(child('simulate',fixture,'after-publish').status,CRASH_EXIT);
 const x=recover(fixture);
 assert.equal(x.outcome,'published-untrusted');
 assert.equal(x.publicationObserved,true);
 assert.equal(x.durabilityProven,false);
});
test('clean exit does not elevate published record to real integrity',async()=>{
 const fixture=await tempFixture();
 assert.equal(child('simulate',fixture,'complete').status,0);
 const x=recover(fixture);
 assert.equal(x.outcome,'published-untrusted');
 assert.equal(x.oldEvidenceReusable,false);
 assert.equal(x.fileIdentityNativeVerified,false);
});
test('calling recovery repeatedly has no side effects or promotion',async()=>{
 const fixture=await tempFixture();
 assert.equal(child('simulate',fixture,'after-intent').status,CRASH_EXIT);
 assert.deepEqual(recover(fixture),recover(fixture));
 const body=await readFile(join(fixture.root,'intent.json'),'utf8');
 assert.equal(JSON.parse(body).phase,'intent');
});
test('staged data is not silently overwritten on a reused fixture',async()=>{
 const fixture=await tempFixture();
 assert.equal(child('simulate',fixture,'after-intent').status,CRASH_EXIT);
 const rerun=child('simulate',fixture,'after-prepare');
 assert.equal(rerun.status,3);
 assert.match(rerun.stderr,/already used/);
 assert.equal(recover(fixture).retainedIntent,true);
});
test('forged published success cannot be accepted as real proof',async()=>{
 const fixture=await tempFixture();
 const record={...expectedRecord(fixture.nonce,'published'),operationsEnabled:true};
 await writeFile(join(fixture.root,'published.json'),JSON.stringify(record),{flag:'wx'});
 assert.equal(recover(fixture).outcome,'rejected-corrupt-or-incomplete');
});
test('version mismatch and extra fields are rejected',async()=>{
 for(const patch of [{schemaVersion:2},{extra:'unknown'},{scope:'real-journal'}]){
  const fixture=await tempFixture();
  await writeFile(join(fixture.root,'prepared.json'),JSON.stringify({...expectedRecord(fixture.nonce,'prepared'),...patch}),{flag:'wx'});
  assert.equal(recover(fixture).outcome,'rejected-corrupt-or-incomplete');
 }
});
test('truncated and excessively large files fail closed',async()=>{
 for(const txt of ['{','x'.repeat(3000)]){
  const fixture=await tempFixture();
  await writeFile(join(fixture.root,'published.json'),txt,{flag:'wx'});
  assert.equal(recover(fixture).outcome,'rejected-corrupt-or-incomplete');
 }
});
test('records from another temporary session fail nonce pairing',async()=>{
 const a=await tempFixture(),b=await tempFixture();
 await writeFile(join(a.root,'intent.json'),JSON.stringify(expectedRecord(b.nonce,'intent')),{flag:'wx'});
 assert.equal(recover(a).outcome,'rejected-corrupt-or-incomplete');
});
test('renamed or missing fixture marker blocks recovery without modification',async()=>{
 const fixture=await tempFixture();
 await writeFile(join(fixture.root,MARKER),'deadbeefdeadbeefdeadbeefdeadbeef');
 const p=child('reconcile',fixture);
 assert.equal(p.status,3);assert.match(p.stderr,/marker mismatch/);
});
test('arbitrary parent path is forbidden even with a fabricated marker',async()=>{
 const fixture=await tempFixture();
 const bogus={root:dirname(fixture.root),nonce:fixture.nonce};
 const p=child('simulate',bogus,'complete');
 assert.equal(p.status,3);assert.match(p.stderr,/not a direct temporary-fixture directory/);
});
test('test-only records are strict and never carry operational permissions',()=>{
 const n='0123456789abcdef0123456789abcdef';
 const x=expectedRecord(n,'intent');
 assert.equal(validRecord(x,n,'intent'),true);
 assert.equal(validRecord({...x,operationsEnabled:true},n,'intent'),false);
 assert.equal(validRecord({...x,phase:'published'},n,'intent'),false);
 assert.equal(validRecord({...x,extra:1},n,'intent'),false);
 assert.equal(Object.isFrozen(x),true);
});
test('external sentinel remains byte-for-byte untouched across process crashes',async()=>{
 const fixture=await tempFixture();
 const sentinel=join(tmpdir(),'omsi-manager-test-sentinel-'+randomBytes(8).toString('hex'));
 const content='DO-NOT-TOUCH:'+randomBytes(16).toString('hex');
 try{
  await writeFile(sentinel,content,{flag:'wx'});
  assert.equal(child('simulate',fixture,'after-intent').status,CRASH_EXIT);
  recover(fixture);
  assert.equal(await readFile(sentinel,'utf8'),content);
 }finally{await rm(sentinel,{force:true});}
});
