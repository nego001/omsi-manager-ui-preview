'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {analyzeCandidateBytes:analyze,inspectCandidateFormat:inspect,admitRole}=require('../scripts/m103-omsi-config-format-admission.cjs');
const utf8=s=>Buffer.from(s,'utf8');
test('vehicle definition observes only fixed exact markers and immediate suffix hints',()=>{
 const r=analyze(utf8('[model]\r\nmodel\\private.cfg\r\n[sound]\n[sound]\nsound.cfg\n[paths]\n; comment.cfg\n[passengercabin]\npass.cfg\n[MODEL]\nunknown.cfg\n[other]\n'), 'vehicle-definition','utf-8');
 assert.equal(r.knownMarkers,5);assert.equal(r.unknownMarkers,2);
 assert.deepEqual(r.markers.map(x=>[x.keyword,x.occurrences,x.extensionHints,x.unresolvedArguments]),[
  ['model',1,1,0],['sound',2,1,1],['paths',1,0,1],['passengercabin',1,1,0]]);
 assert.doesNotMatch(JSON.stringify(r),/private\.cfg|unknown\.cfg|pass\.cfg/);
});
test('model and global roles remain distinct; suffix hint cannot validate path',()=>{
 const r=analyze(utf8('[mesh]\n..\\escape.o3d\n[model]\nmodel.cfg\n'),'vehicle-model','utf-8');
 assert.equal(r.knownMarkers,1);assert.equal(r.markers[0].extensionHints,1);assert.equal(r.referencesResolved,false);
 const map=analyze(Buffer.concat([Buffer.from([255,254]),Buffer.from('[map]\r\n','utf16le')]),'map-global','utf-16le');
 assert.equal(map.knownMarkers,0);assert.equal(map.unknownMarkers,1);
 assert.equal(map.outcome,'unclassified-markers-observed');
});
test('explicit legacy encodings and UTF-8 BOM admitted without guessing',()=>{
 for(const encoding of ['windows-1250','windows-1251','windows-1252']){
  const r=analyze(Buffer.concat([utf8('[model]\n'),Buffer.from([0xe9]),utf8('.cfg\n')]),'vehicle-definition',encoding);
  assert.equal(r.encoding,encoding);assert.equal(r.markers[0].extensionHints,1);
 }
 const r=analyze(Buffer.concat([Buffer.from([239,187,191]),utf8('[mesh]\nfile.o3d')]),'vehicle-model','utf-8');
 assert.equal(r.knownMarkers,1);
 for(const [bytes,role,encoding] of [
  [Buffer.from([0xff]),'vehicle-model','utf-8'],
  [utf8('[mesh]'),'vehicle-model','auto'],
  [Buffer.from([239,187,191,65]),'vehicle-model','windows-1252'],
  [Buffer.from('[map]','utf16le'),'map-global','utf-16le'],
  [utf8('[map]'),'map-global','utf-8']])
  assert.throws(()=>analyze(bytes,role,encoding),/M103_FORMAT_REFUSED/);
});
test('controls, unsupported line endings, overlong lines and marker budgets fail closed',()=>{
 for(const input of ['\0[model]','[model]\rfile.cfg','\u202e[model]',' '.repeat(1025)+'a','[model]\n'.repeat(257),'\n \n'])
  assert.throws(()=>analyze(utf8(input),'vehicle-definition','utf-8'),/M103_FORMAT_REFUSED/);
 const r=analyze(utf8('[bad marker]\nplain text'),'vehicle-definition','utf-8');
 assert.equal(r.unrecognizedBracketLines,1);assert.equal(r.outcome,'no-marker-evidence');
});
test('extension and explicit role mismatch refused before disk read',()=>{
 for(const [name,role] of [['a.bus','vehicle-model'],['a.cfg','vehicle-definition'],['global.cfg','vehicle-model'],['model.cfg','map-global'],['a.map','map-global']])
  assert.throws(()=>admitRole(name,role));
 assert.doesNotThrow(()=>admitRole('GLOBAL.CFG','map-global'));
});
test('bounded reader feeds format observation without exposing contents or changing fixture',async t=>{
 const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'omsi-m103-format-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const file=path.join(root,'Test.bus'),bytes=utf8('[model]\nprivate_model.cfg\n');
 await fs.writeFile(file,bytes,{flag:'wx'});
 const r=await inspect(root,'Test.bus','vehicle-definition','utf-8');
 assert.equal(r.byteCount,bytes.length);assert.equal(r.knownMarkers,1);
 assert.deepEqual(await fs.readFile(file),bytes);
 assert.doesNotMatch(JSON.stringify(r),/private_model|Test\.bus/);
 for(const k of ['fullGrammarVerified','referencesResolved','compatibilityVerified','nativeIdentityVerified','realModValidated','operationsEnabled'])assert.equal(r[k],false);
 assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.markers));
 const c=new AbortController();c.abort();
 await assert.rejects(inspect(root,'Test.bus','vehicle-definition','utf-8',c.signal),/M103_FORMAT_CANCELLED/);
});
