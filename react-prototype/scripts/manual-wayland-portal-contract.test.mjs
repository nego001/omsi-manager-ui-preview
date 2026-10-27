import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gate,requestedDesktop,validateSecurity,validateCancel,validateSelection}
 from './manual-wayland-portal-contract.mjs';
const setup=(desktop='gnome',session='wayland')=>({
 platform:'linux',uid:1000,
 args:['--desktop',desktop,'--confirm-interactive'],
 env:{XDG_SESSION_TYPE:session,
  XDG_CURRENT_DESKTOP:desktop==='kde'?'KDE':desktop==='gnome'?'GNOME':'Hyprland',
  DISPLAY:session==='x11'?':0':''},
 stdinTTY:true,stdoutTTY:true
});
test('explicit desktop selection is mandatory and rejects unknown flags',()=>{
 for(const desktop of ['gnome','kde','hyprland'])
  assert.equal(requestedDesktop(setup(desktop).args),desktop);
 for(const args of [[],['--confirm-interactive'],['--desktop','evil','--confirm-interactive'],
   ['--desktop','kde'],['--desktop','kde','--confirm-interactive','--extra']])
  assert.equal(requestedDesktop(args),null);
});
test('GNOME and KDE allow Wayland or local X11, Hyprland Wayland only',()=>{
 for(const name of ['hyprland','kde','gnome'])
  assert.equal(gate(setup(name,'wayland')),true);
 for(const name of ['kde','gnome'])
  assert.equal(gate(setup(name,'x11')),true);
 assert.equal(gate(setup('hyprland','x11')),false);
});
test('mismatched desktops, ambiguous sessions and remote X11 fail closed',()=>{
 for(const desktop of ['gnome','kde','hyprland']){
  const base=setup(desktop);
  assert.equal(gate({...base,env:{...base.env,XDG_CURRENT_DESKTOP:'GNOME:KDE'}}),false);
  assert.equal(gate({...base,env:{...base.env,XDG_CURRENT_DESKTOP:'Hyprland:GNOME'}}),false);
 }
 assert.equal(gate({...setup('kde'),env:{...setup('kde').env,XDG_CURRENT_DESKTOP:'GNOME'}}),false);
 for(const display of ['localhost:10.0','evil:0',':0;command','',':99999']){
  const base=setup('gnome','x11');
  assert.equal(gate({...base,env:{...base.env,DISPLAY:display}}),false);
 }
});
test('CI, root, noninteractive and missing opt-in are always denied',()=>{
 const base=setup();
 const variants=[{platform:'win32'},{uid:0},{uid:undefined},{stdinTTY:false},
  {stdoutTTY:false},{args:[]},{env:{...base.env,CI:'true'}},
  {env:{...base.env,GITHUB_ACTIONS:'true'}}];
 for(const variant of variants)assert.equal(gate({...base,...variant}),false);
});
test('security invariants hold on both Ozone backends',()=>{
 for(const session of ['wayland','x11']){
  const expected=session==='wayland'?'wayland':'x11';
  const safe={packaged:true,ozone:expected,mode:'read-only',node:'undefined',
   inspect:true,install:false,remove:false,execute:false};
  assert.doesNotThrow(()=>validateSecurity(safe,session));
  for(const bad of [{install:true},{remove:true},{execute:true},
   {node:'function'},{ozone:'other'},{packaged:false},{inspect:false}])
   assert.throws(()=>validateSecurity({...safe,...bad},session));
  assert.throws(()=>validateSecurity(safe,'unsupported'));
 }
});
test('the native cancel and selection must match only the synthetic folder',()=>{
 validateCancel({status:'cancelled'});
 assert.throws(()=>validateCancel({status:'ok'}));
 const result={status:'ok',game:'omsi',mode:'read-only',folderName:'synthetic-only',
  recognized:true,assessment:{compatibilityVerified:false,installationVerified:false},
  groups:[{key:'vehicles',count:1},{key:'maps',count:1}]};
 validateSelection(result,'synthetic-only');
 for(const wrong of [{...result,folderName:'real-game'},
  {...result,mode:'write'}, {...result,groups:[{key:'vehicles',count:2}]}])
  assert.throws(()=>validateSelection(wrong,'synthetic-only'));
});
test('manual pilot does not mock file dialog or switch off sandbox',async()=>{
 const file=await readFile(new URL('./manual-wayland-portal-smoke.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(file,/dialog\.showOpenDialog\s*=/);
 assert.doesNotMatch(file,/--no-sandbox|pkexec|sudo\s/);
 assert.match(file,/window\.omsiPreview\.inspectGame/);
 assert.match(file,/validateSelection/);
});
