import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildFixtureIndex as build} from './index.mjs';
const refuse=/READER_FIXTURE_INDEX_REFUSED/;
const limits={maxEntries:8,maxNodes:24,maxDepth:5,maxBytes:100,maxEntryBytes:50};
const file=(path,bytes='abc')=>({path,kind:'file',bytes:Buffer.from(bytes)});
const dir=path=>({path,kind:'directory',bytes:null});
const input=(entries=[],over={})=>({scope:'synthetic-fixture',limits:{...limits,...over},entries});
test('hash actual synthetic bytes and create deterministic immutable index',()=>{
 const a=file('Vehicles/Bus/model.cfg'),b=dir('Vehicles'),c=file('Vehicles/Bus/empty.bus','');
 const s=build(input([a,b,c]));
 assert.equal(s.totalBytes,3);assert.equal(s.entryCount,3);assert.equal(s.nodeCount,4);
 assert.equal(s.entries.find(e=>e.path===a.path).contentDigest,createHash('sha256').update('abc').digest('hex'));
 assert.equal(s.indexDigest,build(input([c,b,a])).indexDigest);
 assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.entries)&&Object.isFrozen(s.entries[0]));
 assert.equal(s.operationsEnabled,false);assert.equal(s.realSecurityGateVerified,false);
 assert.equal(s.realReadsPerformed,false);assert.equal(s.extractionPerformed,false);
 a.bytes[0]=120;assert.notEqual(build(input([a,b,c])).indexDigest,s.indexDigest);
 assert.equal(s.totalBytes,3);assert.equal(Object.hasOwn(s.entries[0],'bytes'),false);
});
test('reject absolute, traversal, drive, UNC, backslash and ambiguous paths',()=>{
 for(const path of ['/root/a','../a','a/../b','a/./b','a//b','C:/a','C:a','\\\\server\\a','a\\b','a/',' a','a ','a.','a\0b','a\nb','a:b','a%2fb']){
  assert.throws(()=>build(input([file(path)])),refuse,path);
 }
});
test('reject portable reserved device names and nonportable characters',()=>{
 for(const path of ['NUL','a/aux.txt','COM1.cfg','lpt9','PRN','CON.txt','é.cfg','a?.bus','a*.bus','a|b','a<b']){
  assert.throws(()=>build(input([file(path)])),refuse,path);
 }
});
test('reject duplicates, case collisions and implicit directory collisions regardless of order',()=>{
 for(const entries of [[file('a'),file('a')],[file('A'),file('a')],[file('Bus/a'),file('bus/b')],
  [dir('A'),dir('a')],[file('Bus/a'),dir('bus')]]){
  assert.throws(()=>build(input(entries)),refuse);assert.throws(()=>build(input([...entries].reverse())),refuse);
 }
});
test('reject file-directory conflicts in both insertion orders',()=>{
 for(const entries of [[file('a'),file('a/b')],[file('a'),dir('a')],[dir('a'),file('a')]]){
  assert.throws(()=>build(input(entries)),refuse);assert.throws(()=>build(input([...entries].reverse())),refuse);
 }
});
test('reject all non-file/non-directory types and invalid payloads',()=>{
 for(const e of [{path:'a',kind:'symlink',bytes:null},{path:'a',kind:'hardlink',bytes:null},
 {path:'a',kind:'device',bytes:null},{path:'a',kind:'file',bytes:'abc'},{path:'a',kind:'directory',bytes:Buffer.alloc(0)}]){
  assert.throws(()=>build(input([e])),refuse);
 }
});
test('enforce entry, implicit node, depth and byte limits',()=>{
 for(const [entries,over] of [[[file('a'),file('b')],{maxEntries:1}],
 [[file('a/b/c')],{maxNodes:2}],[[file('a/b')],{maxDepth:1}],
 [[file('a','1234')],{maxEntryBytes:3}],[[file('a','12'),file('b','34')],{maxBytes:3,maxEntryBytes:3}]]){
  assert.throws(()=>build(input(entries,over)),refuse);
 }
 const s=build(input([file('a/b','123')],{maxEntries:1,maxNodes:2,maxDepth:2,maxBytes:3,maxEntryBytes:3}));
 assert.equal(s.totalBytes,3);assert.equal(s.nodeCount,2);
});
test('empty entries, zero-byte files and explicit directories are valid without content claims',()=>{
 assert.equal(build(input()).entryCount,0);
 const s=build(input([dir('a'),file('a/b','')],{maxBytes:0,maxEntryBytes:0}));
 assert.equal(s.totalBytes,0);assert.equal(s.entries[0].contentDigest,null);
 assert.notEqual(s.entries[1].contentDigest,null);
});
test('malformed records, getter fields and sparse arrays refuse',()=>{
 const e=file('a');let invoked=false;Object.defineProperty(e,'bytes',{get(){invoked=true;return Buffer.alloc(0);},enumerable:true});
 assert.throws(()=>build(input([e])),refuse);assert.equal(invoked,false);
 assert.throws(()=>build(input(Array(1))),refuse);
 assert.throws(()=>build(input([{...file('a'),target:'/private'}])),refuse);
 assert.throws(()=>build({...input(),scope:'real-mod'}),refuse);
 assert.throws(()=>build(input([],{maxNodes:Infinity})),refuse);
});
test('reject excessive path and segment length, no raw input in refusal',()=>{
 for(const path of ['a'.repeat(81),Array(4).fill('a'.repeat(80)).join('/'),'../PRIVATE_SECRET']){
  assert.throws(()=>build(input([file(path)])),e=>e.message==='READER_FIXTURE_INDEX_REFUSED'&&!e.message.includes('PRIVATE_SECRET'));
 }
});
