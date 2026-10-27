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
