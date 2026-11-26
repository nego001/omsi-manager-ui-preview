import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectFixtureOmsi as inspect} from './omsi.mjs';
const limits={maxBytes:8192,maxLines:100,maxLineLength:512,maxSections:20,maxReferences:20};
const input=(s,path='Vehicles/Fixture/a.bus',over={},encoding='utf-8')=>({scope:'synthetic-fixture',path,bytes:Buffer.isBuffer(s)?s:Buffer.from(s),encoding,limits:{...limits,...over}});
const refuse=/^Error: READER_FIXTURE_OMSI_REFUSED$/;
test('bus parses model, sound and counted references with original line numbers',()=>{
 const src='Fixture header\r\n[model]\r\nmodel\\body.cfg\r\n[sound]\r\nsound\\sound.cfg\r\n[script]\r\n2\r\nscript\\a.osc\r\nscript\\b.osc\r\n[varnamelist]\r\n1\r\nscript\\vars.txt\r\n[stringvarnamelist]\r\n1\r\nscript\\strings.txt\r\n[constfile]\r\n1\r\nscript\\constants.txt';
 const r=inspect(input(src));assert.equal(r.format,'bus');assert.equal(r.unparsedLineCount,1);
 assert.equal(r.source.contentDigest,createHash('sha256').update(src).digest('hex'));
 assert.deepEqual(r.references.map(x=>[x.role,x.path,x.line]),[
 ['model-config','model/body.cfg',3],['sound-config','sound/sound.cfg',5],['script','script/a.osc',8],['script','script/b.osc',9],
 ['variables','script/vars.txt',12],['string-variables','script/strings.txt',15],['constants','script/constants.txt',18]]);
});
test('ovh supported with a case-insensitive file extension',()=>{
 const r=inspect(input('[model]\nmodel.cfg','Vehicles/a.OVH'));assert.equal(r.format,'ovh');assert.equal(r.references.length,1);
});
test('cfg reports ordered mesh references without interpreting other tags',()=>{
 const r=inspect(input('[mesh]\na.o3d\n[illumination_interior]\n0\n[mesh]\nb.o3d','model.cfg'));
 assert.equal(r.uninterpretedSectionCount,1);assert.deepEqual(r.references.map(x=>x.path),['a.o3d','b.o3d']);
});
test('unknown tags and mismatched contexts do not become dependencies',()=>{
 const r=inspect(input('[mesh]\na.o3d\n[unknown]\nsecret string\n[script]\n0'));
 assert.equal(r.uninterpretedSectionCount,2);assert.equal(r.references.length,0);assert.ok(!JSON.stringify(r).includes('secret string'));
});
test('explicit Windows-1252 decoding and UTF-8 BOM accepted',()=>{
 const b=Buffer.concat([Buffer.from('[friendlyname]\n'),Buffer.from([0x46,0xe9]),Buffer.from('\n[model]\na.cfg')]);
 assert.equal(inspect(input(b,'a.bus',{},'windows-1252')).references.length,1);
 assert.equal(inspect(input('\ufeff[model]\na.cfg')).references.length,1);
 assert.throws(()=>inspect(input(b)),refuse);
});
test('counted blocks reject mismatches and noncanonical counts',()=>{
 for(const s of ['[script]\n2\na.osc','[script]\n0\na.osc','[script]\n-1','[script]\n01\na.osc','[script]\n1.0\na.osc','[script]'])assert.throws(()=>inspect(input(s)),refuse);
});
test('single reference blocks reject absent or extra values',()=>{
 for(const s of ['[model]','[model]\na.cfg\nb.cfg','[model]\na.osc'])assert.throws(()=>inspect(input(s)),refuse);
});
test('unsafe reference paths are refused, not resolved',()=>{
 for(const p of ['../a.cfg','..\\a.cfg','C:\\a.cfg','/a.cfg','\\\\host\\a.cfg','NUL.cfg','a//b.cfg','a/./b.cfg','é.cfg','https://host/a.cfg'])assert.throws(()=>inspect(input('[model]\n'+p)),refuse);
});
test('invalid source path, extension and scope refused',()=>{
 for(const x of [input('[model]\na.cfg','../a.bus'),input('[model]\na.cfg','a.txt'),{...input('[model]\na.cfg'),scope:'real-mod'}])assert.throws(()=>inspect(x),refuse);
});
test('malformed tags, controls and empty configs refused',()=>{
 for(const s of ['[model','[model]\na.cfg\0','[model]\ra.cfg','[model]\na.cfg\u202e','plain text','[bad tag]\nx','[model]\na.cfg\n[broken'])assert.throws(()=>inspect(input(s)),refuse);
});
test('each resource limit is enforced',()=>{
 const s='[model]\na.cfg\n[sound]\nb.cfg';
 for(const over of [{maxBytes:5},{maxLines:3},{maxLineLength:4},{maxSections:1},{maxReferences:1},{maxBytes:Infinity}])assert.throws(()=>inspect(input(s,'a.bus',over)),refuse);
});
test('input accessors not invoked, invalid encoding and extra fields refused',()=>{
 const x=input('[model]\na.cfg');let invoked=false;Object.defineProperty(x,'bytes',{get(){invoked=true;return Buffer.alloc(0)},enumerable:true});
 assert.throws(()=>inspect(x),refuse);assert.equal(invoked,false);
 for(const y of [{...input('[model]\na.cfg'),extra:true},input('[model]\na.cfg','a.bus',{},'utf-16')])assert.throws(()=>inspect(y),refuse);
});
test('result is immutable, deterministic and never authorizes operations',()=>{
 const x=input('[model]\na.cfg');const r=inspect(x);assert.deepEqual(r,inspect(x));
 for(const o of [r,r.source,r.sections,r.sections[0],r.references,r.references[0]])assert.ok(Object.isFrozen(o));
 for(const k of ['fullOmsiSupport','dependenciesResolved','realSecurityGateVerified','realReadsPerformed','operationsEnabled'])assert.equal(r[k],false);
 assert.equal(r.references[0].resolution,'not-attempted');
 x.bytes.fill(0);assert.equal(r.references[0].path,'a.cfg');
});
