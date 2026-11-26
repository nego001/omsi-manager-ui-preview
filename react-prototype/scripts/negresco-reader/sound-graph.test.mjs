import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectFixtureSoundReferences as inspect} from './sound-references.mjs';
import {inspectFixtureSoundGraph as graph} from './sound-graph.mjs';
const refuse=/^Error: READER_FIXTURE_SOUND_REFUSED$/,refuseGraph=/^Error: READER_FIXTURE_SOUND_GRAPH_REFUSED$/;
const config=Buffer.from('[sound]\r\nmotor\\idle.wav\r\n1\r\n[3d]\r\n0\r\n0\r\n1\r\n[loopsound]\r\nmotor\\run.wav\r\n44100\r\n');
const sr=Buffer.from('source="/sound/truck/engine.bank#engine/engine"\n');
function bank(){const b=Buffer.alloc(12);b.write('RIFF');b.writeUInt32LE(4,4);b.write('FEV ',8);return b;}
function wav(){const b=Buffer.alloc(46);b.write('RIFF');b.writeUInt32LE(38,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(88200,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(2,40);return b;}
const input=(path,bytes,over={})=>({scope:'synthetic-fixture',path,bytes,encoding:'utf-8',limits:{maxBytes:8192,maxLines:100,maxReferences:16,...over}});
const f=(path,bytes)=>({path,bytes});
const g=(root,files,over={})=>({scope:'synthetic-fixture',root,files,encoding:'utf-8',limits:{maxBytes:8192,maxEntries:16,maxReferences:16,maxReportBytes:32768,...over}});
test('OMSI sound and loopsound preserve first path and directive position only',()=>{
 const r=inspect(input('vehicle/sound/sound.cfg',config));
 assert.deepEqual(r.references.map(x=>[x.path,x.line]),[['motor/idle.wav',2],['motor/run.wav',9]]);
 assert.deepEqual(r.sections.map(x=>x.status),['reference-only','uninterpreted','reference-only']);
 assert.equal(r.audioPlayed,false);
});
test('OMSI explicit Windows-1252 and unsafe paths',()=>{
 const x=input('sound.cfg',Buffer.from('Pr\xe9face\n[sound]\na.wav','latin1'));x.encoding='windows-1252';
 assert.equal(inspect(x).references[0].path,'a.wav');
 for(const s of ['[sound]\n../x.wav','[sound]\n/x.wav','[sound]\nC:\\a.wav','[sound]\na.ogg','[sound]','[sound\nx.wav'])assert.throws(()=>inspect(input('sound.cfg',Buffer.from(s))),refuse);
});
test('SOUNDREF preserves virtual bank and event identifier',()=>{
 const r=inspect(input('sound/engine.soundref',sr));
 assert.deepEqual(r.references[0],{path:'/sound/truck/engine.bank',role:'fmod-bank',line:1,event:'engine/engine',namespace:'game-virtual-root',resolution:'not-attempted'});
 assert.equal(r.eventExistenceVerified,false);
});
test('SOUNDREF rejects traversal, malformed event and multiple definitions',()=>{
 for(const s of ['source="../a.bank#x"','source="/a.bank#../x"','source="/a.bank#"','source="/a.wav#x"','source="/a.bank#x"\nsource="/b.bank#y"'])assert.throws(()=>inspect(input('a.soundref',Buffer.from(s))),refuse);
});
test('BANK candidate signature only, invalid size and type refused',()=>{
 const r=inspect(input('a.bank',bank()));assert.equal(r.bankSignature,'riff-fev-candidate');assert.equal(r.bankPayloadValidated,false);
 for(const b of [Buffer.alloc(12),bank().subarray(0,11),Buffer.concat([bank(),Buffer.alloc(1)])])assert.throws(()=>inspect(input('a.bank',b)),refuse);
});
test('OMSI graph resolves relative WAV paths and reports missing sound',()=>{
 const root='vehicle/sound/sound.cfg',r=graph(g(root,[f(root,config),f('vehicle/sound/motor/idle.wav',wav())]));
 assert.deepEqual(r.edges.map(e=>e.status),['matched','missing']);assert.equal(r.nodes[1].sampleRate,44100);
 assert.equal(r.issues[0].code,'MISSING_REFERENCE');assert.equal(r.allReferencesMatched,false);
});
test('SCS graph matches bank without verifying FMOD event',()=>{
 const root='sound/engine.soundref',r=graph(g(root,[f(root,sr),f('sound/truck/engine.bank',bank())]));
 assert.equal(r.allReferencesMatched,true);assert.equal(r.nodes[1].status,'signature-candidate');
 assert.equal(r.edges[0].event,'engine/engine');assert.equal(r.bankEventsVerified,false);
});
test('case mismatch and unreadable matched payload remain distinct',()=>{
 const root='sound/engine.soundref';
 const a=graph(g(root,[f(root,sr),f('sound/truck/Engine.bank',bank())]));
 assert.equal(a.edges[0].status,'case-mismatch');assert.equal(a.issues[0].code,'CASE_MISMATCH');
 const b=graph(g(root,[f(root,sr),f('sound/truck/engine.bank',Buffer.alloc(12))]));
 assert.equal(b.allReferencesMatched,true);assert.equal(b.allReachableAccepted,false);assert.equal(b.issues[0].code,'UNREADABLE_SUBSET');
});
test('graph limits, duplicate paths and real scope refused',()=>{
 const root='sound/engine.soundref',files=[f(root,sr),f('sound/truck/engine.bank',bank())];
 for(const over of [{maxBytes:5},{maxEntries:1},{maxReferences:0},{maxReportBytes:10}])assert.throws(()=>graph(g(root,files,over)),refuseGraph);
 assert.throws(()=>graph(g(root,[...files,files[0]])),refuseGraph);
 assert.throws(()=>graph({...g(root,files),scope:'real-mod'}),refuseGraph);
});
test('graph digest deterministic and evidence immutable, no playback or authorization',()=>{
 const root='sound/engine.soundref',files=[f(root,sr),f('sound/truck/engine.bank',bank()),f('unused.wav',wav())];
 const r=graph(g(root,files));assert.deepEqual(graph(g(root,[...files].reverse())),r);assert.deepEqual(r.unreferencedFiles,['unused.wav']);
 for(const o of [r,r.sources,r.sources[0],r.nodes,r.nodes[0],r.edges,r.edges[0],r.issues,r.unreferencedFiles])assert.ok(Object.isFrozen(o));
 for(const k of ['bankEventsVerified','fullSoundSupport','realDependenciesResolved','audioPlayed','realSecurityGateVerified','realReadsPerformed','operationsEnabled'])assert.equal(r[k],false);
});

test('3d directive stays opaque and arbitrary numeric tags remain refused',()=>{
 const r=inspect(input('sound.cfg',Buffer.from('[sound]\na.wav\n[3d]\nnot-a-reference.wav\n0\n1\n[loopsound]\nb.wav\n')));
 assert.deepEqual(r.references.map(x=>[x.path,x.line]),[['a.wav',2],['b.wav',8]]);
 assert.equal(r.sections[1].tag,'3d');assert.equal(r.sections[1].status,'uninterpreted');
 assert.equal(r.sections[1].valueCount,3);
 for(const tag of ['123','3d_extra','3d/','3 d'])assert.throws(()=>inspect(input('sound.cfg',Buffer.from('[sound]\na.wav\n['+tag+']\n0'))),refuse);
});

test('BANK signature refuses high-bit aliases even with matching RIFF length',()=>{
 for(const o of [0,1,2,3,8,9,10,11]){const b=bank();b[o]|=128;assert.throws(()=>inspect(input('a.bank',b)),refuse);}
});
