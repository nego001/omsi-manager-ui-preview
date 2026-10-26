import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gate,validateSecurity,validateCancel,validateSelection} from './manual-wayland-portal-contract.mjs';
const good=()=>({platform:'linux',uid:1000,args:['--confirm-interactive'],
 env:{XDG_SESSION_TYPE:'wayland',XDG_CURRENT_DESKTOP:'GNOME:Hyprland'},
 stdinTTY:true,stdoutTTY:true});
test('manual pilot never runs in CI, as root, or without explicit TTY approval',()=>{
 assert.equal(gate(good()),true);
 for(const bad of [{platform:'win32'},{uid:0},{args:[]},{stdinTTY:false},
  {stdoutTTY:false},{env:{CI:'true',XDG_SESSION_TYPE:'wayland',XDG_CURRENT_DESKTOP:'Hyprland'}},
  {env:{GITHUB_ACTIONS:'true',XDG_SESSION_TYPE:'wayland',XDG_CURRENT_DESKTOP:'Hyprland'}},
  {env:{XDG_SESSION_TYPE:'x11',XDG_CURRENT_DESKTOP:'Hyprland'}}])
  assert.equal(gate({...good(),...bad}),false);
});
test('renderer must be packaged, Wayland-native and incapable of writing mods',()=>{
 const safe={packaged:true,ozone:'wayland',mode:'read-only',node:'undefined',
 inspect:true,install:false,remove:false,execute:false};
 assert.doesNotThrow(()=>validateSecurity(safe));
 for(const bad of [{install:true},{remove:true},{execute:true},{node:'function'},
  {ozone:'x11'},{packaged:false}])
  assert.throws(()=>validateSecurity({...safe,...bad}));
});
test('cancel and selection must be real and match the exact synthetic name',()=>{
 validateCancel({status:'cancelled'});
 assert.throws(()=>validateCancel({status:'ok'}));
 const result={status:'ok',game:'omsi',mode:'read-only',folderName:'synthetic-only',
  recognized:true,assessment:{compatibilityVerified:false,installationVerified:false},
  groups:[{key:'vehicles',count:1},{key:'maps',count:1}]};
 validateSelection(result,'synthetic-only');
 for(const wrong of [{...result,folderName:'real-game'},
  {...result,mode:'write'},
  {...result,groups:[{key:'vehicles',count:2}]}])
  assert.throws(()=>validateSelection(wrong,'synthetic-only'));
});
test('runner does not mock Electron dialog or bypass sandbox',async()=>{
 const file=await readFile(new URL('./manual-wayland-portal-smoke.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(file,/dialog\.showOpenDialog\s*=/);
 assert.doesNotMatch(file,/--no-sandbox|pkexec|sudo\s/);
 assert.match(file,/window\.omsiPreview\.inspectGame/);
});
