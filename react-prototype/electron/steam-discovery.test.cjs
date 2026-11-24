'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {parseLibraries,discoverSteam}=require('./steam-discovery.cjs');
test('bounded VDF accepts modern and legacy library entries and refuses malformed input',()=>{
 assert.deepEqual(parseLibraries('"libraryfolders" { "0" { "path" "/mnt/games" "apps" { "1" "2" } } "1" "/other" }'),['/mnt/games','/other']);
 for(const x of ['"libraryfolders" {','"libraryfolders" {} junk','"libraryfolders" { "0" "/a" "0" "/b" }','x'.repeat(524289)])
  assert.throws(()=>parseLibraries(x),/INCONCLUSIVE/);
});
test('Steam index finds all three fixed game markers in another synthetic library',async t=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'steam-discovery-'));
 t.after(()=>fs.rm(temp,{recursive:true,force:true}));
 const home=await fs.realpath(temp),root=path.join(home,'.local','share','Steam','steamapps'),extra=path.join(home,'extra');
 await fs.mkdir(root,{recursive:true});
 await fs.writeFile(path.join(root,'libraryfolders.vdf'),JSON.stringify('libraryfolders')+' { "1" { "path" '+JSON.stringify(extra)+' } }');
 const games=[['omsi','OMSI 2','Omsi.exe'],['ets2','Euro Truck Simulator 2','bin/linux_x64/eurotrucks2'],['ats','American Truck Simulator','bin/linux_x64/amtrucks']];
 for(const [game,name,marker] of games){
  const p=path.join(extra,'steamapps','common',name);
  await fs.mkdir(path.dirname(path.join(p,marker)),{recursive:true});
  if(game==='omsi'){await fs.mkdir(path.join(p,'Vehicles'));await fs.mkdir(path.join(p,'maps'));}
  await fs.writeFile(path.join(p,marker),'SYNTHETIC_ONLY');
  // The Linux VDF fixture only runs on Linux (O_NOFOLLOW supported).
  if(process.platform==='linux')assert.deepEqual(await discoverSteam(game,{home,platform:'linux'}),[p]);
 }
});
test('a canceled search fails closed before directory access',async()=>{
 const ctl=new AbortController();ctl.abort();
 await assert.rejects(discoverSteam('omsi',{home:os.homedir(),platform:process.platform},ctl.signal),/cancelada/);
});

test('Linux refuses link targets, incomplete folders and duplicate library aliases',async t=>{
 if(process.platform!=='linux'){t.skip('Linux VDF contract');return;}
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'m69-links-'));
 t.after(()=>fs.rm(temp,{recursive:true,force:true}));
 const home=await fs.realpath(temp),steam=path.join(home,'.local','share','Steam','steamapps');
 const lib=path.join(home,'library'),alias=path.join(home,'linked-library');
 await fs.mkdir(steam,{recursive:true});
 const candidate=path.join(lib,'steamapps','common','OMSI 2');
 await fs.mkdir(path.join(candidate,'Vehicles'),{recursive:true});
 await fs.mkdir(path.join(candidate,'maps'));
 await fs.symlink(lib,alias,'dir');
 const index=path.join(steam,'libraryfolders.vdf');
 await fs.writeFile(index,'"libraryfolders" { "0" '+JSON.stringify(lib)+' "1" '+JSON.stringify(lib)+' "2" '+JSON.stringify(alias)+' }');
 assert.deepEqual(await discoverSteam('omsi',{home,platform:'linux'}),[]);
 await fs.writeFile(path.join(candidate,'Omsi.exe'),'SYNTHETIC');
 assert.deepEqual(await discoverSteam('omsi',{home,platform:'linux'}),[candidate]);
});
test('malformed or oversized Steam index never returns an apparently complete result',async t=>{
 if(process.platform!=='linux'){t.skip('Linux VDF contract');return;}
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'m69-bad-index-'));
 t.after(()=>fs.rm(temp,{recursive:true,force:true}));
 const home=await fs.realpath(temp),steam=path.join(home,'.local','share','Steam','steamapps');
 await fs.mkdir(steam,{recursive:true});
 const index=path.join(steam,'libraryfolders.vdf');
 for(const bytes of ['"libraryfolders" {','x'.repeat(524289)]){
  await fs.writeFile(index,bytes);
  await assert.rejects(discoverSteam('omsi',{home,platform:'linux'}),/INCONCLUSIVE/);
 }
});
