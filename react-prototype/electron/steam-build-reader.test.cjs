'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {parseBuild,readSteamBuild}=require('./steam-build-reader.cjs');
const acf=(id,folder,build)=>'"AppState" { "appid" "'+id+'" "installdir" "'+folder+'" "buildid" "'+build+'" "LastOwner" "PRIVATE_SENTINEL" }';
test('only the matching numeric build ID is projected from each Steam manifest',()=>{
 for(const [game,id,folder] of [['omsi','252530','OMSI 2'],['ets2','227300','Euro Truck Simulator 2'],['ats','270880','American Truck Simulator']])
  assert.equal(parseBuild(acf(id,folder,'12345678'),game),'12345678');
});
test('invalid app IDs, folders, duplicate fields and unsafe build values are rejected',()=>{
 for(const text of [acf('227300','OMSI 2','123'),acf('252530','Other','123'),acf('252530','OMSI 2','x'),acf('252530','OMSI 2','0'),'"AppState" { "buildid" "1" "buildid" "2" }','x'.repeat(131073)])
  assert.throws(()=>parseBuild(text,'omsi'));
});
test('Linux reads only matching fixed manifest, never executable contents',async t=>{
 if(process.platform!=='linux'){t.skip('Linux reader');return;}
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'m77-build-'));
 t.after(()=>fs.rm(tmp,{recursive:true,force:true}));
 const base=await fs.realpath(tmp),steam=path.join(base,'steamapps'),candidate=path.join(steam,'common','OMSI 2'),manifest=path.join(steam,'appmanifest_252530.acf');
 await fs.mkdir(candidate,{recursive:true});
 assert.equal(await readSteamBuild('omsi',candidate,'linux'),null);
 await fs.writeFile(manifest,acf('252530','OMSI 2','12345678'));
 assert.equal(await readSteamBuild('omsi',candidate,'linux'),'12345678');
 assert.equal(await readSteamBuild('omsi',candidate,'win32'),null);
 await fs.unlink(manifest);
 const target=path.join(base,'other.acf');
 await fs.writeFile(target,acf('252530','OMSI 2','999'));
 await fs.symlink(target,manifest);
 assert.equal(await readSteamBuild('omsi',candidate,'linux'),null);
 const ctl=new AbortController();ctl.abort();
 await assert.rejects(readSteamBuild('omsi',candidate,'linux',ctl.signal),/cancelada/);
});
