'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resolveSyntheticReferences:resolve}=require('../scripts/m81d-virtual-reference-resolution.cjs');
const model=(target,source='bus.bus')=>({kind:'vehicle-definition',keyword:'[model]',source,target});
const mesh=(target,source='model/model.cfg')=>({kind:'vehicle-model',keyword:'[mesh]',source,target});
const run=(files,references,complete=true)=>resolve({files,references,complete});
test('vehicle root and model directory are different bases',()=>{
 const r=run(['bus.bus','model/model.cfg','model/meshes/body.o3d','body.o3d'],
  [model('model\\model.cfg'),mesh('meshes\\body.o3d'),mesh('body.o3d')]);
 assert.deepEqual(r.results,['exact','exact','absent-from-fixture']);
 assert.equal(r.realFilesInspected,false);assert.equal(r.compatibilityVerified,false);
 assert.equal(r.operationsEnabled,false);assert.ok(!JSON.stringify(r).includes('body.o3d'));
});
test('case-only and directory-level collisions are not exact matches',()=>{
 assert.deepEqual(run(['bus.bus','Model/a.cfg'],[model('model/a.cfg')]).results,['case-only']);
 assert.deepEqual(run(['bus.bus','Model/a.cfg','model/b.cfg'],[model('Model/a.cfg')]).results,['ambiguous-case']);
 assert.deepEqual(run(['bus.bus','model/A.cfg','model/a.cfg'],[model('model/a.cfg')]).results,['ambiguous-case']);
});
test('incomplete inventory never treats an unseen name as absent',()=>{
 const files=['bus.bus'];
 assert.deepEqual(run(files,[model('a.cfg')],false).results,['not-observed']);
 assert.deepEqual(run(files,[model('a.cfg')],true).results,['absent-from-fixture']);
 assert.deepEqual(run(files,[mesh('a.o3d')],false).results,['source-unconfirmed']);
});
test('invalid paths never resolve and unsupported keywords are separate',()=>{
 const refs=['../a.cfg','C:\\a.cfg','/a.cfg','\\\\server\\a.cfg','https://host/a.cfg','model//a.cfg','model/./a.cfg','CON.cfg','a.cfg:stream','a.zip','a.cfg ','é.cfg'].map(x=>model(x));
 refs.push({kind:'vehicle-definition',keyword:'[sound]',source:'bus.bus',target:'sound.cfg'});
 const r=run(['bus.bus'],refs);
 assert.equal(r.counts['invalid-reference'],12);assert.equal(r.counts['unsupported-reference'],1);
 assert.equal(r.counts['absent-from-fixture'],undefined);
});
test('source identity and regular virtual file type must be confirmed',()=>{
 const r=run(['bus.bus','model/model.cfg','model/folder.o3d/child.bin','model/block.o3d'],[
  mesh('folder.o3d'),mesh('block.o3d/x.o3d'),mesh('x.o3d','model/MODEL.cfg'),model('model/model.cfg','not.bus')]);
 assert.deepEqual(r.results,['not-file-path','not-file-path','source-unconfirmed','source-unconfirmed']);
});
test('fixture inventory rejects duplicates, path conflicts and resource overflow',()=>{
 for(const files of [['bus.bus','bus.bus'],['a','a/b'],['a/b','a'],['../a'],['a\\b','a/b'],Array.from({length:513},(_,i)=>i+'.cfg')])
  assert.throws(()=>run(files,[]),/M81D_FIXTURE_REFUSED/);
 assert.throws(()=>run(['bus.bus'],Array.from({length:257},()=>model('a.cfg'))),/M81D_FIXTURE_REFUSED/);
});
