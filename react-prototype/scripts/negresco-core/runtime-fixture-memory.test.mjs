import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {FIXTURE_MEMORY_POLICY as p,FIXTURE_V8_ARGS as args,inspectFixtureMemory as inspect} from './runtime-fixture-memory.mjs';
const MiB=1024*1024;
const sample=()=>({rss:64*MiB,heapTotal:16*MiB,heapUsed:8*MiB,external:2*MiB,arrayBuffers:MiB});
test('memory admission distinguishes samples and explicit buffers from OS guarantees',()=>{
 const r=inspect(sample(),7*MiB);assert.equal(r.decision,'admit-fixture-only');
 assert.deepEqual(r.reasons,[]);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.sample)&&Object.isFrozen(r.reasons));
 for(const k of ['osMemoryLimitVerified','hardRssLimitVerified','realReadsPerformed','operationsEnabled'])assert.equal(r[k],false);
});
test('memory policy denies each independent budget and accumulates reasons',()=>{
 assert.deepEqual(inspect(sample(),7*MiB+1).reasons,['buffer-budget']);
 assert.deepEqual(inspect({...sample(),heapTotal:128*MiB,heapUsed:97*MiB}).reasons,['heap-sample']);
 assert.deepEqual(inspect({...sample(),external:33*MiB}).reasons,['external-sample']);
 assert.deepEqual(inspect({...sample(),rss:257*MiB}).reasons,['rss-sample']);
 assert.deepEqual(inspect({...sample(),rss:257*MiB,external:33*MiB},9*MiB).reasons,['buffer-budget','external-sample','rss-sample']);
});
test('memory samples refuse malformed values and never invoke accessors',()=>{
 const a=sample();let called=false;Object.defineProperty(a,'rss',{get(){called=true;return 0}});
 for(const x of [a,{...sample(),heapUsed:-1},{...sample(),heapUsed:17*MiB},{...sample(),arrayBuffers:3*MiB},{...sample(),rss:Infinity},{...sample(),extra:true}])assert.throws(()=>inspect(x),/CORE_FIXTURE_MEMORY_REFUSED/);
 assert.equal(called,false);
 for(const n of [-1,1.5,Infinity])assert.throws(()=>inspect(sample(),n),/CORE_FIXTURE_MEMORY_REFUSED/);
});
test('fixed child launch observes V8 heap limit and external buffer accounting',t=>{
 const url=new URL('./runtime-fixture-memory.mjs',import.meta.url).href;
 const code='import {getHeapStatistics} from "node:v8"; import {inspectFixtureMemory as inspect} from '+JSON.stringify(url)+'; const before=process.memoryUsage(); const request=4*1024*1024; if(inspect(before,request).decision!=="admit-fixture-only")process.exit(3); const b=Buffer.alloc(request,7); const after=process.memoryUsage(); console.log(JSON.stringify({heapLimit:getHeapStatistics().heap_size_limit,bufferDelta:after.arrayBuffers-before.arrayBuffers,externalDelta:after.external-before.external,rss:after.rss,admission:inspect(after).decision,guard:b[0]}));';
 const child=spawnSync(process.execPath,[...args,'--input-type=module','-e',code],{encoding:'utf8',timeout:10000,maxBuffer:4096,windowsHide:true,env:process.platform==='win32'?{SystemRoot:process.env.SystemRoot||'C:\\Windows'}:{}});
 assert.equal(child.error,undefined);assert.equal(child.status,0,child.stderr);assert.equal(child.stderr,'');
 const r=JSON.parse(child.stdout);assert.ok(r.heapLimit>=p.oldSpaceMiB*MiB&&r.heapLimit<=256*MiB);
 assert.ok(r.bufferDelta>=4*MiB&&r.externalDelta>=4*MiB);assert.ok(r.rss>0);
 assert.equal(r.admission,'admit-fixture-only');assert.equal(r.guard,7);
 t.diagnostic('V8 heap limit observed: '+r.heapLimit+' bytes; external buffer delta: '+r.bufferDelta+' bytes; no hard RSS limit claimed.');
});
test('valid job without required V8 launch option cannot run worker',()=>{
 const worker=fileURLToPath(new URL('./runtime-fixture-worker.mjs',import.meta.url));
 const child=spawnSync(process.execPath,[worker],{input:JSON.stringify({scope:'synthetic-fixture',scenario:'clean-reference',jobId:'a'.repeat(32)}),encoding:'utf8',timeout:10000,maxBuffer:4096,windowsHide:true});
 assert.equal(child.error,undefined);assert.equal(child.status,3);assert.equal(child.stdout,'');assert.equal(child.stderr,'');
});
