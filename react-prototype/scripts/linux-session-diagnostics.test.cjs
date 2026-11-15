'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const net=require('node:net');
const {spawnSync}=require('node:child_process');
const {diagnose,detectDesktop,inspectSocket,chooseSocket,parseFileChooserVersion,probeFileChooserVersion,probeElectronUserNamespacePrerequisites,classifyElectronStartupRisk}=require('./linux-session-diagnostics.cjs');
const roots=[];
test.after(async()=>{for(const dir of roots)await fs.rm(dir,{recursive:true,force:true});});
async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-wayland-diagnostic-'));
 roots.push(root);
 const runtime=path.join(root,'xdg');
 await fs.mkdir(runtime,{mode:0o700});
 await fs.chmod(runtime,0o700);
 return {root,runtime,env:{XDG_RUNTIME_DIR:runtime,WAYLAND_DISPLAY:'wayland-0',XDG_SESSION_TYPE:'wayland',XDG_CURRENT_DESKTOP:'Hyprland',OMSI_MANAGER_NATIVE_WAYLAND:'1'}};
}
test('Wayland socket: real Unix socket, no shell or portal required',async()=>{
 const f=await fixture();
 const socket=path.join(f.runtime,'wayland-0');
 const server=net.createServer();
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(socket,resolve);});
 try{
  const data=await diagnose(f.env,{portalProbe:()=> 'registered',fileChooserProbe:()=>4});
  assert.equal(data.waylandSocket,'available');
  assert.equal(data.session,'wayland');
  assert.equal(data.hyprlandReported,true);
  assert.equal(data.portalService,'registered');
  assert.equal(data.portalFileChooserInterface,'advertised');
  assert.equal(data.portalFileChooserVersion,4);
  assert.equal(data.portalPickerVerified,false);
  assert.equal(data.hyprlandCompatibilityVerified,false);
  assert.equal(data.nativeWaylandRequested,true);
  assert.ok(!JSON.stringify(data).includes(f.root),'no filesystem paths in report');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('Wayland socket: nonexistent and non-socket are not marked working',async()=>{
 const f=await fixture();
 assert.equal(await inspectSocket(f.env),'missing');
 await fs.writeFile(path.join(f.runtime,'wayland-0'),'NOT A SOCKET');
 assert.equal(await inspectSocket(f.env),'not-a-socket');
});
test('rejects symlinked socket and insecure runtime',async()=>{
 const f=await fixture();
 const other=path.join(f.root,'outside');
 await fs.writeFile(other,'untouched');
 await fs.symlink(other,path.join(f.runtime,'wayland-0'));
 assert.equal(await inspectSocket(f.env),'not-a-socket');
 assert.equal(await fs.readFile(other,'utf8'),'untouched');
 await fs.chmod(f.runtime,0o777);
 assert.equal(await inspectSocket(f.env),'unsafe-runtime');
});
test('absolute display socket only accepted directly under own runtime',async()=>{
 const f=await fixture();
 assert.equal(chooseSocket(f.runtime,path.join(f.runtime,'wayland-0')).socket,
  path.join(f.runtime,'wayland-0'));
 assert.equal(chooseSocket(f.runtime,path.join(f.root,'outside')).status,'invalid-location');
 for(const display of ['../wayland-0','subdir/wayland-0','../../etc/passwd','wayland-0\n','']){
  const choice=chooseSocket(f.runtime,display);
  assert.equal(choice.status,display===''?'not-configured':'invalid-location');
 }
});
test('unknown portal never becomes proof of picker; x11 and unsupported platforms stay explicit',async()=>{
 const f=await fixture();
 const environment={...f.env,XDG_SESSION_TYPE:'x11',XDG_CURRENT_DESKTOP:'X-Cinnamon'};
 const result=await diagnose(environment,{portalProbe:()=> 'not-running'});
 assert.equal(result.session,'x11');
 assert.equal(result.hyprlandReported,false);
 assert.equal(result.portalService,'not-running');
 assert.equal(result.portalPickerVerified,false);
 assert.deepEqual(await diagnose({}, {platform:'win32'}),{
  name:'omsi-manager-linux-session-diagnostics',scope:'read-only',supported:false
 });
});
test('CLI refuses arguments and does not echo private environment paths',async()=>{
 const f=await fixture();
 const script=path.join(__dirname,'linux-session-diagnostics.cjs');
 const env={...process.env,...f.env};
 const rejected=spawnSync(process.execPath,[script,'--modify'],{env,encoding:'utf8',timeout:10000});
 assert.equal(rejected.status,2);
 assert.equal(rejected.stdout,'');
 const result=spawnSync(process.execPath,[script],{env,encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).scope,'read-only');
 assert.ok(!result.stdout.includes(f.root));
});


test('D-Bus FileChooser version parser fails closed on malformed or ambiguous output',()=>{
 assert.equal(parseFileChooserVersion('method return\n   variant       uint32 4\n'),4);
 for(const output of ['', 'string:version','uint32 4','variant string 4',
   'variant uint32 0','variant uint32 1000',
   'variant uint32 4\nvariant uint32 5',
   'variant uint32 3 /home/private/project',
   'x'.repeat(5000),null]){
  assert.equal(parseFileChooserVersion(output),null);
 }
});
test('read-only D-Bus property probe uses fixed arguments, bounded output and timeout',()=>{
 let calls=0;
 const out=probeFileChooserVersion((cmd,args,options)=>{
  calls++;
  assert.equal(cmd,'dbus-send');
  assert.deepEqual(args.slice(0,3),['--session','--type=method_call','--print-reply']);
  assert.ok(args.includes('org.freedesktop.DBus.Properties.Get'));
  assert.ok(args.includes('string:org.freedesktop.portal.FileChooser'));
  assert.ok(args.includes('string:version'));
  assert.ok(!args.some(a=>/OpenFile|SaveFile|SaveFiles|--system/.test(a)));
  assert.equal(options.timeout,2000);
  assert.equal(options.maxBuffer,4096);
  assert.notEqual(options.shell,true);
  return {status:0,stdout:'method return\n variant uint32 4\n'};
 });
 assert.equal(out,4);
 assert.equal(calls,1);
 assert.equal(probeFileChooserVersion(()=>({status:1,stdout:'variant uint32 4'})),null);
 assert.equal(probeFileChooserVersion(()=>{throw Error('bus unavailable');}),null);
});
test('unregistered portal never triggers passive interface query',async()=>{
 let calls=0;
 const f=await fixture();
 const probe=()=>{calls++;return 4;};
 const absent=await diagnose(f.env,{portalProbe:()=> 'not-running',fileChooserProbe:probe});
 assert.equal(absent.portalService,'not-running');
 assert.equal(absent.portalFileChooserVersion,null);
 assert.equal(absent.portalFileChooserInterface,'unknown');
 assert.equal(absent.portalPickerVerified,false);
 assert.equal(calls,0);
 const unknown=await diagnose(f.env,{portalProbe:()=> 'unknown',fileChooserProbe:probe});
 assert.equal(unknown.portalFileChooserVersion,null);
 assert.equal(calls,0);
 const registered=await diagnose(f.env,{portalProbe:()=> 'registered',fileChooserProbe:probe});
 assert.equal(registered.portalFileChooserVersion,4);
 assert.equal(registered.portalFileChooserInterface,'advertised');
 assert.equal(calls,1);
 assert.equal(registered.portalPickerVerified,false);
});
test('interface missing or invalid version is never reported as picker-ready',async()=>{
 const f=await fixture();
 for(const response of [null,0,-1,1000,'4',NaN]){
  const result=await diagnose(f.env,{portalProbe:()=> 'registered',fileChooserProbe:()=>response});
  assert.equal(result.portalFileChooserInterface,'unknown');
  assert.equal(result.portalFileChooserVersion,null);
  assert.equal(result.portalPickerVerified,false);
 }
});


test('GNOME KDE and Hyprland are classified without leaking desktop strings',async()=>{
 const cases=[
  ['GNOME','gnome'],['ubuntu:GNOME','gnome'],
  ['GNOME-Classic','gnome'],['KDE','kde'],['PLASMA','kde'],
  ['KDE:Plasma','kde'],['Hyprland','hyprland'],['sway','unknown'],
  ['GNOME:KDE','ambiguous'],['GNOME:Hyprland','ambiguous'],
  ['KDE:Hyprland','ambiguous'],['','unknown'],['x'.repeat(300),'unknown']
 ];
 const f=await fixture();
 for(const [token,family] of cases){
  assert.equal(detectDesktop(token),family);
  const result=await diagnose({...f.env,XDG_CURRENT_DESKTOP:token},{
   portalProbe:()=> 'not-running',fileChooserProbe:()=> {throw Error('should not call');},
   inspect:async()=> 'available'
  });
  assert.equal(result.desktopFamily,family);
  assert.equal(result.hyprlandReported,family==='hyprland');
  assert.equal(result.kdeReported,family==='kde');
  assert.equal(result.gnomeReported,family==='gnome');
  assert.equal(result.portalPickerVerified,false);
  assert.equal(Object.hasOwn(result,'XDG_CURRENT_DESKTOP'),false);
  if(token.includes(':')||token.length>256)
   assert.ok(!JSON.stringify(result).includes(token),'raw desktop string must not leak');
 }
});
test('X11 is diagnosed separately from Wayland; no spurious socket probing',async()=>{
 const f=await fixture();
 for(const desktop of ['GNOME','KDE','PLASMA']){
  const environment={...f.env,XDG_CURRENT_DESKTOP:desktop,
   XDG_SESSION_TYPE:'x11',WAYLAND_DISPLAY:'wayland-stale'};
  const report=await diagnose(environment,{portalProbe:()=> 'unknown',
   inspect:async()=> {throw Error('Wayland socket must not be probed on X11');}});
  assert.equal(report.session,'x11');
  assert.equal(report.waylandSocket,'not-applicable');
  assert.equal(report.portalPickerVerified,false);
  assert.equal(report.hyprlandCompatibilityVerified,false);
 }
});

test('Electron namespace diagnostics infer risk only from three fixed read-only proc files',async()=>{
 const paths=[
  '/proc/sys/kernel/apparmor_restrict_unprivileged_userns',
  '/proc/sys/kernel/unprivileged_userns_clone',
  '/proc/sys/user/max_user_namespaces'
 ];
 async function evaluate(inputs){
  const calls=[];
  const report=await probeElectronUserNamespacePrerequisites(async (file,encoding)=>{
   assert.equal(encoding,'utf8');
   assert.ok(paths.includes(file));
   calls.push(file);
   if(inputs[file] instanceof Error)throw inputs[file];
   return inputs[file];
  });
  assert.deepEqual(calls,paths);
  assert.equal(report.userNamespaceCreationVerified,false);
  assert.equal(report.electronSandboxVerified,false);
  assert.equal(report.hostSecurityPolicyChanged,false);
  assert.ok(!JSON.stringify(report).includes('/proc/'));
  return report;
 }
 const normal=await evaluate(Object.fromEntries(paths.map((p,i)=>[p,['0\n','1\n','8192\n'][i]])));
 assert.equal(normal.userNamespacePolicyHint,'no-obvious-restriction');
 assert.equal(normal.apparmorUsernsRestriction,'disabled');
 assert.equal(normal.usernsCapacity,'positive');
 const denied=await evaluate(Object.fromEntries(paths.map((p,i)=>[p,['1','1','8192'][i]])));
 assert.equal(denied.userNamespacePolicyHint,'restriction-indicated');
 const off=await evaluate(Object.fromEntries(paths.map((p,i)=>[p,['0','0','8192'][i]])));
 assert.equal(off.userNamespacePolicyHint,'restriction-indicated');
 const zero=await evaluate(Object.fromEntries(paths.map((p,i)=>[p,['0','1','0'][i]])));
 assert.equal(zero.userNamespacePolicyHint,'restriction-indicated');
 const unknown=await evaluate(Object.fromEntries(paths.map((p,i)=>[p,[new Error('private path'), '1', '8192'][i]])));
 assert.equal(unknown.userNamespacePolicyHint,'undetermined');
 assert.equal(unknown.apparmorUsernsRestriction,'unavailable');
 const privateOutput=await evaluate(Object.fromEntries(paths.map((p,i)=>[p,['/home/private/name','1', '8192'][i]])));
 assert.equal(privateOutput.apparmorUsernsRestriction,'unknown');
 assert.equal(privateOutput.userNamespacePolicyHint,'undetermined');
 assert.ok(!JSON.stringify(privateOutput).includes('/home/private'));
 const malformed=await evaluate(Object.fromEntries(paths.map((p,i)=>[p,['0','1','8e3'][i]])));
 assert.equal(malformed.usernsCapacity,'unknown');
 assert.equal(malformed.userNamespacePolicyHint,'undetermined');
});
test('Linux session report includes only policy hints, never sandbox certification',async()=>{
 const data=await diagnose({XDG_SESSION_TYPE:'x11',XDG_CURRENT_DESKTOP:'GNOME'},{
  platform:'linux',portalProbe:()=> 'not-running',
  sandboxProbe:async()=>({
   apparmorUsernsRestriction:'enabled',
   unprivilegedUsernsSwitch:'enabled',usernsCapacity:'positive',
   userNamespacePolicyHint:'restriction-indicated',
   userNamespaceCreationVerified:false,electronSandboxVerified:false,
   hostSecurityPolicyChanged:false
  })
 });
 assert.equal(data.electronUserNamespacePrerequisites.userNamespacePolicyHint,
  'restriction-indicated');
 assert.equal(data.electronUserNamespacePrerequisites.electronSandboxVerified,false);
 assert.equal(data.portalPickerVerified,false);
 assert.equal(data.hyprlandCompatibilityVerified,false);
});

test('startup risk distinguishes restrictive, permissive and unknown host hints without asserting a cause',()=>{
 const cases=[
  ['restriction-indicated','host-policy-restriction-indicated','review-read-only-findings-with-system-administrator'],
  ['no-obvious-restriction','no-obvious-host-restriction','verify-native-window-with-strict-sandbox'],
  ['undetermined','undetermined','verify-native-window-with-strict-sandbox'],
  ['unexpected','undetermined','verify-native-window-with-strict-sandbox'],
  [null,'undetermined','verify-native-window-with-strict-sandbox']
 ];
 for(const [hint,category,nextAction] of cases){
  const result=classifyElectronStartupRisk({userNamespacePolicyHint:hint});
  assert.equal(result.category,category);
  assert.equal(result.nextAction,nextAction);
  assert.equal(result.electronLaunchVerified,false);
  assert.equal(result.apparmorCausalityProven,false);
  assert.equal(result.securityBypassSuggested,false);
  assert.equal(result.hostPolicyChanged,false);
  assert.ok(Object.isFrozen(result));
 }
});
test('risk classifier never echoes private paths or dangerous policy-bypass suggestions',()=>{
 const secret='/home/private/user/.config/example?token=sensitive';
 for(const input of [
  secret,null,undefined,42,[],
  {userNamespacePolicyHint:secret,stderr:secret},
  {userNamespacePolicyHint:'restriction-indicated',privatePath:secret}
 ]){
  const out=JSON.stringify(classifyElectronStartupRisk(input));
  assert.ok(!out.includes(secret));
  assert.ok(!out.includes('/home/'));
  assert.ok(!out.includes('--no-sandbox'));
  assert.ok(!out.includes('disable-apparmor'));
 }
});
test('Linux opt-in diagnosis includes only bounded host launch guidance, not a success claim',async()=>{
 const result=await diagnose({
  XDG_SESSION_TYPE:'x11',XDG_CURRENT_DESKTOP:'GNOME'
 },{
  platform:'linux',portalProbe:()=> 'not-running',
  sandboxProbe:async()=>({
   apparmorUsernsRestriction:'enabled',
   unprivilegedUsernsSwitch:'enabled',usernsCapacity:'positive',
   userNamespacePolicyHint:'restriction-indicated',
   userNamespaceCreationVerified:false,electronSandboxVerified:false,
   hostSecurityPolicyChanged:false
  })
 });
 assert.equal(result.electronStartupRisk.category,'host-policy-restriction-indicated');
 assert.equal(result.electronStartupRisk.apparmorCausalityProven,false);
 assert.equal(result.electronStartupRisk.electronLaunchVerified,false);
 assert.equal(result.portalPickerVerified,false);
});
