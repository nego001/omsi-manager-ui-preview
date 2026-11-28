import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FIXTURE_CPU_POLICY as p,inspectFixtureCpu as inspect,startFixtureCpuObservation as start} from './runtime-fixture-cpu.mjs';
import {createFixtureProcessSupervisor} from './runtime-fixture-supervisor.mjs';
test('CPU and wall time budgets are separate inclusive limits',()=>{
 const x=inspect({userMicros:1500000,systemMicros:500000,wallMicros:p.maxWallMicros});
 assert.equal(x.totalCpuMicros,p.maxCpuMicros);assert.equal(x.decision,'admit-fixture-only');
 assert.deepEqual(x.reasons,[]);assert.ok(Object.isFrozen(x)&&Object.isFrozen(x.sample)&&Object.isFrozen(x.reasons));
 for(const k of ['osCpuLimitVerified','hardDeadlineVerified','operationsEnabled'])assert.equal(x[k],false);
});
test('CPU and wall time excess deny independently and jointly',()=>{
 assert.deepEqual(inspect({userMicros:p.maxCpuMicros,systemMicros:1,wallMicros:0}).reasons,['cpu-budget']);
 assert.deepEqual(inspect({userMicros:0,systemMicros:0,wallMicros:p.maxWallMicros+1}).reasons,['wall-budget']);
 const r=inspect({userMicros:p.maxCpuMicros+1,systemMicros:0,wallMicros:p.maxWallMicros+1});
 assert.deepEqual(r.reasons,['cpu-budget','wall-budget']);assert.equal(r.decision,'deny');
});
test('invalid CPU samples and accessors refused without invocation',()=>{
 const base={userMicros:1,systemMicros:2,wallMicros:3};let invoked=false;
 const bad={...base};Object.defineProperty(bad,'userMicros',{get(){invoked=true;return 1}});
 for(const x of [bad,{...base,systemMicros:-1},{...base,wallMicros:1.5},{...base,userMicros:Number.MAX_SAFE_INTEGER},{...base,extra:0},{...base,wallMicros:Infinity}])assert.throws(()=>inspect(x),/CORE_FIXTURE_CPU_REFUSED/);
 assert.equal(invoked,false);
});
test('actual bounded CPU observation uses monotonic wall time',()=>{
 const o=start(),a=o.observe();let checksum=0;
 for(let i=0;i<50000;i++)checksum=(checksum+i)>>>0;
 const b=o.observe();
 assert.equal(checksum,1249975000);assert.ok(b.sample.wallMicros>=a.sample.wallMicros);
 assert.ok(b.totalCpuMicros>=a.totalCpuMicros);assert.equal(b.totalCpuMicros,b.sample.userMicros+b.sample.systemMicros);
 assert.equal(b.osCpuLimitVerified,false);
});
test('actual separate Reader job publishes validated sampled CPU accounting',async()=>{
 const s=createFixtureProcessSupervisor();const r=await s.analyze({scope:'synthetic-fixture',scenario:'missing-reference'});
 assert.equal(r.state,'fixture-worker-report');
 const cpu=r.report.cpuObservation;
 assert.deepEqual(cpu,inspect(cpu.sample));assert.equal(cpu.decision,'admit-fixture-only');
 assert.equal(cpu.osCpuLimitVerified,false);assert.equal(cpu.hardDeadlineVerified,false);
 assert.equal(r.report.operationsEnabled,false);s.dispose();
});
