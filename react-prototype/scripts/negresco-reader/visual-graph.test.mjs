import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectFixtureVisualGraph as inspect} from './visual-graph.mjs';
const refuse=/^Error: READER_FIXTURE_VISUAL_REFUSED$/;
function pmd(path='body.mat'){
 const data=Buffer.from(path+'\0'),b=Buffer.alloc(76+data.length);
 for(const [o,v] of [[0,4],[4,1],[8,1],[12,1],[32,data.length],[36,64],[40,72],[44,72],[48,72],[52,72],[56,72],[60,76],[72,76]])b.writeUInt32LE(v,o);
 data.copy(b,76);return b;
}
const mat=(p='/vehicle/body.tobj')=>Buffer.from('material : "eut2.dif" {\ntexture[0]: "'+p+'"\n}');
function tobj(path='body.dds',filter=2){
 const p=Buffer.from(path),b=Buffer.alloc(48+p.length);b.writeUInt32LE(1890650625);b[24]=2;b[26]=1;b[27]=1;b[28]=filter;b.writeUInt32LE(p.length,40);p.copy(b,48);return b;
}
function dds(){
 const b=Buffer.alloc(136);b.write('DDS ');
 for(const [o,v] of [[4,124],[8,0x81007],[12,4],[16,4],[20,8],[28,1],[76,32],[80,4],[108,0x1000]])b.writeUInt32LE(v,o);
 b.write('DXT1',84);return b;
}
const file=(path,bytes)=>({path,bytes});
const input=()=>({scope:'synthetic-fixture',root:'vehicle/body.pmd',files:[
 file('vehicle/body.pmd',pmd()),file('vehicle/body.mat',mat()),file('vehicle/body.tobj',tobj()),file('vehicle/body.dds',dds())],
 limits:{maxBytes:8192,maxEntries:16,maxReferences:20,maxReportBytes:32768}});
test('relative and virtual references connect the complete synthetic visual chain',()=>{
 const r=inspect(input());assert.equal(r.nodes.length,4);assert.equal(r.edges.length,3);
 assert.deepEqual(r.edges.map(e=>e.target),['vehicle/body.mat','vehicle/body.tobj','vehicle/body.dds']);
 assert.ok(r.allReferencesMatched&&r.allReachableParsed);assert.equal(r.issues.length,0);
 assert.equal(r.nodes[3].width,4);
});
test('missing target is reported without opening any path',()=>{
 const x=input();x.files.pop();const r=inspect(x);
 assert.equal(r.allReferencesMatched,false);assert.equal(r.issues[0].code,'MISSING_REFERENCE');assert.equal(r.edges[2].status,'missing');
});
test('case mismatch is reported and never silently resolved',()=>{
 const x=input();x.files[3].path='vehicle/Body.dds';const r=inspect(x);
 assert.equal(r.edges[2].status,'case-mismatch');assert.equal(r.issues[0].available,'vehicle/Body.dds');assert.equal(r.nodes.length,3);
});
test('matched paths do not imply valid payloads',()=>{
 const x=input();x.files[3].bytes=Buffer.alloc(136);const r=inspect(x);
 assert.equal(r.allReferencesMatched,true);assert.equal(r.allReachableParsed,false);
 assert.equal(r.nodes[3].status,'invalid-or-unsupported');assert.equal(r.issues[0].code,'UNREADABLE_SUBSET');
});
test('single mip level with requested mip filter is reported as advisory',()=>{
 const x=input();x.files[2].bytes=tobj('body.dds',1);const r=inspect(x);
 assert.equal(r.issues[0].code,'MIP_FILTER_WITH_SINGLE_LEVEL');assert.equal(r.allReachableParsed,true);
});
test('unreachable files are indexed but not parsed',()=>{
 const x=input();x.files.push(file('vehicle/unused.mat',Buffer.from('unsupported')));
 const r=inspect(x);assert.deepEqual(r.unreferencedFiles,['vehicle/unused.mat']);assert.equal(r.issues.length,0);assert.equal(r.sources.length,5);
});
test('duplicate, case-colliding, traversal and invalid input paths refused',()=>{
 for(const f of [file('vehicle/body.mat',mat()),file('vehicle/Body.mat',mat()),file('../a.mat',mat()),file('a.exe',Buffer.alloc(0))]){
  const x=input();x.files.push(f);assert.throws(()=>inspect(x),refuse);
 }
 for(const root of ['vehicle/absent.pmd','vehicle/body.mat'])assert.throws(()=>inspect({...input(),root}),refuse);
});
test('byte, entry, reference and serialized report budgets enforced',()=>{
 for(const over of [{maxBytes:10},{maxEntries:3},{maxReferences:2},{maxReportBytes:100}]){
  const x=input();Object.assign(x.limits,over);assert.throws(()=>inspect(x),refuse);
 }
});
test('input scope, extra evidence and sparse or accessor arrays refused',()=>{
 const x=input();assert.throws(()=>inspect({...x,scope:'real-mod'}),refuse);
 x.files[0].report={valid:true};assert.throws(()=>inspect(x),refuse);
 const y=input();delete y.files[0];assert.throws(()=>inspect(y),refuse);
 const z=input();let invoked=false;Object.defineProperty(z.files,'0',{get(){invoked=true;return file('vehicle/body.pmd',pmd())}});assert.throws(()=>inspect(z),refuse);assert.equal(invoked,false);
});
test('digest is deterministic across input ordering and binds all supplied bytes',()=>{
 const x=input(),r=inspect(x);x.files.reverse();assert.deepEqual(inspect(x),r);
 x.files[0].bytes[130]=1;assert.notEqual(inspect(x).digest,r.digest);
 for(const o of [r,r.nodes,r.nodes[0],r.edges,r.edges[0],r.sources,r.sources[0],r.issues,r.unreferencedFiles])assert.ok(Object.isFrozen(o));
 for(const k of ['fullVisualSupport','realDependenciesResolved','pixelsDecoded','shaderExecuted','realSecurityGateVerified','realReadsPerformed','operationsEnabled'])assert.equal(r[k],false);
});
