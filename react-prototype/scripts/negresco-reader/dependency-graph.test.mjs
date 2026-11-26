import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectFixtureDependencyGraph as inspect,inspectFixtureDependencyGraphWithPolicy as policy} from './dependency-graph.mjs';
const refuse=/^Error: READER_FIXTURE_DEPENDENCY_REFUSED$/;
const file=(path,bytes,cfgKind=null)=>({path,bytes:Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes),cfgKind});
const graph=(roots,files,over={})=>({scope:'synthetic-fixture',roots,files,encoding:'utf-8',limits:{maxBytes:16384,maxEntries:32,maxReferences:64,maxReportBytes:65536,...over}});
const omsi=()=>graph(['bus/a.bus'],[
 file('bus/a.bus','[model]\nmodel/a.cfg\n[sound]\nsound/a.cfg\n[script]\n1\nscript/main.osc\n'),
 file('bus/model/a.cfg','[mesh]\nbody.o3d\n','model'),
 file('bus/sound/a.cfg','[sound]\nengine.wav\n','sound'),
 file('bus/script/main.osc','{frame}'),
 file('bus/sound/engine.wav',Buffer.alloc(1)),
 file('bus/unused.txt','unused')
]);
test('OMSI references traverse vehicle model sound and opaque script leaves',()=>{
 const r=inspect(omsi());
 assert.deepEqual(r.edges.map(e=>[e.role,e.status]),[['model-config','matched'],['sound-config','matched'],['script','matched'],['mesh','missing'],['omsi-audio','matched']]);
 assert.equal(r.nodes.find(n=>n.path==='bus/script/main.osc').status,'indexed-only');
 assert.equal(r.nodes.find(n=>n.path==='bus/sound/engine.wav').status,'invalid-or-unsupported');
 assert.deepEqual(r.unreferencedFiles,['bus/unused.txt']);
 assert.equal(r.allDiscoveredReferencesMatched,false);
});
test('SCS root-relative and relative references traverse multiple formats',()=>{
 const x=graph(['def/a.sii'],[
 file('def/a.sii','SiiNunit {\nunit : .a {\n@include "a.sui"\nsound: "/sound/a.soundref"\n}\n}'),
 file('def/a.sui','value: 1'),
 file('sound/a.soundref','source="a.bank#engine/idle"'),
 file('sound/a.bank',Buffer.from('RIFF\x04\x00\x00\x00FEV ','latin1'))
 ]);
 const r=inspect(x);
 assert.deepEqual(r.edges.map(e=>[e.target,e.status]),[['def/a.sui','matched'],['sound/a.soundref','matched'],['sound/a.bank','matched']]);
 assert.equal(r.edges[1].role,'asset-candidate');assert.equal(r.edges[2].event,'engine/idle');
 assert.equal(r.nodes[3].status,'signature-candidate');assert.equal(r.allDiscoveredReferencesMatched,true);
});
test('strongly connected components identify include cycles and self loops',()=>{
 const x=graph(['a.sui','d.sui'],[
 file('a.sui','@include "b.sui"'),file('b.sui','@include "c.sui"'),file('c.sui','@include "a.sui"'),
 file('d.sui','@include "d.sui"'),file('unused.sui','@include "unused.sui"')
 ]);
 const r=inspect(x);assert.deepEqual(r.cycles,[['a.sui','b.sui','c.sui'],['d.sui']]);
 assert.deepEqual(r.unreferencedFiles,['unused.sui']);assert.ok(Object.isFrozen(r.cycles[0]));
});
test('diamond dependency shares a node without falsely reporting a cycle',()=>{
 const r=inspect(graph(['a.sui'],[
 file('a.sui','@include "b.sui"\n@include "c.sui"'),file('b.sui','@include "d.sui"'),
 file('c.sui','@include "d.sui"'),file('d.sui','value: 1')
 ]));
 assert.equal(r.nodes.length,4);assert.equal(r.edges.length,4);assert.deepEqual(r.cycles,[]);
});
test('CFG kind mismatch is not silently parsed as a different configuration',()=>{
 const x=omsi();x.files[1].cfgKind='sound';const r=inspect(x);
 assert.equal(r.edges[0].status,'kind-mismatch');assert.equal(r.issues[0].code,'CFG_KIND_MISMATCH');
 assert.ok(r.unreferencedFiles.includes('bus/model/a.cfg'));
});
test('case mismatch and missing references stay separate',()=>{
 const x=omsi();x.files[4].path='bus/sound/Engine.wav';const r=inspect(x);
 assert.equal(r.edges[4].status,'case-mismatch');assert.equal(r.issues.at(-1).available,'bus/sound/Engine.wav');
});
test('malformed reachable source is reported without pretending its dependencies are known',()=>{
 const x=omsi();x.files[2].bytes=Buffer.from('[sound]\n../unsafe.wav');const r=inspect(x);
 assert.equal(r.nodes.find(n=>n.path==='bus/sound/a.cfg').status,'invalid-or-unsupported');
 assert.ok(r.issues.some(i=>i.code==='UNREADABLE_SUBSET'));assert.equal(r.allDependenciesKnown,false);
});
test('PMD MAT TOBJ cross-format references share a graph',()=>{
 const path=Buffer.from('a.mat\0'),pmd=Buffer.alloc(76+path.length);
 for(const [o,v] of [[0,4],[4,1],[8,1],[32,path.length],[36,64],[40,72],[44,72],[48,72],[52,72],[56,72],[60,76],[72,76]])pmd.writeUInt32LE(v,o);path.copy(pmd,76);
 const name=Buffer.from('a.dds'),tobj=Buffer.alloc(48+name.length);tobj.writeUInt32LE(1890650625);tobj[24]=2;tobj.writeUInt32LE(name.length,40);name.copy(tobj,48);
 const r=inspect(graph(['v/a.pmd'],[file('v/a.pmd',pmd),file('v/a.mat','material : "eut2.dif" {\ntexture[0]: "a.tobj"\n}'),file('v/a.tobj',tobj),file('v/a.dds',Buffer.alloc(0))]));
 assert.deepEqual(r.edges.map(e=>e.target),['v/a.mat','v/a.tobj','v/a.dds']);assert.equal(r.nodes[3].status,'invalid-or-unsupported');
});
test('limits, invalid roots, duplicate paths and real scope refused',()=>{
 for(const over of [{maxBytes:1},{maxEntries:2},{maxReferences:1},{maxReportBytes:16}]){const x=omsi();Object.assign(x.limits,over);assert.throws(()=>inspect(x),refuse);}
 const x=omsi();for(const roots of [[],['missing.bus'],['bus/a.bus','bus/a.bus']])assert.throws(()=>inspect({...x,roots}),refuse);
 for(const f of [file('bus/a.bus','x'),file('bus/A.bus','x'),file('../x.txt','x'),file('x.cfg','x')])assert.throws(()=>inspect({...x,files:[...x.files,f]}),refuse);
 assert.throws(()=>inspect({...x,scope:'real-mod'}),refuse);
});
test('source digest binds classification, bytes and root set; output frozen',()=>{
 const x=omsi(),r=inspect(x);assert.deepEqual(inspect({...x,files:[...x.files].reverse()}),r);
 x.files[5].bytes[0]=65;assert.notEqual(inspect(x).digest,r.digest);
 for(const v of [r,r.roots,r.sources,r.sources[0],r.nodes,r.nodes[0],r.edges,r.edges[0],r.issues,r.cycles,r.unreferencedFiles])assert.ok(Object.isFrozen(v));
 for(const k of ['allDependenciesKnown','realDependenciesResolved','includesExpanded','scriptsExecuted','realSecurityGateVerified','realReadsPerformed','operationsEnabled'])assert.equal(r[k],false);
});

function dds(){
 const b=Buffer.alloc(136);b.write('DDS ');
 for(const [o,v] of [[4,124],[8,0x81007],[12,4],[16,4],[20,8],[28,1],[76,32],[80,4],[108,0x1000]])b.writeUInt32LE(v,o);
 b.write('DXT1',84);return b;
}
function wav(){
 const b=Buffer.alloc(46);b.write('RIFF');b.writeUInt32LE(38,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(88200,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(2,40);return b;
}
function o3d(){
 const n=Buffer.from('body.dds');
 return Buffer.concat([Buffer.from([0x84,0x19,1,0x17,1,0]),Buffer.alloc(32),Buffer.from([0x49,0,0,0x26,1,0]),Buffer.alloc(44),Buffer.from([n.length]),n,Buffer.from([0x79]),Buffer.alloc(64)]);
}
const visual=()=>graph(['v/body.o3d'],[file('v/body.o3d',o3d()),file('v/texture/body.dds',dds())]);
test('reachable valid WAV gets bounded payload metadata and source evidence',()=>{
 const x=omsi();x.files[4].bytes=wav();const r=inspect(x),n=r.nodes.find(n=>n.path==='bus/sound/engine.wav');
 assert.equal(n.status,'parsed-subset');assert.equal(n.detail.codec,'pcm-integer');assert.equal(n.detail.sampleRate,44100);
 assert.equal(r.counts.indexedOnly,1);assert.equal(r.counts.unreadable,0);assert.ok(Object.isFrozen(n.detail)&&Object.isFrozen(r.counts));
});
test('texture candidate search remains unresolved absent explicit policy',()=>{
 const r=inspect(visual());assert.equal(r.edges[0].status,'search-policy-unresolved');assert.equal(r.edges[0].target,null);
 assert.equal(r.nodes[0].detail.vertexCount,1);assert.deepEqual(r.unreferencedFiles,['v/texture/body.dds']);
});
test('explicit texture root resolves and parses DDS without claiming game lookup',()=>{
 const r=policy({...visual(),textureRoots:['v/texture']});
 assert.equal(r.edges[0].status,'matched');assert.equal(r.nodes[1].detail.width,4);
 assert.equal(r.nodes[1].detail.compression,'DXT1');assert.equal(r.edges[0].semanticDependencyVerified,false);
 assert.equal(r.counts.parsed,2);assert.equal(r.counts.matched,1);
});
test('multiple texture roots report ambiguity without choosing a winner',()=>{
 const x=visual();x.files.push(file('other/body.dds',dds()));
 const r=policy({...x,textureRoots:['v/texture','other']});
 assert.equal(r.edges[0].status,'ambiguous');assert.deepEqual(r.edges[0].candidates,['other/body.dds','v/texture/body.dds']);
 assert.equal(r.nodes.length,1);assert.ok(Object.isFrozen(r.edges[0].candidates));
 assert.deepEqual(policy({...x,textureRoots:['other','v/texture']}),r);
});
test('texture policy differentiates missing and case mismatched candidates',()=>{
 const x=visual();assert.equal(policy({...x,textureRoots:['elsewhere']}).issues[0].code,'MISSING_TEXTURE_CANDIDATE');
 x.files[1].path='v/texture/Body.dds';assert.equal(policy({...x,textureRoots:['v/texture']}).edges[0].status,'case-mismatch');
});
test('texture policy validation and digest bind only explicit portable roots',()=>{
 const x=visual();for(const roots of [['../x'],['/x'],['x','X'],['x/'],Array(17).fill('x')])assert.throws(()=>policy({...x,textureRoots:roots}),refuse);
 assert.notEqual(policy({...x,textureRoots:['v/texture']}).digest,inspect(x).digest);
 assert.deepEqual(policy({...x,textureRoots:[]}),inspect(x));
});
test('PMG and PMC invalid reachable payloads are not treated as validated leaves',()=>{
 const r=inspect(graph(['a.pmg','a.pmc'],[file('a.pmg',Buffer.alloc(112)),file('a.pmc',Buffer.alloc(40))]));
 assert.equal(r.counts.unreadable,2);assert.equal(r.nodes.every(n=>n.status==='invalid-or-unsupported'),true);
});
