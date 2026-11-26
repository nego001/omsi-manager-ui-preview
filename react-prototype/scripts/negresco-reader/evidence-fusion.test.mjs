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
 assert.deepEqual(r.findings.map(d=>d.code).sort(),['BANK_SIGNATURE_ONLY','FMOD_EVENT_UNVERIFIED','INDEXED_ONLY']);assert.equal(r.summary.unknown,3);
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

function pmd({pieces=1,materials=1,looks=1}={}){
 const name=Buffer.from('a.mat\0'),off=64+looks*8,dat=off+looks*materials*4,b=Buffer.alloc(dat+(looks*materials?name.length:0));
 for(const [o,v] of [[0,4],[4,materials],[8,looks],[12,pieces],[32,looks*materials?name.length:0],[36,64],[40,off],[44,off],[48,off],[52,off],[56,off],[60,dat]])b.writeUInt32LE(v,o);
 if(looks*materials){for(let j=0;j<looks*materials;j++)b.writeUInt32LE(dat,off+j*4);name.copy(b,dat);}return b;
}
function pmg(material=0){
 const b=Buffer.alloc(224);b[0]=0x15;b.write('gmP',1);b.writeInt32LE(1,4);
 for(const [o,v] of [[72,112],[76,112],[80,112],[84,112],[88,212],[96,212],[100,12],[104,224]])b.writeInt32LE(v,o);
 for(const [o,v] of [[4,1],[16,material],[60,-1],[64,212],[68,-1],[72,-1],[76,-1],[80,-1],[84,-1],[88,224],[92,-1],[96,-1]])b.writeInt32LE(v,112+o);
 return b;
}
function tobj(filter=1){
 const p=Buffer.from('a.dds'),b=Buffer.alloc(48+p.length);b.writeUInt32LE(1890650625);b[24]=2;b[28]=filter;b.writeUInt32LE(p.length,40);p.copy(b,48);return b;
}
function dds(){
 const b=Buffer.alloc(136);b.write('DDS ');
 for(const [o,v] of [[4,124],[8,0x81007],[12,4],[16,4],[20,8],[28,1],[76,32],[80,4],[108,0x1000]])b.writeUInt32LE(v,o);
 b.write('DXT1',84);return b;
}
const mat=f('v/a.mat','material : "eut2.dif" {\ntexture[0]: "a.tobj"\n}');
test('PMX matched same-stem candidates expose count and slot inconsistencies with both hashes',()=>{
 const r=inspect(input(['v/a.pmd','v/a.pmg'],[f('v/a.pmd',pmd({pieces:2})),f('v/a.pmg',pmg(2)),mat,f('v/a.tobj',tobj(2)),f('v/a.dds',dds())]));
 const a=r.findings.find(d=>d.code==='PMX_PIECE_COUNT_MISMATCH'),b=r.findings.find(d=>d.code==='PMX_MATERIAL_SLOT_OUT_OF_RANGE');
 assert.deepEqual(a.detail,{descriptor:2,geometry:1});assert.deepEqual(b.detail,{maxMaterialIndex:2,materialCount:1});
 assert.deepEqual(a.origins.map(s=>s.path),['v/a.pmd','v/a.pmg']);assert.deepEqual(a.affectedFixtureRoots,['v/a.pmd','v/a.pmg']);
 assert.equal(a.severity,'warning');assert.equal(a.runtimeImpactVerified,false);
});
test('same-stem matching never invents a dependency or compares unreached files',()=>{
 const x=input(['v/a.pmd'],[f('v/a.pmd',pmd({pieces:2})),f('v/a.pmg',pmg(2)),mat,f('v/a.tobj',tobj(2)),f('v/a.dds',dds())]);
 const r=inspect(x);assert.equal(r.findings.some(d=>d.code.startsWith('PMX_')),false);
 const y=inspect({...x,roots:['v/a.pmd','v/a.pmg']});assert.equal(y.findings.some(d=>d.code==='PMX_PIECE_COUNT_MISMATCH'),true);
});
test('consistent PMX pair has no PMX mismatch findings',()=>{
 const r=inspect(input(['v/a.pmd','v/a.pmg'],[f('v/a.pmd',pmd()),f('v/a.pmg',pmg()),mat,f('v/a.tobj',tobj(2)),f('v/a.dds',dds())]));
 assert.equal(r.findings.some(d=>d.code.startsWith('PMX_')),false);assert.equal(r.summary.errors,0);
});
test('TOBJ explicit mip filter on a single-level DDS produces cross-reader advisory',()=>{
 const r=inspect(input(['v/a.tobj'],[f('v/a.tobj',tobj()),f('v/a.dds',dds())]));
 const d=r.findings.find(d=>d.code==='MIP_FILTER_WITH_SINGLE_LEVEL');
 assert.deepEqual(d.detail,{mipFilter:1,mipmapCount:1});assert.equal(d.severity,'warning');
 assert.deepEqual(d.origins.map(o=>o.path),['v/a.dds','v/a.tobj']);assert.deepEqual(d.edgeIndices,[0]);
});
test('no mip filter advisory for disabled filter or unreadable texture',()=>{
 for(const files of [[f('v/a.tobj',tobj(2)),f('v/a.dds',dds())],[f('v/a.tobj',tobj()),f('v/a.dds',Buffer.alloc(1))]]){
  const r=inspect(input(['v/a.tobj'],files));assert.equal(r.findings.some(d=>d.code==='MIP_FILTER_WITH_SINGLE_LEVEL'),false);
 }
});
test('case mismatch preserves actual candidate hash even if candidate not traversed',()=>{
 const r=inspect(input(['a.sui'],[f('a.sui','@include "B.sui"'),f('b.sui','value: 1')]));
 assert.deepEqual(r.findings[0].origins.map(o=>o.path),['a.sui','b.sui']);assert.deepEqual(r.findings[0].affectedFixtureRoots,['a.sui']);
});
