'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {BLOCKED_SWITCHES, DENIED, assertSecureMainProcessStartup: check} =
  require('./launch-argument-guard.cjs');

const ERROR = {message:DENIED};
const commandLine = (active = []) => ({
  hasSwitch(name) { return active.includes(name); }
});
const deny = (args, ...values) => {
  // Distinguish no second argument from an explicitly invalid undefined.
  const switches = values.length ? values[0] : commandLine();
  assert.throws(() => check(args,switches), ERROR);
};

test('safe packaged and development argv preserve Electron automation flags',()=>{
  for (const args of [
    [],
    ['.'],
    ['app.asar'],
    ['--remote-debugging-pipe','--user-data-dir=/tmp/synthetic'],
    ['--ozone-platform=wayland'],
    ['--ozone-platform=x11','--lang=pt-BR'],
    ['--type=browser','--disable-gpu'],
    ['--disable-features=some-internal-test-feature']
  ]) assert.equal(check(args,commandLine()),true);
});
test('ten known security-reducing switches are rejected, both raw and value variants',()=>{
  assert.equal(BLOCKED_SWITCHES.length,10);
  assert.equal(Object.isFrozen(BLOCKED_SWITCHES),true);
  for(const name of BLOCKED_SWITCHES) {
    deny(['--'+name]);
    deny(['--'+name+'=1']);
    deny(['--'+name+'=false']);
    deny(['--'+name+'=']);
    deny(['prefix','--'+name]);
    deny(['--'+name.toUpperCase()]);
  }
});
test('Electron normalized commandLine cannot silently override raw argv',()=>{
  for(const name of BLOCKED_SWITCHES){
    deny([],commandLine([name]));
    deny(['app.asar','--remote-debugging-pipe'],commandLine([name]));
  }
});
test('a flag substring in normal file and values is not interpreted as a switch',()=>{
  assert.equal(check([
    '/tmp/synthetic--no-sandbox.txt',
    '--message=--no-sandbox',
    'C:\\Synthetic\\--no-sandbox'
  ],commandLine()),true);
});
test('argument tampering with embedded control characters fails closed',()=>{
  for(const arg of ['--no-sandbox\0','valid\n--no-sandbox',
    '--allow-running-insecure-content\r','x'.repeat(8193)]){
    deny([arg]);
  }
});
test('malformed argv and command-line objects refuse rather than approving',()=>{
  for(const argv of [null,undefined,{},'--no-sandbox',
    [null], [42], [false], Array(257).fill('safe')]){
    deny(argv);
  }
  for(const obj of [null,undefined,{},[],{hasSwitch:true},
    {hasSwitch(){throw Error('private');}},
    {hasSwitch(){return 0;}},
    {hasSwitch(){return undefined;}},
    {hasSwitch(){return 'false';}}
  ])deny([],obj);
});
test('the denial error never echoes a token, path or sensitive command line',()=>{
  const secret='/home/test-person/private-file';
  assert.throws(()=>check([secret,'--no-sandbox'],commandLine()),err=>{
    assert.equal(err.message,DENIED);
    assert.equal(err.message.includes(secret),false);
    assert.equal(err.message.includes('no-sandbox'),false);
    return true;
  });
});
test('security main guard happens before inspection grant creation, IPC and window creation',()=>{
  const main=readFileSync(join(__dirname,'main.cjs'),'utf8');
  const checkCall=main.indexOf('assertSecureMainProcessStartup(process.argv.slice(1), app.commandLine)');
  assert.ok(checkCall>0,'main must explicitly check current actual Electron switches');
  for(const marker of [
    'createInspectionGrantGate()',
    'function createWindow()',
    'app.whenReady().then(',
    "ipcMain.handle('preview:inspect-game'"
  ])assert.ok(main.indexOf(marker)>checkCall,marker);
  assert.match(main,/process\.exit\(3\)/);
  assert.match(main,/OMSI_MANAGER_UNSAFE_ELECTRON_STARTUP_REFUSED/);
});
test('production webPreferences remain sandboxed after command-line guard',()=>{
  const {SECURE_WEB_PREFERENCES:prefs}=require('./security-policy.cjs');
  assert.equal(prefs.sandbox,true);
  assert.equal(prefs.webSecurity,true);
  assert.equal(prefs.contextIsolation,true);
  assert.equal(prefs.nodeIntegration,false);
});
test('new guard is refusal-only: no host or game security policy mutations',()=>{
  const source=readFileSync(join(__dirname,'launch-argument-guard.cjs'),'utf8');
  for(const marker of [
    'execSync(', 'spawnSync(', 'execFile(', 'process.env.',
    'chmodSync(', 'writeFileSync(', 'apparmor_parser',
    'sysctl -w', 'app.commandLine.appendSwitch',
    'app.disableHardwareAcceleration',
    'require("electron")'
  ])assert.equal(source.includes(marker),false,marker);
});
