'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {runtime,checkElectronSource,checkInventory,auditRuntimeSource}=require('../scripts/m101-runtime-boundary.cjs');
const fixture=()=>['/package.json','/dist','/dist/index.html','/electron',...runtime.map(n=>'/electron/'+n)];
test('actual Electron runtime module set and static imports are reviewed',async()=>{
 assert.equal((await auditRuntimeSource(path.join(__dirname,'..'))).electronModulesChecked,runtime.length);
});
test('archive inventory accepts normal Linux and Windows path separators',()=>{
 assert.doesNotThrow(()=>checkInventory(fixture()));
 assert.doesNotThrow(()=>checkInventory(fixture().map(x=>x.replace(/\//g,'\\'))));
});
test('archive inventory rejects lab code, tests, unreviewed Electron modules and missing entrypoints',()=>{
 for(const extra of ['/scripts','/scripts/m99-lab.cjs','/native-lab/a.cjs','/electron/m99.test.cjs','/electron/new.cjs','/electron/nested','/tests/a.ts','/electron/main.cjs','/../outside'])
  assert.throws(()=>checkInventory([...fixture(),extra]),/M101_RUNTIME_BOUNDARY_REFUSED/);
 assert.throws(()=>checkInventory(fixture().filter(n=>n!=='/electron/preload.cjs')),/M101_RUNTIME_BOUNDARY_REFUSED/);
});
test('static source accepts reviewed local modules and builtins',()=>{
 assert.deepEqual(checkElectronSource('main.cjs',"const a=require('./game-inspection.cjs'); const b=require('node:path');"),['./game-inspection.cjs','node:path']);
});
test('static source rejects direct lab, unknown module, dynamic imports and require alias',()=>{
 for(const source of ["require('../scripts/m99.cjs')","require('./new.cjs')","require(name)","const r=require; r('x')","import('../scripts/x.cjs')","module.require('x')","require('node:child_process')","import x from '../scripts/x.cjs'"])
  assert.throws(()=>checkElectronSource('main.cjs',source),/M101_RUNTIME_BOUNDARY_REFUSED/);
});
