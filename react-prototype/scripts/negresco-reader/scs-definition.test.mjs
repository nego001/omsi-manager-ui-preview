import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectFixtureScsDefinition as inspect} from './scs-definition.mjs';
const limits={maxBytes:8192,maxLines:100,maxLineLength:512,maxUnits:20,maxFields:30,maxReferences:20};
const input=(s,path='def/vehicle/fixture.sii',over={})=>({scope:'synthetic-fixture',path,bytes:Buffer.isBuffer(s)?s:Buffer.from(s),limits:{...limits,...over}});
const wrap=s=>'SiiNunit\n{\n'+s+'\n}';
const unit=s=>wrap('accessory_engine_data : .fixture\n{\n'+s+'\n}');
const refuse=/^Error: READER_FIXTURE_SCS_REFUSED$/;
test('SII reads ordered units, fields, array indices and virtual references',()=>{
 const s=wrap('accessory_engine_data : .engine {\n torque: 2000\n suitable_for[]: .fixture\n}\naccessory_data : truck.fixture\n{\n model: "/vehicle/truck/body.pmd"\n variants[0]: "a"\n variants[]: "b"\n}');
 const r=inspect(input(s));assert.equal(r.units.length,2);assert.equal(r.fieldCount,5);
 assert.deepEqual(r.units[1].fields.map(f=>[f.attribute,f.index,f.kind]),[['model',null,'string'],['variants','0','string'],['variants','','string']]);
 assert.equal(r.references[0].path,'/vehicle/truck/body.pmd');assert.equal(r.references[0].namespace,'game-virtual-root');
 assert.equal(r.source.contentDigest,createHash('sha256').update(s).digest('hex'));
});
test('root brace on same line, comments, BOM and CRLF supported',()=>{
 const r=inspect(input('\ufeffSiiNunit {\r\n# comment\r\n// comment\r\n}'));assert.equal(r.units.length,0);
});
test('SUI fragment retains attribute positions and include without expansion',()=>{
 const r=inspect(input('name: "fixture"\n@include "extra.sui"\n sound: "/sound/test.soundref"','def/fixture.SUI'));
 assert.equal(r.format,'sui');assert.equal(r.units.length,0);assert.equal(r.fragmentFields.length,2);
 assert.deepEqual(r.references.map(x=>[x.role,x.line,x.namespace]),[['include',2,'relative-unresolved'],['asset-candidate',3,'game-virtual-root']]);
});
test('root and unit includes retain context and do not resolve',()=>{
 const r=inspect(input(wrap('@include "/def/shared.sii"\naccessory_data : .a {\n@include "a.sui"\n}')));
 assert.deepEqual(r.references.map(x=>[x.unitId,x.resolution]),[[null,'not-attempted'],['.a','not-attempted']]);
});
test('typed scalar subset does not return non-reference values',()=>{
 const r=inspect(input(unit('name: "private-text"\n active: true\n factor: -1.5e2\n token: truck.fixture')));
 assert.deepEqual(r.units[0].fields.map(f=>f.kind),['string','boolean','number','token']);
 assert.ok(!JSON.stringify(r).includes('private-text'));
});
test('duplicate unit IDs and malformed nesting rejected',()=>{
 for(const s of [wrap('a : .x {\n}\nb : .x {\n}'),wrap('a : .x {\nb : .y {\n}\n}'),wrap('a : .x\nx: 1'), 'SiiNunit\n{\na : .x {\n}',wrap('}')])assert.throws(()=>inspect(input(s)),refuse);
});
test('unsafe virtual paths and include paths rejected',()=>{
 for(const p of ['../a.pmd','/../a.pmd','//host/a.pmd','C:/a.pmd','/a//b.pmd','/NUL.pmd','/é.pmd','/a/./b.pmd'])assert.throws(()=>inspect(input(unit('model: "'+p+'"'))),refuse);
 for(const p of ['../a.sui','/a.exe','/a\\b.sui'])assert.throws(()=>inspect(input(wrap('@include "'+p+'"'))),refuse);
});
test('unsupported grammar and invalid scalar forms fail closed',()=>{
 for(const s of ['x: (1, 2)','x: "a\\b"','x: 1e999','x:','x[01]: 2','x: 1 // inline comment','x: {','x: &3f800000'])assert.throws(()=>inspect(input(unit(s))),refuse);
});
test('invalid encoding, control characters, missing header and trailing content refused',()=>{
 for(const s of [Buffer.from([0xff]),'x: 1',wrap('')+'\nextra',unit('x: "a\0b"'),unit('x: "a\u202eb"'),'SiiNunit\r{'] )assert.throws(()=>inspect(input(s)),refuse);
});
test('every resource cap is enforced',()=>{
 const s=unit('model: "/a.pmd"\nother: "/b.pmg"');
 for(const over of [{maxBytes:5},{maxLines:3},{maxLineLength:4},{maxUnits:0},{maxFields:1},{maxReferences:1},{maxBytes:Infinity}])assert.throws(()=>inspect(input(s,'a.sii',over)),refuse);
});
test('invalid paths, scope, extension and accessor rejected',()=>{
 const s=unit('x: 1'),x=input(s);let invoked=false;Object.defineProperty(x,'bytes',{get(){invoked=true;return Buffer.alloc(0)},enumerable:true});
 assert.throws(()=>inspect(x),refuse);assert.equal(invoked,false);
 for(const y of [input(s,'../a.sii'),input(s,'a.txt'),{...input(s),scope:'real-mod'},{...input(s),extra:true},input('','a.sui')])assert.throws(()=>inspect(y),refuse);
});
test('immutable deterministic evidence never enables operations or infers game',()=>{
 const x=input(unit('model: "/a.pmd"')),r=inspect(x);assert.deepEqual(r,inspect(x));
 for(const o of [r,r.source,r.units,r.units[0],r.units[0].fields,r.units[0].fields[0],r.references,r.references[0],r.fragmentFields])assert.ok(Object.isFrozen(o));
 for(const k of ['fullScsSupport','gameIdentified','dependenciesResolved','includesExpanded','realSecurityGateVerified','realReadsPerformed','operationsEnabled'])assert.equal(r[k],false);
 x.bytes.fill(0);assert.equal(r.references[0].path,'/a.pmd');
});
