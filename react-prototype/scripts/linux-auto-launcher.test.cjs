'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {spawnSync}=require('node:child_process');
const roots=[];
after(async()=>{for(const root of roots)await fs.rm(root,{recursive:true,force:true});});
const auto=resolve('release/OMSI-Manager-Preview-linux-x64/OMSI-Manager-Auto');
async function fixture(){
 const root=await fs.mkdtemp(join(tmpdir(),'omsi-auto-executable-fixture-'));
 roots.push(root);
 const autoPath=join(root,'OMSI-Manager-Auto');
 const target=join(root,'OMSI-Manager-Preview');
 await fs.copyFile(auto,autoPath);
 await fs.chmod(autoPath,0o755);
 await fs.writeFile(target,['#!/bin/sh',
 "printf '%s|%s|%s\\n' \"$1\" \"$OMSI_MANAGER_DESKTOP_PROFILE\" \"$OMSI_MANAGER_DISPLAY_PROFILE\"",
 ''].join('\n'),{mode:0o755});
 await fs.chmod(target,0o755);
 const run=(env,extra=[])=>spawnSync(autoPath,extra,{
  env:{...process.env,CI:'',XDG_CURRENT_DESKTOP:'',XDG_SESSION_TYPE:'',
   WAYLAND_DISPLAY:'',XDG_RUNTIME_DIR:'',DISPLAY:'',...env},
  encoding:'utf8',timeout:8000
 });
 return {root,target,run};
}
test('Native auto launcher is an executable ELF, not a Node script',async()=>{
 await fs.access(auto,constants.X_OK);
 assert.deepEqual([...(await fs.readFile(auto)).subarray(0,4)],[0x7f,0x45,0x4c,0x46]);
});
test('GNOME KDE Hyprland select X11 Wayland or automatic fallback',async(t)=>{
 if(process.getuid?.()===0){t.skip('launcher deliberately rejects root');return;}
 const f=await fixture();
 const cases=[
  [{XDG_CURRENT_DESKTOP:'Hyprland',XDG_SESSION_TYPE:'wayland',WAYLAND_DISPLAY:'wayland-0'},'wayland|hyprland|wayland'],
  [{XDG_CURRENT_DESKTOP:'GNOME',XDG_SESSION_TYPE:'wayland',WAYLAND_DISPLAY:'wayland-0'},'wayland|gnome|wayland'],
  [{XDG_CURRENT_DESKTOP:'KDE:Plasma',XDG_SESSION_TYPE:'x11',DISPLAY:':5'},'x11|kde|x11'],
  [{XDG_CURRENT_DESKTOP:'GNOME-Classic',XDG_SESSION_TYPE:'x11',DISPLAY:':7'},'x11|gnome|x11'],
  [{XDG_CURRENT_DESKTOP:'KDE',XDG_SESSION_TYPE:'wayland',XDG_RUNTIME_DIR:'/run/user/123'},'wayland|kde|wayland'],
  [{XDG_CURRENT_DESKTOP:'unknown',XDG_SESSION_TYPE:'',DISPLAY:':5'},'auto|unknown|auto'],
  [{XDG_CURRENT_DESKTOP:'GNOME:KDE',XDG_SESSION_TYPE:'x11',DISPLAY:':5'},'x11|unknown|x11'],
  [{XDG_CURRENT_DESKTOP:'Hyprland',XDG_SESSION_TYPE:'x11',DISPLAY:':5'},'auto|hyprland|auto'],
  [{XDG_CURRENT_DESKTOP:'GNOME',XDG_SESSION_TYPE:'wayland'},'auto|gnome|auto']
 ];
 for(const [env,expected] of cases){
  const result=f.run(env);
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout.trim(),'--ozone-platform='+expected);
 }
});
test('native Auto warns only for observed restrictive host hints without bypass or leaking paths',async(t)=>{
 if(process.getuid?.()===0){t.skip('launcher deliberately rejects root');return;}
 const f=await fixture();
 const env={XDG_CURRENT_DESKTOP:'GNOME',XDG_SESSION_TYPE:'x11',DISPLAY:':5'};
 const preflight=f.run(env,['--diagnose-sandbox']);
 assert.equal(preflight.status,0);
 assert.equal(preflight.stderr,'');
 const expectedHint=preflight.stdout.match(/^userNamespacePolicyHint=(.+)$/m)?.[1];
 assert.ok(['restriction-indicated','no-obvious-restriction','undetermined'].includes(expectedHint));
 const regular=f.run(env);
 assert.equal(regular.status,0,regular.stderr);
 assert.equal(regular.stdout.trim(),'--ozone-platform=x11|gnome|x11');
 const advisory='OMSI Manager Auto: host sandbox policy may restrict Electron startup; review read-only diagnostics with your administrator. No security setting was changed.\n';
 if(expectedHint==='restriction-indicated')
  assert.equal(regular.stderr,advisory);
 else assert.equal(regular.stderr,'');
 assert.ok(!regular.stderr.includes(f.root));
 assert.ok(!regular.stderr.includes('/proc/'));
 assert.ok(!regular.stderr.includes('--no-sandbox'));
 assert.ok(!regular.stderr.includes('sudo'));
 const refused=f.run(env,['--no-sandbox']);
 assert.equal(refused.status,3);
 assert.equal(refused.stdout,'');
 assert.ok(!refused.stderr.includes('host sandbox policy'));
});

test('native sandbox preflight is explicit, read-only and never executes Electron',async(t)=>{
 if(process.getuid?.()===0){t.skip('launcher deliberately rejects root');return;}
 const f=await fixture();
 // The --diagnose-sandbox mode must work without any app executable.
 await fs.rm(f.target);
 const output=f.run({XDG_CURRENT_DESKTOP:'GNOME'},['--diagnose-sandbox']);
 assert.equal(output.status,0,output.stderr);
 assert.equal(output.stderr,'');
 const lines=output.stdout.trim().split('\n');
 assert.equal(lines[0],'OMSI_MANAGER_SANDBOX_PREFLIGHT_V1');
 assert.equal(lines.length,10);
 const expected={
  apparmorUsernsRestriction:/^(enabled|disabled|unknown|unavailable)$/,
  unprivilegedUsernsSwitch:/^(enabled|disabled|unknown|unavailable)$/,
  usernsCapacity:/^(positive|zero|unknown|unavailable)$/,
  userNamespacePolicyHint:/^(restriction-indicated|no-obvious-restriction|undetermined)$/,
  userNamespaceCreationVerified:/^false$/,
  electronSandboxVerified:/^false$/,
  hostSecurityPolicyChanged:/^false$/,
  securityBypassApplied:/^false$/,
  nextAction:/^review-read-only-diagnostic-with-system-administrator$/
 };
 const results=Object.fromEntries(lines.slice(1).map(line=>{
  const index=line.indexOf('=');
  assert.ok(index>0);
  return [line.slice(0,index),line.slice(index+1)];
 }));
 assert.deepEqual(Object.keys(results).sort(),Object.keys(expected).sort());
 for(const [key,pattern] of Object.entries(expected))
  assert.match(results[key],pattern,key);
 assert.ok(!output.stdout.includes('/proc/'));
 assert.ok(!output.stdout.includes(f.root));
 const blocked=f.run({},['--diagnose-sandbox','--no-sandbox']);
 assert.equal(blocked.status,3);
 assert.equal(blocked.stdout,'');
 const injected=f.run({},['--no-sandbox']);
 assert.equal(injected.status,3);
 assert.equal(injected.stdout,'');
});

test('refuses option injection and symlinked packaged target',async(t)=>{
 if(process.getuid?.()===0){t.skip('launcher deliberately rejects root');return;}
 const f=await fixture();
 const bad=f.run({XDG_CURRENT_DESKTOP:'KDE'},['--no-sandbox']);
 assert.equal(bad.status,3);
 assert.equal(bad.stdout,'');
 const outside=join(f.root,'unrelated');
 await fs.writeFile(outside,'NOT_EXECUTED');
 await fs.rm(f.target);
 await fs.symlink(outside,f.target);
 assert.equal(f.run({XDG_CURRENT_DESKTOP:'KDE'}).status,3);
 assert.equal(await fs.readFile(outside,'utf8'),'NOT_EXECUTED');
});
