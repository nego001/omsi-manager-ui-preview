import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 autoPilotGate,autoPilotDesktop,validateAutoExecutable,
 verifiedOperatorAnswer,observedOutcome
} from './manual-auto-launch-contract.mjs';
const permitted=(desktop,session)=>({
 platform:'linux',uid:1000,stdinTTY:true,stdoutTTY:true,
 args:['--desktop',desktop,'--confirm-interactive'],
 env:{XDG_CURRENT_DESKTOP:desktop==='gnome'?'GNOME':
  desktop==='kde'?'KDE':'Hyprland',XDG_SESSION_TYPE:session,
  DISPLAY:session==='x11'?':0':''}
});
test('correct Linux desktop and explicit interactive opt-in are mandatory',()=>{
 for(const desktop of ['gnome','kde','hyprland']){
  assert.equal(autoPilotDesktop(permitted(desktop,'wayland').args),desktop);
  assert.equal(autoPilotGate(permitted(desktop,'wayland')),true);
 }
 assert.equal(autoPilotGate(permitted('kde','x11')),true);
 assert.equal(autoPilotGate(permitted('gnome','x11')),true);
 assert.equal(autoPilotGate(permitted('hyprland','x11')),false);
 const example=permitted('gnome','wayland');
 for(const altered of [{uid:0},{uid:undefined},{platform:'win32'},
  {args:[]},{stdinTTY:false},{stdoutTTY:false},
  {env:{...example.env,CI:'true'}},
  {env:{...example.env,GITHUB_ACTIONS:'true'}},
  {env:{...example.env,XDG_CURRENT_DESKTOP:'GNOME:KDE'}}])
  assert.equal(autoPilotGate({...example,...altered}),false);
});
test('native executable must be a regular ELF and never symlinked',()=>{
 const good={regular:true,symlink:false,executable:true,
  header:[127,69,76,70]};
 assert.doesNotThrow(()=>validateAutoExecutable(good));
 for(const bad of [{regular:false},{symlink:true},{executable:false},
  {header:[35,33,47,98]},{header:[127,69,76]}])
  assert.throws(()=>validateAutoExecutable({...good,...bad}),
   /AUTO_PILOT_EXECUTABLE_REFUSED/);
});
test('observations cannot claim compositor, portal or game compatibility',()=>{
 const v={desktop:'kde',session:'wayland',visible:true,keyboardNavigation:true,
  scaleReadable:true,processAlive:true};
 const report=observedOutcome(v);
 assert.equal(report.result,'PASS_MANUAL_VISUAL_ONLY');
 assert.equal(report.nativeFileChooserVerified,false);
 assert.equal(report.gameFilesTouched,false);
 assert.equal(report.compositorMechanicsVerified,false);
 assert.equal(Object.isFrozen(report),true);
 assert.deepEqual(Object.keys(report).sort(),[
  'result','desktopFamily','session','nativeAutoLauncherObserved',
  'visualScaleManuallyConfirmed','keyboardNavigationManuallyConfirmed',
  'compositorMechanicsVerified','nativeFileChooserVerified','gameFilesTouched'
 ].sort());
 for(const failure of [{visible:false},{keyboardNavigation:false},
  {scaleReadable:false},{processAlive:false},{session:'none'},
  {desktop:'hyprland',session:'x11'}])
  assert.throws(()=>observedOutcome({...v,...failure}),/AUTO_PILOT_NOT_VERIFIED/);
 assert.equal(verifiedOperatorAnswer('SIM'),true);
 for(const input of ['sim','','OK','SIM!'])
  assert.throws(()=>verifiedOperatorAnswer(input));
});
test('the real ELF, not the wrapper, is launched without unsafe arguments',async()=>{
 const source=await readFile(
  new URL('./manual-auto-launch-smoke.mjs',import.meta.url),'utf8');
 assert.match(source,/spawn\(launcher,\[\]/);
 assert.match(source,/OMSI-Manager-Auto/);
 assert.doesNotMatch(source,/execSync|execFileSync|shell:true|--no-sandbox|pkexec|sudo /);
 assert.doesNotMatch(source,/window\.omsiPreview\.inspectGame|dialog\.showOpenDialog/);
});
