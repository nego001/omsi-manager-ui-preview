'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {DEV_MODE_DENIED,resolvePreviewMode:mode}=require('./preview-mode-policy.cjs');
const deny=(packaged,env)=>assert.throws(()=>mode(packaged,env),{message:DEV_MODE_DENIED});

test('production packaged runtime always loads its bundled file, even if env is set to 0',()=>{
  assert.equal(mode(true,undefined),false);
  assert.equal(mode(true,'0'),false);
});
test('packaged runtime rejects attempts to load a dev HTTP renderer',()=>{
  deny(true,'1');
});
test('unpackaged development still requires the explicit 1 opt-in',()=>{
  assert.equal(mode(false,undefined),false);
  assert.equal(mode(false,'0'),false);
  assert.equal(mode(false,'1'),true);
});
test('unknown environment values and untrusted package-state types fail closed',()=>{
  for(const value of ['', 'false', 'true', '01', '2', ' 1', '1 ', false, 1, null, {}]){
    deny(true,value);
    deny(false,value);
  }
  for(const value of [undefined,'0','1']){
    for(const packaged of [undefined,null,0,1,'true',{},[]])deny(packaged,value);
  }
});
test('refusal never echoes the supplied environment data',()=>{
  const sensitive='private/user/path?token=synthetic-secret';
  assert.throws(()=>mode(true,sensitive),error=>{
    assert.equal(error.message,DEV_MODE_DENIED);
    assert.equal(error.message.includes(sensitive),false);
    return true;
  });
});
test('main verifies the package boundary before grants, IPC handlers and windows',()=>{
  const source=readFileSync(join(__dirname,'main.cjs'),'utf8');
  const check='resolvePreviewMode(app.isPackaged, process.env.OMSI_MANAGER_DEV_PREVIEW)';
  const index=source.indexOf(check);
  assert.ok(index>0);
  for(const marker of ['createInspectionGrantGate()','function createWindow()',
    'app.whenReady().then(', "ipcMain.handle('preview:inspect-game'"]){
    assert.ok(source.indexOf(marker)>index,marker);
  }
  assert.match(source,/OMSI_MANAGER_PACKAGED_DEV_MODE_REFUSED/);
  assert.match(source,/process\.exit\(3\)/);
  assert.equal((source.match(/process\.env\.OMSI_MANAGER_DEV_PREVIEW/g)||[]).length,1);
  assert.match(source,/const expectedURL = isDevelopment/);
  assert.doesNotMatch(source,/const isDevelopment = process\.env/);
});
test('policy is pure; does not modify Electron, host policy or environment',()=>{
  const source=readFileSync(join(__dirname,'preview-mode-policy.cjs'),'utf8');
  for(const marker of ['process.env','require(\'electron\')','app.commandLine',
    'writeFile','spawn(', 'exec(', 'chmod(', 'sysctl','apparmor_parser']){
    assert.equal(source.includes(marker),false,marker);
  }
});
