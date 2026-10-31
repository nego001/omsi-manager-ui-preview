'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createInspectionExecutor,
 NATIVE_UNAVAILABLE,NATIVE_AUXILIARY}=require('./inspection-executor.cjs');
const {createInspectionGrantGate}=require('./inspection-grant.cjs');
const selected=path.join(os.tmpdir(),'omsi-executor-fixture');
function sample(game='omsi'){
 return {status:'ok',game,mode:'read-only',groups:[{key:'vehicles',found:true,count:1}],
  assessment:{scope:'directory-structure-only',
   compatibilityVerified:false,installationVerified:false}};
}
function nativeEvidence(){
 return {source:'main-process-native-directory-test',
  outcome:'observed-bounded-untrusted',nativeHandleUsed:true,
  operationsEnabled:false};
}
function inspectProbe(){
 const calls=[];
 return {calls,inspect:async(root,game)=>{calls.push({root,game});return sample(game);}};
}
function allDenied(p){
 assert.equal(p.inspectionBackend,'node-directory-metadata');
 assert.equal(p.nativeIdentityAuthorizesOperations,false);
 assert.equal(p.atomicPathContainmentProven,false);
 assert.equal(p.abaRuledOut,false);
 assert.equal(p.gameFilesOpenedForContent,false);
 for(const f of ['canInstall','canUninstall','canRecover','operationsEnabled'])
  assert.equal(p[f],false,f);
 assert.equal(Object.isFrozen(p),true);
}
test('production executor keeps existing read-only scanner with explicit native-unavailable provenance',async()=>{
 const spy=inspectProbe(),executor=createInspectionExecutor({inspect:spy.inspect});
 const report=await executor.inspectSelectedDirectory(selected,'omsi');
 assert.deepEqual(spy.calls,[{root:selected,game:'omsi'}]);
 assert.equal(report.provenance.nativeDirectoryEnumeration,NATIVE_UNAVAILABLE);
 allDenied(report.provenance);
});
test('the default main-process executor scans a real disposable folder without reading file bytes',async(t)=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-executor-real-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.mkdir(path.join(root,'Vehicles'));
 await fs.writeFile(path.join(root,'Vehicles','private.bus'),'DO-NOT-READ');
 const executor=createInspectionExecutor();
 const r=await executor.inspectSelectedDirectory(root,'omsi');
 assert.equal(r.groups[0].files,1);
 assert.equal(r.provenance.nativeDirectoryEnumeration,NATIVE_UNAVAILABLE);
 assert.equal(JSON.stringify(r).includes(root),false);
 allDenied(r.provenance);
 assert.equal(await fs.readFile(path.join(root,'Vehicles','private.bus'),'utf8'),
  'DO-NOT-READ');
});
test('renderer-style relative paths and traversal strings are refused before inspection',async()=>{
 const spy=inspectProbe(),executor=createInspectionExecutor({inspect:spy.inspect});
 for(const name of ['..','./mods','Vehicles','',null,42]){
  await assert.rejects(executor.inspectSelectedDirectory(name,'omsi'));
 }
 assert.equal(spy.calls.length,0);
});
test('invalid game identifiers are refused before any scan',async()=>{
 const spy=inspectProbe(),executor=createInspectionExecutor({inspect:spy.inspect});
 for(const game of ['../omsi','bad',[],null,0]){
  await assert.rejects(executor.inspectSelectedDirectory(selected,game),/Jogo inválido/);
 }
 assert.equal(spy.calls.length,0);
});
test('mandatory native inspection fails closed when no trusted adapter is connected',async()=>{
 const spy=inspectProbe(),executor=createInspectionExecutor({
  inspect:spy.inspect,requireNative:true,platform:'win32'
 });
 await assert.rejects(executor.inspectSelectedDirectory(selected,'omsi'),
  /Verificação nativa indisponível/);
 assert.equal(spy.calls.length,0);
});
test('mandatory native scan is unavailable on Linux even with a test adapter',async()=>{
 const spy=inspectProbe();
 let calls=0;
 const executor=createInspectionExecutor({inspect:spy.inspect,
  requireNative:true,platform:'linux',nativeProbe:async()=>{calls++;return nativeEvidence();}});
 await assert.rejects(executor.inspectSelectedDirectory(selected,'omsi'),/indisponível/);
 assert.equal(calls,0);
 assert.equal(spy.calls.length,0);
});
test('an auxiliary synthetic Win32 witness never grants filesystem authority',async()=>{
 const spy=inspectProbe(),calls=[];
 const executor=createInspectionExecutor({inspect:spy.inspect,
  requireNative:true,platform:'win32',
  nativeProbe:async(root,game)=>{
   calls.push({root,game});
   return nativeEvidence();
  }});
 const result=await executor.inspectSelectedDirectory(selected,'ets2');
 assert.deepEqual(calls,[{root:selected,game:'ets2'}]);
 assert.equal(result.provenance.nativeDirectoryEnumeration,NATIVE_AUXILIARY);
 allDenied(result.provenance);
 assert.equal(result.status,'ok');
});
test('optional native adapter is NEVER invoked without explicit requireNative',async()=>{
 const spy=inspectProbe();
 let nativeCalled=0;
 const executor=createInspectionExecutor({inspect:spy.inspect,
  platform:'win32',nativeProbe:async()=>{nativeCalled++;return nativeEvidence();}});
 const out=await executor.inspectSelectedDirectory(selected,'ats');
 assert.equal(out.provenance.nativeDirectoryEnumeration,NATIVE_UNAVAILABLE);
 assert.equal(nativeCalled,0);
 assert.equal(spy.calls.length,1);
});
test('native adapter exception cannot silently fall back to the Node scan',async()=>{
 const spy=inspectProbe(),executor=createInspectionExecutor({
  inspect:spy.inspect,platform:'win32',requireNative:true,
  nativeProbe:async()=>{throw Error('test backend unavailable');}
 });
 await assert.rejects(executor.inspectSelectedDirectory(selected,'omsi'),/backend unavailable/);
 assert.equal(spy.calls.length,0);
});
test('native adapter must return exactly four plain, trusted-injection fields',async()=>{
 const wrong=[{},null,[],{...nativeEvidence(),extra:'oops'},
  {...nativeEvidence(),operationsEnabled:true},
  {...nativeEvidence(),nativeHandleUsed:false},
  {...nativeEvidence(),outcome:'approved-for-mods'},
  {...nativeEvidence(),source:'renderer'},
  Object.assign(Object.create(null),nativeEvidence())];
 for(const candidate of wrong){
  const spy=inspectProbe();
  const executor=createInspectionExecutor({inspect:spy.inspect,
   platform:'win32',requireNative:true,nativeProbe:async()=>candidate});
  await assert.rejects(executor.inspectSelectedDirectory(selected,'ats'));
  assert.equal(spy.calls.length,0);
 }
});
test('getter-bearing forged native report is refused without executing getters',async()=>{
 const spy=inspectProbe();
 let getterCalls=0;
 const report=nativeEvidence();
 Object.defineProperty(report,'outcome',{get(){getterCalls++;throw Error('getter executed');}});
 const executor=createInspectionExecutor({inspect:spy.inspect,
  platform:'win32',requireNative:true,nativeProbe:async()=>report});
 await assert.rejects(executor.inspectSelectedDirectory(selected,'omsi'),/inválida/);
 assert.equal(getterCalls,0);
 assert.equal(spy.calls.length,0);
});
test('native result with false operation flag is never lifted into permissions',async()=>{
 const executor=createInspectionExecutor({platform:'win32',requireNative:true,
  nativeProbe:async()=>nativeEvidence(),inspect:async()=>sample()});
 const result=await executor.inspectSelectedDirectory(selected,'omsi');
 assert.equal(result.provenance.canInstall,false);
 assert.equal(result.provenance.canRecover,false);
 assert.equal(result.provenance.abaRuledOut,false);
});
test('malformed read-only summary is refused after any auxiliary probe',async()=>{
 const invalid=[
  {status:'ok',game:'omsi',mode:'write',groups:[],assessment:{
   compatibilityVerified:false,installationVerified:false}},
  {...sample(),assessment:{compatibilityVerified:true,installationVerified:false}},
  {...sample(),groups:null},
  {...sample(),game:'ats'},
  null
 ];
 for(const bad of invalid){
  const executor=createInspectionExecutor({inspect:async()=>bad});
  await assert.rejects(executor.inspectSelectedDirectory(selected,'omsi'),/Relatório/);
 }
});
test('node inspector errors propagate without fabricating successful diagnostics',async()=>{
 const executor=createInspectionExecutor({inspect:async()=>{throw Error('directory changed');}});
 await assert.rejects(executor.inspectSelectedDirectory(selected,'omsi'),/directory changed/);
});
test('grant consumes selected-folder authority before reaching the executor',async()=>{
 const spy=inspectProbe(),executor=createInspectionExecutor({inspect:spy.inspect});
 let now=1000;
 const gate=createInspectionGrantGate({now:()=>now,
  inspect:executor.inspectSelectedDirectory});
 const ticket=gate.issue(selected,'omsi',52);
 const a=await gate.inspectOnce(ticket,52,'omsi');
 assert.equal(a.provenance.nativeDirectoryEnumeration,NATIVE_UNAVAILABLE);
 await assert.rejects(gate.inspectOnce(ticket,52,'omsi'),/Autorização/);
 assert.equal(spy.calls.length,1);
});
test('wrong owner or game consumes grant without executing the native backend',async()=>{
 const spy=inspectProbe();let touched=0;
 const executor=createInspectionExecutor({inspect:spy.inspect,
  requireNative:true,platform:'win32',nativeProbe:async()=>{
   touched++;return nativeEvidence();
  }});
 const gate=createInspectionGrantGate({inspect:executor.inspectSelectedDirectory});
 const first=gate.issue(selected,'omsi',1);
 const second=gate.issue(selected,'ets2',2);
 await assert.rejects(gate.inspectOnce(first,2,'omsi'),/Autorização/);
 await assert.rejects(gate.inspectOnce(second,2,'omsi'),/Autorização/);
 assert.equal(touched,0);
 assert.equal(spy.calls.length,0);
});
test('a failing native witness consumes the grant, prevents a retry and exposes no path',async()=>{
 const spy=inspectProbe(),executor=createInspectionExecutor({inspect:spy.inspect,
  platform:'win32',requireNative:true,nativeProbe:async()=>{throw Error('private internal');}});
 const gate=createInspectionGrantGate({inspect:executor.inspectSelectedDirectory});
 const ticket=gate.issue(selected,'omsi',1);
 await assert.rejects(gate.inspectOnce(ticket,1,'omsi'),/private internal/);
 await assert.rejects(gate.inspectOnce(ticket,1,'omsi'),/Autorização/);
 assert.equal(spy.calls.length,0);
});
test('optional diagnostics are path-free, even when adapter supplies a custom path',async()=>{
 const executor=createInspectionExecutor({inspect:async()=>sample(),
  platform:'win32',requireNative:true,nativeProbe:async()=>nativeEvidence()});
 const out=await executor.inspectSelectedDirectory(selected,'omsi');
 const serialized=JSON.stringify(out);
 for(const s of [selected,'\\?\\C:','\.\\mods'])
  assert.equal(serialized.includes(s),false);
 allDenied(out.provenance);
});
test('NUL or oversized pathnames are refused even if the scan stub accepts them',async()=>{
 const spy=inspectProbe(),executor=createInspectionExecutor({inspect:spy.inspect});
 for(const name of [selected+'\0suffix',path.join(os.tmpdir(),'a'.repeat(32800))]){
  await assert.rejects(executor.inspectSelectedDirectory(name,'omsi'));
 }
 assert.equal(spy.calls.length,0);
});
test('executor rejects bogus option types rather than activating native accidentally',()=>{
 for(const options of [{nativeProbe:1},{inspect:'scan'},{requireNative:'yes'},{platform:42}])
  assert.throws(()=>createInspectionExecutor(options),/inválida/);
});
