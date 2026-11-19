'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {createDocumentEpochGate:makeGate,shouldInvalidateOnNavigation:should}=require('./document-epoch-gate.cjs');

test('a proof is valid only for its originating live document epoch',()=>{
  const gate=makeGate(),proof=gate.snapshot();
  assert.ok(proof);
  assert.equal(gate.isCurrent(proof),true);
  assert.equal(gate.isCurrent(gate.snapshot()),true);
  assert.equal(Object.isFrozen(proof),true);
  assert.equal(Object.isFrozen(gate),true);
});
test('cross-document navigation invalidates an in-flight folder selection irrevocably',()=>{
  const gate=makeGate(),before=gate.snapshot();
  gate.invalidate();
  const after=gate.snapshot();
  assert.notStrictEqual(after,before);
  assert.equal(gate.isCurrent(before),false);
  assert.equal(gate.isCurrent(after),true);
  gate.invalidate();
  assert.equal(gate.isCurrent(before),false);
  assert.equal(gate.isCurrent(after),false);
});
test('a return to the same URL never reactivates the old proof',()=>{
  const gate=makeGate(),original=gate.snapshot();
  for(let i=0;i<3;i++){
    gate.invalidate();
    assert.equal(gate.isCurrent(original),false);
  }
});
test('cloned, serialized or renderer-provided objects cannot manufacture a proof',()=>{
  const gate=makeGate(),proof=gate.snapshot();
  for(const forged of [null,undefined,0,'proof',{},Object.freeze({}),
    {...proof},JSON.parse(JSON.stringify(proof))])
    assert.equal(gate.isCurrent(forged),false);
  assert.equal(gate.isCurrent(proof),true);
});
test('renderer exit or window destruction permanently revokes all outstanding grants',()=>{
  const gate=makeGate(),proof=gate.snapshot();
  gate.revoke();
  assert.equal(gate.snapshot(),null);
  assert.equal(gate.isCurrent(proof),false);
  assert.equal(gate.isCurrent(null),false);
  assert.equal(gate.invalidate(),false);
  gate.revoke();
  assert.equal(gate.snapshot(),null);
});
test('SPA in-place navigation and a subframe reload do not invalidate main-frame IPC',()=>{
  assert.equal(should({isMainFrame:true,isSameDocument:true}),false);
  assert.equal(should({isMainFrame:false,isSameDocument:false}),false);
  assert.equal(should({isMainFrame:false,isSameDocument:true}),false);
});
test('a top-frame reload, even to the same URL, invalidates old proof',()=>{
  assert.equal(should({isMainFrame:true,isSameDocument:false}),true);
});
test('unavailable or malformed navigation metadata fails closed',()=>{
  for(const details of [null,undefined,{},[],{isMainFrame:true},
    {isMainFrame:false},{isSameDocument:false},
    {isMainFrame:'false',isSameDocument:true},
    {isMainFrame:true,isSameDocument:0}])
    assert.equal(should(details),true);
});
test('main creates the guard before navigation and checks it before showing a picker',()=>{
  const source=readFileSync(join(__dirname,'main.cjs'),'utf8');
  const events=["'did-start-navigation'","'did-navigate'","'render-process-gone'","'destroyed'"];
  const registration=source.indexOf('documentEpochs.set(win.webContents, documentEpoch)');
  const createWindow=source.indexOf('function createWindow()');
  const loadFile=source.indexOf('void win.loadFile(indexPath)');
  const proof=source.indexOf('documentEpoch?.snapshot()');
  const verify=source.indexOf('documentEpoch.isCurrent(documentProof)');
  const dialog=source.indexOf('dialog.showOpenDialog(win');
  assert.ok(createWindow>=0 && registration>createWindow && registration<loadFile);
  for(const name of events)assert.ok(source.indexOf(name)>registration,name);
  assert.ok(proof>loadFile && verify>proof && dialog>verify);
  assert.match(source,/new WeakMap\(\)/);
});
test('the gate has no IO, host policy mutation, Electron dependency or private logging',()=>{
  const source=readFileSync(join(__dirname,'document-epoch-gate.cjs'),'utf8');
  for(const forbidden of ['process.env','require(\'electron\')','fs.', 'spawn(',
    'exec(','writeFile','console.','sysctl','apparmor_parser','--no-sandbox'])
    assert.equal(source.includes(forbidden),false,forbidden);
});
