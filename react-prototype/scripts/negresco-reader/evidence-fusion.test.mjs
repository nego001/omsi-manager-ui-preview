import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectFixtureEvidenceFusion as inspect} from './evidence-fusion.mjs';
const refuse=/^Error: READER_FIXTURE_FUSION_REFUSED$/;
const f=(path,bytes,cfgKind=null)=>({path,bytes:Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes),cfgKind});
const input=(roots,files,over={})=>({scope:'synthetic-fixture',roots,files,encoding:'utf-8',textureRoots:[],limits:{maxBytes:16384,maxEntries:32,maxReferences:64,maxGraphBytes:65536,maxFindings:64,maxReportBytes:65536,...over}});
test('missing reference creates fixture error with actual source hash, never a fabricated missing target hash',()=>{
 const a=f('a.sui','@include "missing.sui"'),r=inspect(input(['a.sui'],[a]));
 assert.equal(r.summary.fixtureStatus,'fixture-reference-errors');assert.equal(r.summary.errors,1);
 const d=r.findings[0];assert.equal(d.code,'MISSING_REFERENCE');assert.deepEqual(d.origins,[{path:'a.sui',sha256:createHash('sha256').update(a.bytes).digest('hex')}]);
 assert.equal(d.detail.target,'missing.sui');assert.deepEqual(d.affectedFixtureRoots,['a.sui']);assert.deepEqual(d.edgeIndices,[0]);
});
test('duplicate references aggregate without losing individual edge positions',()=>{
 const r=inspect(input(['a.sui'],[f('a.sui','@include "x.sui"\n@include "x.sui"')]));
 assert.equal(r.findings.length,1);assert.equal(r.findings[0].occurrences,2);assert.deepEqual(r.findings[0].edgeIndices,[0,1]);
});
test('multi-root shared failure is attributed to both roots without runtime impact claim',()=>{
 const r=inspect(input(['b.sui','a.sui'],[f('a.sui','@include "shared.sui"'),f('b.sui','@include "shared.sui"'),f('shared.sui','@include "x.sui"')]));
 assert.deepEqual(r.findings[0].affectedFixtureRoots,['a.sui','b.sui']);assert.equal(r.findings[0].runtimeImpactVerified,false);
});
test('matched unreadable source is unknown, not declared corrupt',()=>{
 const r=inspect(input(['a.sui'],[f('a.sui','@include "b.sui"'),f('b.sui','{')]));
 assert.equal(r.summary.errors,0);assert.equal(r.summary.unknown,2);
 assert.deepEqual(r.findings.map(d=>d.code).sort(),['MATCHED_UNREADABLE_TARGET','UNREADABLE_SUBSET']);
 assert.equal(r.summary.fixtureStatus,'fixture-evidence-incomplete');
});
test('case mismatch is a warning and candidate cycles are distinct',()=>{
 const r=inspect(input(['a.sui'],[f('a.sui','@include "a.sui"\n@include "B.sui"'),f('b.sui','value: 1')]));
 assert.equal(r.summary.warnings,2);assert.deepEqual(r.findings.map(d=>d.code).sort(),['CANDIDATE_CYCLE','CASE_MISMATCH']);
 assert.equal(r.summary.fixtureStatus,'fixture-review-required');
});
test('indexed scripts and bank signatures do not masquerade as complete verification',()=>{
 const bank=Buffer.from('RIFF\x04\x00\x00\x00FEV ','latin1');
 const r=inspect(input(['a.bus','a.soundref'],[f('a.bus','[script]\n1\nmain.osc'),f('main.osc','{frame}'),f('a.soundref','source="a.bank#engine/idle"'),f('a.bank',bank)]));
 assert.deepEqual(r.findings.map(d=>d.code).sort(),['BANK_SIGNATURE_ONLY','INDEXED_ONLY']);assert.equal(r.summary.unknown,2);
});
test('clean reachable fixture does not assert compatibility or completeness',()=>{
 const r=inspect(input(['a.sui'],[f('a.sui','value: 1'),f('unused.txt','x')]));
 assert.equal(r.summary.fixtureStatus,'no-discovered-findings');assert.equal(r.summary.unreachedCount,1);
 for(const k of ['fullAnalysisComplete','gameCompatibilityVerified','runtimeImpactVerified','realSecurityGateVerified','realReadsPerformed','operationsEnabled'])assert.equal(r[k],false);
});
test('fusion digest deterministic, binds all supplied bytes and graph policy',()=>{
 const x=input(['b.sui','a.sui'],[f('a.sui','value: 1'),f('b.sui','@include "x.sui"')]),r=inspect(x);
 assert.deepEqual(inspect({...x,roots:[...x.roots].reverse(),files:[...x.files].reverse()}),r);
 assert.notEqual(inspect({...x,textureRoots:['tex']}).evidenceDigest,r.evidenceDigest);
 x.files[0].bytes[0]=65;assert.notEqual(inspect(x).evidenceDigest,r.evidenceDigest);
 const {evidenceDigest,...body}=r;assert.equal(evidenceDigest,createHash('sha256').update(JSON.stringify(body)).digest('hex'));
});
test('findings, graph and report budgets are independent and enforced',()=>{
 for(const over of [{maxFindings:0},{maxGraphBytes:1},{maxReportBytes:1},{maxReferences:0}])assert.throws(()=>inspect(input(['a.sui'],[f('a.sui','@include "x.sui"')],over)),refuse);
});
test('untrusted precomputed evidence, real scope and accessors rejected; results immutable',()=>{
 const x=input(['a.sui'],[f('a.sui','@include "x.sui"')]),r=inspect(x);
 assert.throws(()=>inspect({...x,graph:{valid:true}}),refuse);assert.throws(()=>inspect({...x,scope:'real-mod'}),refuse);
 let called=false;Object.defineProperty(x,'files',{get(){called=true;return []}});assert.throws(()=>inspect(x),refuse);assert.equal(called,false);
 for(const o of [r,r.summary,r.sources,r.sources[0],r.findings,r.findings[0],r.findings[0].origins,r.findings[0].origins[0],r.findings[0].detail,r.findings[0].edgeIndices,r.findings[0].affectedFixtureRoots])assert.ok(Object.isFrozen(o));
});
