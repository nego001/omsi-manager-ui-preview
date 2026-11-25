import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identifyFixtureFormat as identify} from './format.mjs';
const input=(bytes,extension='')=>({scope:'synthetic-fixture',bytes,extension});
const header=(hex,size)=>{const b=Buffer.alloc(size);Buffer.from(hex,'hex').copy(b);return b;};
const dds=()=>{const b=header('44445320',128);b.writeUInt32LE(124,4);b.writeUInt32LE(1,12);b.writeUInt32LE(1,16);b.writeUInt32LE(32,76);return b;};
const png=()=>{const b=header('89504e470d0a1a0a',33);b.writeUInt32BE(13,8);b.write('IHDR',12);b.writeUInt32BE(1,16);b.writeUInt32BE(1,20);return b;};
const wave=()=>{const b=header('52494646',12);b.writeUInt32LE(4,4);b.write('WAVE',8);return b;};
test('recognizes archive signatures with minimal header size, not validity',()=>{
 for(const [hex,n,extension,format] of [['504b0304',30,'zip','zip'],['504b0506',22,'zip','zip'],
 ['526172211a070100',9,'rar','rar5'],['526172211a0700',8,'rar','rar4'],['377abcaf271c',32,'7z','7z'],['53435323',8,'scs','scs-hashfs']]){
  const s=identify(input(header(hex,n),extension));assert.equal(s.format,format);assert.equal(s.status,'signature-recognized');
  assert.equal(s.extensionMatch,true);assert.equal(s.fullFormatValidated,false);assert.equal(s.extractionPerformed,false);
 }
});
test('recognizes texture headers and never claims decoded images',()=>{
 for(const [b,ext,format] of [[dds(),'dds','dds'],[png(),'png','png'],[header('ffd8ff',4),'jpg','jpeg']]){
  const s=identify(input(b,ext));assert.equal(s.format,format);assert.equal(s.category,'texture');assert.equal(s.status,'signature-recognized');
  assert.equal(s.fullFormatValidated,false);
 }
});
test('recognizes WAVE and Ogg but not arbitrary RIFF as WAVE',()=>{
 assert.equal(identify(input(wave(),'wav')).format,'riff-wave');
 assert.equal(identify(input(header('4f676753',27),'ogg')).status,'signature-recognized');
 const b=wave();b.write('AVI ',8);const r=identify(input(b,'wav'));assert.equal(r.status,'unsupported-riff');assert.equal(r.format,null);
});
test('signature beats misleading extension, ZIP-based SCS remains ZIP candidate',()=>{
 const b=header('504b0304',30);
 assert.equal(identify(input(b,'dds')).extensionMatch,false);
 assert.equal(identify(input(b,'scs')).format,'zip');
 assert.equal(identify(input(b)).extensionMatch,null);
 assert.equal(identify(input(b,'scs')).gameIdentityVerified,false);
});
test('known extension alone does not prove binary format or simulator identity',()=>{
 for(const [ext,hint] of [['bus','omsi-config-candidate'],['o3d','omsi-model-candidate'],['sii','scs-definition-candidate'],['pmd','scs-model-candidate'],['bank','audio-bank-candidate']]){
  const r=identify(input(Buffer.from('fixture'),ext));assert.equal(r.status,'extension-hint-only');assert.equal(r.extensionHint,hint);assert.equal(r.format,null);
 }
 assert.equal(identify(input(Buffer.from('fake'),'zip')).status,'unknown');
});
test('truncated exact signatures and partial prefixes remain incomplete',()=>{
 for(const [hex,n,format] of [['504b0304',4,'zip'],['44445320',4,'dds'],['89504e470d0a1a0a',8,'png'],['53435323',4,'scs-hashfs'],['52494646',4,'riff-wave']]){
  const r=identify(input(header(hex,n)));assert.equal(r.format,format);assert.equal(r.status,'truncated');
 }
 assert.equal(identify(input(Buffer.from('89504e47','hex'))).status,'truncated-signature');
 assert.equal(identify(input(Buffer.from('89','hex'))).status,'unknown');
});
test('reject malformed minimum fields without interpreting remaining payload',()=>{
 const a=dds();a.writeUInt32LE(0,16);const b=png();b.write('DATA',12);
 const c=wave();c.writeUInt32LE(0,4);const d=header('4f676753',27);d[26]=1;
 for(const x of [a,b,c,d])assert.equal(identify(input(x)).status,'invalid-header');
});
test('unknown bytes, empty data and signatures only at nonzero offsets are unknown',()=>{
 for(const b of [Buffer.alloc(0),Buffer.from('unknown'),Buffer.concat([Buffer.from('x'),png()])]){
  assert.equal(identify(input(b)).status,'unknown');
 }
});
test('output immutable, no raw content, no game compatibility or operations',()=>{
 const b=png(),r=identify(input(b,'png'));assert.ok(Object.isFrozen(r));b.fill(0);
 assert.equal(r.status,'signature-recognized');assert.equal(Object.hasOwn(r,'bytes'),false);
 for(const key of ['fullFormatValidated','gameIdentityVerified','compatibilityVerified','realReadsPerformed','extractionPerformed','operationsEnabled'])assert.equal(r[key],false);
});
test('reject real scope, malformed fields, excessive buffers and accessors',()=>{
 const refuse=/READER_FIXTURE_FORMAT_REFUSED/;
 for(const x of [{...input(Buffer.alloc(0)),scope:'real-mod'},input('bytes'),input(Buffer.alloc(16*1024*1024+1)),input(Buffer.alloc(0),'../file'),{...input(Buffer.alloc(0)),path:'/secret'}]){
  assert.throws(()=>identify(x),refuse);
 }
 let invoked=false;const x=input(Buffer.alloc(0));Object.defineProperty(x,'bytes',{get(){invoked=true;return Buffer.alloc(0);},enumerable:true});
 assert.throws(()=>identify(x),refuse);assert.equal(invoked,false);
});
