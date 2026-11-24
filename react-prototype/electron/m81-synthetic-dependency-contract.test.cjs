'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectSyntheticDependencies:inspect}=require('../scripts/m81-synthetic-dependency-contract.cjs');
const e=(name,text='')=>({name,text});
test('synthetic bus to model to mesh graph resolves exact names only',()=>{
 const r=inspect([e('bus.bus','[model]\r\nmodel\\bus.cfg'),e('model/bus.cfg','[mesh]\nmesh/body.o3d'),e('mesh/body.o3d')]);
 assert.equal(r.modelReferences,1);assert.equal(r.meshReferences,1);
 assert.equal(r.exactMatches,2);assert.equal(r.absentFromFixture,0);
 assert.equal(r.realFilesInspected,false);assert.equal(r.compatibilityVerified,false);assert.equal(r.operationsEnabled,false);
 assert.equal(JSON.stringify(r).includes('body.o3d'),false);
});
test('absent fixture references and case-only candidates are distinct',()=>{
 const r=inspect([e('bus.bus','[model]\nmodel.cfg\n[model]\nmissing.cfg'),e('Model.cfg','[mesh]\nnot-read.o3d')]);
 assert.equal(r.modelReferences,2);assert.equal(r.caseOnlyMatches,1);assert.equal(r.absentFromFixture,1);assert.equal(r.meshReferences,0);
});
test('case collisions are ambiguous even with an exact spelling',()=>{
 const r=inspect([e('a.bus','[model]\na.cfg'),e('a.cfg','[mesh]\na.o3d'),e('A.cfg')]);
 assert.equal(r.ambiguousMatches,1);assert.equal(r.exactMatches,0);assert.equal(r.meshReferences,0);
});
test('rejects traversal, absolute paths, URLs, wrong suffixes and missing operands without echo',()=>{
 const r=inspect([e('a.bus','[model]\n../private.cfg\n[model]\nC:\\private.cfg\n[model]\n/secret.cfg\n[model]\nhttps://host/a.cfg\n[model]\na.zip\n[model]')]);
 assert.equal(r.malformed,6);assert.equal(r.modelReferences,0);assert.equal(JSON.stringify(r).includes('private'),false);
});
test('unreferenced cfg is not parsed, shared linked cfg counted once',()=>{
 const r=inspect([e('a.bus','[model]\na.cfg'),e('b.bus','[model]\na.cfg'),e('a.cfg','[mesh]\na.o3d'),e('unused.cfg','[mesh]\nmissing.o3d'),e('a.o3d')]);
 assert.equal(r.modelReferences,2);assert.equal(r.meshReferences,1);assert.equal(r.exactMatches,3);
});
test('bounds reject oversized fixtures, duplicate paths and reference floods',()=>{
 for(const entries of [[e('a.bus','x'.repeat(65537))],[e('a.bus'),e('a.bus')],[e('../a.bus')],Array.from({length:129},(_,i)=>e(i+'.bus')),[e('a.bus','[model]\na.cfg\n'.repeat(257))]])
  assert.throws(()=>inspect(entries),/Synthetic/);
});
