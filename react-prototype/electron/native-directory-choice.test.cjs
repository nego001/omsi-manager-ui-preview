'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {requestNativeDirectory:choose,PICKER_UNAVAILABLE:MESSAGE}=require('./native-directory-choice.cjs');
const absolute=path.join(os.tmpdir(),'synthetic-omsi-picker');
const failure={status:'error',message:MESSAGE};

test('one explicit native folder selection is accepted as a main-process-only path',async()=>{
  assert.deepEqual(await choose(async()=>({canceled:false,filePaths:[absolute]})),
    {status:'selected',selectedPath:absolute});
});
test('actual user cancellation remains distinct from malformed picker responses',async()=>{
  assert.deepEqual(await choose(async()=>({canceled:true,filePaths:[]})),{status:'cancelled'});
  assert.deepEqual(await choose(async()=>({canceled:true,filePaths:[absolute]})),failure);
});
test('native dialog rejection hides internal paths, error messages and credentials',async()=>{
  const privateError='secret-provider /home/person/private/OMSI?token=synthetic';
  const returned=await choose(async()=>{throw Error(privateError)});
  assert.deepEqual(returned,failure);
  assert.equal(JSON.stringify(returned).includes(privateError),false);
  assert.equal(JSON.stringify(returned).includes('/home/person'),false);
});
test('missing, invalid or empty picker responses fail closed rather than pretending cancel',async()=>{
  for(const choice of [null,undefined,42,false,'',{},[],{canceled:false},
    {canceled:true},{canceled:'false',filePaths:[absolute]},
    {canceled:false,filePaths:null},{canceled:false,filePaths:[]},
    {canceled:false,filePaths:[absolute,absolute]}]){
    assert.deepEqual(await choose(async()=>choice),failure);
  }
  assert.deepEqual(await choose(null),failure);
});
test('relative paths, NUL, nonstring paths and overly long picker paths are refused',async()=>{
  for(const value of ['./bad','../game','',42,{},absolute+'\0rest','x'.repeat(32768)]){
    assert.deepEqual(await choose(async()=>({canceled:false,filePaths:[value]})),failure);
  }
});
test('hostile getters on decision or path indices are never invoked',async()=>{
  let invoked=0;
  const malicious=Object.defineProperty({filePaths:[absolute]},'canceled',{get(){invoked++;throw Error('private')}});
  assert.deepEqual(await choose(async()=>malicious),failure);
  const paths=[absolute];
  Object.defineProperty(paths,'0',{get(){invoked++;throw Error('private')}});
  assert.deepEqual(await choose(async()=>({canceled:false,filePaths:paths})),failure);
  assert.equal(invoked,0);
});
test('property descriptor failures are caught without propagating native metadata',async()=>{
  const proxy=new Proxy({}, {getOwnPropertyDescriptor(){throw Error('private-provider-path')}});
  assert.deepEqual(await choose(async()=>proxy),failure);
});
test('synchronous provider errors are sanitized like async rejection',async()=>{
  assert.deepEqual(await choose(()=>{throw Error('/private/secret-password');}),failure);
});
test('main always rechecks origin and document epoch after the awaited picker',()=>{
  const source=readFileSync(join(__dirname,'main.cjs'),'utf8');
  const picker=source.indexOf('const choice = await requestNativeDirectory(');
  const auth=source.indexOf('if (!senderAuthorized())',picker);
  const selected=source.indexOf("choice.status === 'cancelled'",picker);
  const selectGate=source.indexOf("const gate=mode==='inspect-omsi-candidate'?structureGrantGate:inspectionGrantGate;",picker);
  const issue=source.indexOf('gate.issue(choice.selectedPath',picker);
  const consume=source.indexOf('await gate.inspectOnce(grant, senderId, gameId, documentSignal)',issue);
  const replyAuth=source.indexOf('if (!senderAuthorized())',consume);
  const release=source.indexOf('activeInspections.delete(senderId)',picker);
  assert.ok(picker>0&&auth>picker&&selected>auth&&selectGate>selected&&issue>selectGate&&consume>issue&&replyAuth>consume&&release>replyAuth);
  assert.match(source,/documentEpoch\.isCurrent\(documentProof\)/);
});
test('request wrapper is pure and cannot change host security policies or write game files',()=>{
  const source=readFileSync(join(__dirname,'native-directory-choice.cjs'),'utf8');
  for(const forbidden of ['require(\'electron\')','exec(', 'spawn(', 'writeFile',
    'process.env','console.', 'sysctl', 'apparmor_parser','--no-sandbox'])
    assert.equal(source.includes(forbidden),false,forbidden);
});
