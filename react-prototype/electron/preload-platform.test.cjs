'use strict';
// Sandbox preload is evaluated in a restricted VM: no Node access in renderer.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const code=readFileSync(path.join(__dirname,'preload.cjs'),'utf8');

function invoke(platform){
 let exposed;
 const sandbox={
  process:{platform},
  require:(id)=>{
   assert.equal(id,'electron','preload may only request safe Electron bridge');
   return {
    contextBridge:{exposeInMainWorld:(name,value)=>{
     assert.equal(name,'omsiPreview');
     exposed=value;
    }},
    ipcRenderer:{invoke:(channel,gameId)=>{
     assert.equal(channel,'preview:inspect-game');
     return Promise.resolve({gameId});
    }}
   };
  }
 };
 vm.runInNewContext(code,sandbox,{timeout:2000,filename:'preload.cjs'});
 return exposed;
}
test('cross-platform preload detects only Windows/Linux family',()=>{
 for(const [platform,family] of [['win32','windows'],['linux','linux'],
  ['darwin','unsupported'],['freebsd','unsupported'],['unknown','unsupported']]){
  const bridge=invoke(platform);
  assert.equal(bridge.runtime.operatingSystem,family);
  assert.equal(bridge.runtime.platformSelection,'automatic');
  assert.equal(bridge.runtime.gameOperations,'disabled');
  assert.equal(bridge.mode,'read-only');
  assert.equal(Object.isFrozen(bridge),true);
  assert.equal(Object.isFrozen(bridge.runtime),true);
  assert.equal(Object.isFrozen(bridge.capabilities),true);
  assert.equal(bridge.capabilities.installMods,false);
  assert.equal(bridge.capabilities.uninstallMods,false);
  assert.equal(bridge.capabilities.executeCommands,false);
  assert.equal(typeof bridge.inspectGame,'function');
 }
});
test('no platform input becomes a path, environment or command capability',async()=>{
 const bridge=invoke('linux');
 assert.deepEqual(Object.keys(bridge.runtime).sort(),
  ['gameOperations','operatingSystem','platformSelection'].sort());
 for(const dangerous of ['env','exec','spawn','fs','ipcRenderer','shell','path','user']){
  assert.equal(Object.hasOwn(bridge,dangerous),false);
  assert.equal(Object.hasOwn(bridge.runtime,dangerous),false);
 }
 const result=await bridge.inspectGame('omsi');
 assert.equal(result.gameId,'omsi');
});
