'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {projectInspectionReport:project}=require('./inspection-report-projection.cjs');
const {createInspectionExecutor}=require('./inspection-executor.cjs');
const path=require('node:path');
const os=require('node:os');
const selected=path.join(os.tmpdir(),'omsi-m62-synthetic-only');
function source(game='omsi'){
 const group=game==='omsi'?'vehicles':'mods';
 return {status:'ok',game,mode:'read-only',folderName:'Synthetic-Only',
  recognized:true,groups:[{key:group,name:'Injected Name',found:true,count:1,
   files:1,packageCandidates:game==='omsi'?0:1}],
  notices:[{code:'evil',level:'attention',message:'fake-private-message'}],
  assessment:{scope:'directory-structure-only',compatibilityVerified:false,
   installationVerified:false,summary:'fake-private-summary'},
  limited:false,selectionMode:'parent-folder'};
}
test('drops unexpected properties at every depth while generating fixed labels and notices',async()=>{
 const secret='PRIVATE-SYNTHETIC-ABSOLUTE-PATH';
 const report=source('ets2');
 report.hidden=secret;
 report.groups[0].leakedPath=secret;
 report.assessment.internalError=secret;
 report.notices.push({message:secret,code:secret});
 const out=project(report,'ets2');
 assert.ok(!JSON.stringify(out).includes(secret));
 assert.ok(!JSON.stringify(out).includes('fake-private-message'));
 assert.ok(!JSON.stringify(out).includes('fake-private-summary'));
 assert.equal(out.groups[0].name,'Pasta de mods');
 assert.equal(out.status,'ok');
 assert.equal(out.mode,'read-only');
 assert.equal(out.assessment.installationVerified,false);
});
test('unknown scanner fields with explosive getters are never accessed',()=>{
 const report=source();
 let reads=0;
 Object.defineProperty(report,'secret',{get(){reads++;throw Error('PRIVATE');}});
 Object.defineProperty(report.assessment,'internalPath',{get(){reads++;throw Error('PRIVATE');}});
 Object.defineProperty(report.groups[0],'systemPath',{get(){reads++;throw Error('PRIVATE');}});
 const out=project(report,'omsi');
 assert.equal(reads,0);
 assert.equal(out.groups[0].key,'vehicles');
});
test('known accessor fields are refused without executing any getter',()=>{
 for(const [object,key] of [['top','groups'],['assessment','scope'],['group','count']]){
  const report=source();
  let reads=0;
  const target=object==='top'?report:object==='assessment'?report.assessment:report.groups[0];
  Object.defineProperty(target,key,{configurable:true,get(){reads++;throw Error('PRIVATE');}});
  assert.throws(()=>project(report,'omsi'),/Relatório de inspeção inválido/);
  assert.equal(reads,0);
 }
});
test('counter overflows, unsafe claims and forged folder names fail closed',()=>{
 for(const mutate of [
  r=>{r.groups[0].count=2001;},
  r=>{r.groups[0].files=2001;},
  r=>{r.groups[0].packageCandidates=2;},
  r=>{r.groups[0].found='true';},
  r=>{r.assessment.compatibilityVerified=true;},
  r=>{r.mode='write';},
  r=>{r.folderName='C:\\private\\secret';},
  r=>{r.folderName='hidden\nprivate';},
  r=>{r.groups[0].key='../../../private';},
  r=>{r.recognized=false;}
 ]){
  const report=source();
  mutate(report);
  assert.throws(()=>project(report,'omsi'),/Relatório de inspeção inválido/);
 }
});
test('one-shot executor returns DTO and fixed read-only provenance, not scanner objects',async()=>{
 const report=source('omsi');
 report.secret='PRIVATE-SYNTHETIC-SCAN-SOURCE';
 const executor=createInspectionExecutor({inspect:async()=>report});
 const out=await executor.inspectSelectedDirectory(selected,'omsi');
 assert.ok(!JSON.stringify(out).includes(report.secret));
 assert.equal(out.provenance.canInstall,false);
 assert.equal(out.provenance.canUninstall,false);
 assert.equal(out.provenance.atomicPathContainmentProven,false);
});
test('real group and notice schemas retain UI-facing fixed fields',()=>{
 const report=source('ats');
 report.groups[0].limited=true;
 report.limited=true;
 const out=project(report,'ats');
 assert.equal(out.groups[0].packageCandidates,1);
 assert.equal(out.groups[0].name,'Pasta de mods');
 assert.ok(out.notices.some(n=>n.code==='partial-count'));
 assert.ok(out.notices.some(n=>n.code==='mods-not-verified'));
 assert.equal(out.assessment.compatibilityVerified,false);
});
