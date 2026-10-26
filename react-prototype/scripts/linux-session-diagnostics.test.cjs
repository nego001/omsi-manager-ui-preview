'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const net=require('node:net');
const {spawnSync}=require('node:child_process');
const {diagnose,inspectSocket,chooseSocket,parseFileChooserVersion,probeFileChooserVersion}=require('./linux-session-diagnostics.cjs');
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
