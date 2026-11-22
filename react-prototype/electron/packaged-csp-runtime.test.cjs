'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {pathToFileURL}=require('node:url');
const helperPath=join(__dirname,'..','scripts','verify-packaged-csp-runtime.mjs');
async function load(){return import(pathToFileURL(helperPath).href);}
const valid='default-src \'none\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https://shared.fastly.steamstatic.com; font-src \'self\' data:; connect-src \'none\'; object-src \'none\'; frame-src \'none\'; worker-src \'none\'; base-uri \'none\'; form-action \'none\'';
test('runtime verifier rejects missing CSP and allows no executed inline/eval/fetch',async()=>{
 const {verifyPackagedCSPRuntime:verify}=await load();
 const accepted={policy:valid,inlineScriptExecuted:false,dynamicScriptExecuted:false,dataFetchAllowed:false};
 await verify({evaluate:async()=>accepted});
 for(const override of [
  {policy:null},
  {policy:"default-src *"},
  {inlineScriptExecuted:true},
  {dynamicScriptExecuted:true},
  {dataFetchAllowed:true},
  {policy:undefined}
 ])await assert.rejects(()=>verify({evaluate:async()=>({...accepted,...override})}),
  /PACKAGED_CSP_RUNTIME_NOT_ENFORCED/);
});
test('runtime checks execute in both packaged Windows and Linux Electron smokes',()=>{
 for(const path of ['portable-linux-smoke.mjs','portable-windows-smoke.mjs']){
  const src=readFileSync(join(__dirname,'..','scripts',path),'utf8');
  assert.match(src,/import \{verifyPackagedCSPRuntime\}/);
  assert.equal((src.match(/await verifyPackagedCSPRuntime\(window\)/g)||[]).length,1,path);
  assert.match(src,/chromiumSandbox:true/);
 }
});
test('runtime CSP probes use no host calls, game folders, or actual external network',()=>{
 const s=readFileSync(helperPath,'utf8');
 assert.match(s,/document\.createElement\('script'\)/);
 assert.match(s,/Function\('return 37'\)/);
 assert.match(s,/fetch\('data:text\/plain,omsi-m61-synthetic'\)/);
 for(const bad of ['https://example.com','http://127.0.0.1','spawn(', 'exec(',
  'writeFile', 'sudo ', 'apparmor_parser','--no-sandbox'])
   assert.equal(s.includes(bad),false,bad);
});
