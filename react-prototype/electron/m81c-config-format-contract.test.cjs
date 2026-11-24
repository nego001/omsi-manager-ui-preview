'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {decodeFormatFixture:decode,referenceScope:scope}=require('../scripts/m81c-config-format-contract.cjs');
const map=text=>Buffer.concat([Buffer.from([255,254]),Buffer.from(text,'utf16le')]);
test('BOM-marked map configurations and tile fixtures retain text',()=>{
 for(const kind of ['map-global','map-tile']){
  const content='[name]\r\nSão João 🚌\r\n';
  const r=decode(map(content),kind,'utf-16le');
  assert.equal(r.text,content);assert.equal(r.source,'synthetic-format-fixture');
 }
});
test('map admission refuses missing or incorrect BOM, truncation and malformed surrogate',()=>{
 for(const bytes of [Buffer.from('abc'),Buffer.from('abc','utf16le'),Buffer.from([254,255,0,65]),Buffer.from([255,254,65]),Buffer.from([255,254,0,216])])
  assert.throws(()=>decode(bytes,'map-tile','utf-16le'),/M81C_FORMAT_REFUSED/);
 assert.throws(()=>decode(map('x'),'map-global','utf-8'),/M81C_FORMAT_REFUSED/);
});
test('vehicle encodings must be selected explicitly; no guessed fallback',()=>{
 for(const [encoding,byte,expected] of [['windows-1250',0xa3,'Ł'],['windows-1251',0xc0,'А'],['windows-1252',0xe9,'é']])
  assert.equal(decode(Buffer.from([byte]),'vehicle-definition',encoding).text,expected);
 assert.equal(decode(Buffer.from('Ônibus'),'vehicle-model','utf-8').text,'Ônibus');
 for(const encoding of ['auto','utf-16le','latin1'])assert.throws(()=>decode(Buffer.from('x'),'vehicle-definition',encoding));
 assert.throws(()=>decode(map('x'),'vehicle-definition','windows-1252'));
 assert.throws(()=>decode(Buffer.from([0xef,0xbb,0xbf,65]),'vehicle-definition','windows-1252'));
});
test('invalid UTF-8, controls and bounds refuse',()=>{
 for(const bytes of [Buffer.from([255]),Buffer.from([0]),Buffer.from('a\u202eb'),Buffer.alloc(65537,65),Buffer.from('x\n'.repeat(2049))])
  assert.throws(()=>decode(bytes,'vehicle-model','utf-8'));
});
test('reference bases are contextual, not global or inherited between formats',()=>{
 for(const keyword of ['[model]','[sound]','[paths]','[passengercabin]'])assert.equal(scope('vehicle-definition',keyword),'vehicle-root');
 assert.equal(scope('vehicle-model','[mesh]'),'model-directory');
 for(const [kind,keyword] of [['vehicle-definition','[mesh]'],['vehicle-model','[model]'],['map-tile','[mesh]'],['map-global','[object]'],['vehicle-model','[texchanges]'],['__proto__','[mesh]'],['vehicle-model','constructor']])
  assert.equal(scope(kind,keyword),'unsupported');
});
