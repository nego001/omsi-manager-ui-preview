'use strict';
// Test-only admission policy for a hypothetical future OS-principal service.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {createSyntheticServiceBoundary,boundedFrames,LAB_POLICY,
 MAX_FRAME_BYTES,MAX_ACCEPTED,MAX_ATTEMPTS}=
 require('./synthetic-service-boundary.cjs');

test('laboratory policy never claims OS identity separation or real write authority',()=>{
 const policy=createSyntheticServiceBoundary().policy();
 assert.equal(policy,LAB_POLICY);
 assert.equal(Object.isFrozen(policy),true);
 for(const key of ['principalSeparationProven','peerCredentialsVerified',
  'osProtectedChannel','persistentKeyCustodyProven',
  'operationsEnabled','supportsRealGameInspection','acceptsClientPaths',
  'acceptsClientKeys','allowsSigningArbitraryData'])
  assert.equal(policy[key],false,key);
 assert.equal(policy.schema,'omsi-synthetic-service-boundary-v1');
});

test('canonical fixed IPC permits only arm, verify and shutdown',()=>{
 const s=createSyntheticServiceBoundary();
 assert.deepEqual(s.admit('{"id":1,"op":"arm"}'),{id:1,op:'arm'});
 assert.deepEqual(s.admit('{"id":2,"op":"verify"}'),{id:2,op:'verify'});
 assert.deepEqual(s.admit('{"id":9999,"op":"shutdown"}'),
  {id:9999,op:'shutdown'});
 assert.equal(s.admit('{"id":9999,"op":"verify"}'),null);
});

test('out-of-order IDs, duplicated IDs and replay remain refused',()=>{
 const s=createSyntheticServiceBoundary();
 assert.deepEqual(s.admit('{"id":10,"op":"arm"}'),{id:10,op:'arm'});
 for(const id of [10,9,1,0,-1,1.5,10000,9007199254740991])
  assert.equal(s.admit(JSON.stringify({id,op:'verify'})),null);
 assert.deepEqual(s.admit('{"id":11,"op":"verify"}'),{id:11,op:'verify'});
});

test('privilege assertions, paths, arbitrary hashes, keys and user identities are refused',()=>{
 const s=createSyntheticServiceBoundary();
 const injected=[
  {id:1,op:'verify',principalSeparationProven:true},
  {id:1,op:'arm',claimedUid:0},
  {id:1,op:'arm',isAdministrator:true},
  {id:1,op:'arm',peerIdentity:'trusted'},
  {id:1,op:'arm',key:'test-key'},
  {id:1,op:'arm',path:'/home/user/.local/share/OMSI'},
  {id:1,op:'arm',root:'C:\\OMSI'},
  {id:1,op:'sign',hash:'e'.repeat(64)},
  {id:1,op:'install-mod',enabled:true},
  {id:1,op:'delete'},
  {id:1,op:'restore'},
  {id:1,op:'grant'},
  {id:1,op:'execute'},
  {id:1,op:'verify',proof:'self-attested'}
 ];
 for(const input of injected)
  assert.equal(s.admit(JSON.stringify(input)),null,JSON.stringify(input));
 assert.deepEqual(s.admit('{"id":1,"op":"arm"}'),{id:1,op:'arm'});
});

test('duplicate JSON keys, extra whitespace, reordered fields and newline injection fail',()=>{
 const s=createSyntheticServiceBoundary();
 for(const frame of [
  '{"id":1,"op":"arm","op":"shutdown"}',
  '{"op":"arm","id":1}',
  '{"id":1, "op":"arm"}',
  '{"id":1,"op":"ar\\u006d"}',
  '{"id":1,"op":"arm"}\r',
  '{"id":1,"op":"arm"}\n{"id":2,"op":"verify"}',
  '[]','null','0','"string"','{"id":1}'
 ])assert.equal(s.admit(frame),null,frame);
});

test('session refuses requests after the accepted request budget is exhausted',()=>{
 const s=createSyntheticServiceBoundary();
 assert.equal(MAX_ACCEPTED,32);
 for(let i=1;i<=MAX_ACCEPTED;i++)
  assert.equal(s.admit(JSON.stringify({id:i,op:'verify'})).id,i);
 assert.equal(s.admit(JSON.stringify({id:33,op:'verify'})),null);
 assert.equal(s.admit(JSON.stringify({id:9999,op:'shutdown'})),null);
});

test('malformed-request budget cannot upgrade service policy',()=>{
 const s=createSyntheticServiceBoundary();
 for(let i=0;i<MAX_ATTEMPTS;i++)
  assert.equal(s.admit('INVALID'),null);
 assert.equal(s.admit('{"id":1,"op":"arm"}'),null);
 assert.equal(s.policy().principalSeparationProven,false);
});

test('bounded decoder accepts IPC frames split across arbitrary stream chunks',async()=>{
 const source=Readable.from([
  Buffer.from('{"id":1,'),Buffer.from('"op":"arm"}\n{"id":2'),
  Buffer.from(',"op":"verify"}\n')
 ]);
 const results=[];
 for await(const frame of boundedFrames(source))results.push(frame);
 assert.deepEqual(results,['{"id":1,"op":"arm"}','{"id":2,"op":"verify"}']);
});

test('overlong frame without newline is discarded before next valid frame',async()=>{
 const huge=Buffer.from('X'.repeat(100000));
 const parts=Readable.from([
  huge.subarray(0,30000),huge.subarray(30000),
  Buffer.from('\n{"id":1,"op":"arm"}\n')
 ]);
 const result=[];
 for await(const frame of boundedFrames(parts))result.push(frame);
 assert.deepEqual(result,[null,'{"id":1,"op":"arm"}']);
 assert.equal(MAX_FRAME_BYTES,160);
});

test('unterminated final IPC frame and CRLF are conservatively rejected',async()=>{
 const lines=[];
 for await(const line of boundedFrames(Readable.from([
  Buffer.from('{"id":1,"op":"arm"}\r\n{"id":2,"op":"verify"}')
 ])))lines.push(line);
 assert.deepEqual(lines,['{"id":1,"op":"arm"}\r',null]);
 const s=createSyntheticServiceBoundary();
 assert.equal(s.admit(lines[0]),null);
 assert.equal(s.admit(lines[1]),null);
});

test('the IPC boundary never handles filesystem, credentials or key data',async()=>{
 const fs=require('node:fs/promises');
 const {join}=require('node:path');
 const source=await fs.readFile(join(__dirname,'synthetic-service-boundary.cjs'),'utf8');
 assert.doesNotMatch(source,/child_process|writeFile|createWriteStream|execFile|spawn\(/);
 assert.doesNotMatch(source,/chmod|chown|setuid|setgid|privateKey/);
 assert.match(source,/operationsEnabled:false/);
 assert.match(source,/peerCredentialsVerified:false/);
});
