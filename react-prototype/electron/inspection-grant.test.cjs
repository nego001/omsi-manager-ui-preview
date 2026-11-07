'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createInspectionGrantGate,MAX_GRANT_AGE_MS}=require('./inspection-grant.cjs');
function mockClock(initial=10000){
 let value=initial;
 return {now:()=>value,set:x=>{value=x;}};
}
function makeGate(){
 const clock=mockClock(),calls=[];
 const gate=createInspectionGrantGate({
  now:clock.now,
  inspect:async(root,game)=>{
   calls.push({root,game});
   return {status:'ok',game,mode:'read-only'};
  }
 });
 return {gate,clock,calls};
}
test('a selected directory grants a single read-only inspection for its owner',async()=>{
 const {gate,calls}=makeGate(),root=path.resolve(os.tmpdir(),'chosen-fixture');
 const token=gate.issue(root,'omsi',10);
 assert.equal(token.operationsEnabled,false);
 assert.equal(Object.isFrozen(token),true);
 const report=await gate.inspectOnce(token,10,'omsi');
 assert.equal(report.status,'ok');
 assert.equal(report.mode,'read-only');
 assert.deepEqual(calls,[{root,game:'omsi'}]);
 await assert.rejects(gate.inspectOnce(token,10,'omsi'),/Autorização/);
});
test('cancelled native dialog cannot issue an empty-directory grant',()=>{
 const {gate}=makeGate();
 for(const x of ['',null,undefined,{},[],42])
  assert.throws(()=>gate.issue(x,'omsi',1),/Autorização/);
});
test('a relative renderer pathname cannot manufacture consent',()=>{
 const {gate}=makeGate();
 for(const x of ['mod','../Games','./subfolder',''])
  assert.throws(()=>gate.issue(x,'ets2',1),/Autorização/);
});
test('game identifier must be one of the three known games',()=>{
 const {gate}=makeGate();
 for(const x of ['bad','../omsi','OMSİ','omsi ',null,[],{}])
  assert.throws(()=>gate.issue(path.resolve(os.tmpdir()),x,1),/Jogo inválido/);
});
test('invalid or overflowing owner IDs are refused before receipt issuance',()=>{
 const {gate}=makeGate();
 for(const id of [0,-1,1.1,Number.MAX_SAFE_INTEGER+1,'1',null])
  assert.throws(()=>gate.issue(path.resolve(os.tmpdir()),'ats',id),/Autorização/);
});
test('different webContents owner cannot reuse the grant, including afterward',async()=>{
 const {gate,calls}=makeGate(),t=gate.issue(path.resolve(os.tmpdir()),'omsi',7);
 await assert.rejects(gate.inspectOnce(t,8,'omsi'),/Autorização/);
 await assert.rejects(gate.inspectOnce(t,7,'omsi'),/Autorização/);
 assert.equal(calls.length,0);
});
test('changing game ID revokes grant permanently',async()=>{
 const {gate,calls}=makeGate(),t=gate.issue(path.resolve(os.tmpdir()),'ets2',7);
 await assert.rejects(gate.inspectOnce(t,7,'ats'),/Autorização/);
 await assert.rejects(gate.inspectOnce(t,7,'ets2'),/Autorização/);
 assert.equal(calls.length,0);
});
test('grant expires strictly after 15 seconds without inspecting anything',async()=>{
 const {gate,clock,calls}=makeGate(),t=gate.issue(path.resolve(os.tmpdir()),'omsi',1);
 clock.set(10000+MAX_GRANT_AGE_MS+1);
 await assert.rejects(gate.inspectOnce(t,1,'omsi'),/Autorização/);
 assert.equal(calls.length,0);
 clock.set(10000);
 await assert.rejects(gate.inspectOnce(t,1,'omsi'),/Autorização/);
});
test('grant valid at the expiry boundary but not after it',async()=>{
 const {gate,clock,calls}=makeGate(),t=gate.issue(path.resolve(os.tmpdir()),'ats',2);
 clock.set(10000+MAX_GRANT_AGE_MS);
 assert.equal((await gate.inspectOnce(t,2,'ats')).status,'ok');
 assert.equal(calls.length,1);
});
test('backward or invalid clock revokes the grant conservatively',async()=>{
 const {gate,clock,calls}=makeGate(),t=gate.issue(path.resolve(os.tmpdir()),'omsi',1);
 clock.set(9999);
 await assert.rejects(gate.inspectOnce(t,1,'omsi'),/Autorização/);
 clock.set(10000);
 await assert.rejects(gate.inspectOnce(t,1,'omsi'),/Autorização/);
 assert.equal(calls.length,0);
});
test('explicit revoke prevents a future scan and is idempotent',async()=>{
 const {gate,calls}=makeGate(),t=gate.issue(path.resolve(os.tmpdir()),'ats',1);
 assert.equal(gate.revoke(t),true);
 assert.equal(gate.revoke(t),false);
 await assert.rejects(gate.inspectOnce(t,1,'ats'),/Autorização/);
 assert.equal(calls.length,0);
});
test('fake, cloned and serialized grants cannot become capabilities',async()=>{
 const {gate}=makeGate(),t=gate.issue(path.resolve(os.tmpdir()),'omsi',1);
 const malformed=Object.defineProperty({},'scope',{
  enumerable:true,get(){throw Error('malicious getter');}
 });
 for(const fake of [null,{}, {...t},JSON.parse(JSON.stringify(t)),malformed]){
  await assert.rejects(gate.inspectOnce(fake,1,'omsi'),/Autorização/);
  assert.equal(gate.revoke(fake),false);
 }
 assert.equal((await gate.inspectOnce(t,1,'omsi')).mode,'read-only');
});
test('simultaneous invocations cannot inspect twice with the same grant',async()=>{
 const {gate,calls}=makeGate(),t=gate.issue(path.resolve(os.tmpdir()),'omsi',1);
 const results=await Promise.allSettled([
  gate.inspectOnce(t,1,'omsi'),gate.inspectOnce(t,1,'omsi')
 ]);
 assert.deepEqual(results.map(v=>v.status).sort(),['fulfilled','rejected']);
 assert.equal(calls.length,1);
});
test('inspection failure consumes authorization without a retry window',async()=>{
 let calls=0;
 const gate=createInspectionGrantGate({
  inspect:async()=>{calls++;throw Error('scanner failed');}
 });
 const t=gate.issue(path.resolve(os.tmpdir()),'ets2',1);
 await assert.rejects(gate.inspectOnce(t,1,'ets2'),/scanner failed/);
 await assert.rejects(gate.inspectOnce(t,1,'ets2'),/Autorização/);
 assert.equal(calls,1);
});
test('separate grants remain isolated by owner, game and selected path',async()=>{
 const {gate,calls}=makeGate();
 const a=gate.issue(path.resolve(os.tmpdir(),'first'),'omsi',1);
 const b=gate.issue(path.resolve(os.tmpdir(),'second'),'ats',2);
 assert.equal((await gate.inspectOnce(a,1,'omsi')).status,'ok');
 assert.equal((await gate.inspectOnce(b,2,'ats')).status,'ok');
 assert.equal(calls.length,2);
 assert.notEqual(calls[0].root,calls[1].root);
});
test('native selected directory scope drives real read-only structure scanner',async(t)=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-grant-real-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.mkdir(path.join(root,'Vehicles'));
 await fs.writeFile(path.join(root,'Vehicles','example.bus'),'SHOULD-NOT-BE-OPENED');
 const gate=createInspectionGrantGate(),token=gate.issue(root,'omsi',11);
 const result=await gate.inspectOnce(token,11,'omsi');
 assert.equal(result.status,'ok');
 assert.equal(result.groups[0].found,true);
 assert.equal(result.groups[0].files,1);
 assert.equal(result.mode,'read-only');
 assert.equal(JSON.stringify(result).includes(root),false);
 assert.equal(await fs.readFile(path.join(root,'Vehicles','example.bus'),'utf8'),
  'SHOULD-NOT-BE-OPENED');
});
test('untrusted long paths, NUL bytes and non-string lookalikes are rejected',()=>{
 const {gate}=makeGate();
 const unusual=[
  path.resolve(os.tmpdir(),'a'.repeat(32768)),
  path.resolve(os.tmpdir(),'bad')+'\0'+'suffix',
  new String(path.resolve(os.tmpdir(),'boxed'))
 ];
 for(const name of unusual)
  assert.throws(()=>gate.issue(name,'omsi',1),/Autorização/);
});
test('a grant contains no pathname, owner ID or game identifier',()=>{
 const {gate}=makeGate(),root=path.resolve(os.tmpdir(),'canary-secret');
 const t=gate.issue(root,'omsi',79);
 const serialized=JSON.stringify(t);
 for(const secret of [root,'omsi','79','canary-secret'])
  assert.equal(serialized.includes(secret),false);
});
