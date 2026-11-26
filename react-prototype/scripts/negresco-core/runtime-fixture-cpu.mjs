// F4.02c.1: sampled process CPU time, not an OS throttle or hard deadline.
export const FIXTURE_CPU_POLICY=Object.freeze({maxCpuMicros:2000000,maxWallMicros:10000000});
const refuse=()=>{throw Error('CORE_FIXTURE_CPU_REFUSED');};
function sample(x){
 if(!x||Object.getPrototypeOf(x)!==Object.prototype||Reflect.ownKeys(x).length!==3)refuse();
 const r={};
 for(const k of ['userMicros','systemMicros','wallMicros']){
  const d=Object.getOwnPropertyDescriptor(x,k);
  if(!d||!Object.hasOwn(d,'value')||!Number.isSafeInteger(d.value)||d.value<0)refuse();
  r[k]=d.value;
 }
 if(!Number.isSafeInteger(r.userMicros+r.systemMicros))refuse();
 return r;
}
export function inspectFixtureCpu(input){
 const r=sample(input),totalCpuMicros=r.userMicros+r.systemMicros;
 const reasons=[];
 if(totalCpuMicros>FIXTURE_CPU_POLICY.maxCpuMicros)reasons.push('cpu-budget');
 if(r.wallMicros>FIXTURE_CPU_POLICY.maxWallMicros)reasons.push('wall-budget');
 return Object.freeze({scope:'synthetic-fixture',sample:Object.freeze(r),totalCpuMicros,decision:reasons.length?'deny':'admit-fixture-only',reasons:Object.freeze(reasons),osCpuLimitVerified:false,hardDeadlineVerified:false,operationsEnabled:false});
}
export function startFixtureCpuObservation(){
 const start=process.cpuUsage(),wall=process.hrtime.bigint();
 return Object.freeze({observe(){
  const cpu=process.cpuUsage(start),elapsed=(process.hrtime.bigint()-wall)/1000n;
  if(elapsed<0n||elapsed>BigInt(Number.MAX_SAFE_INTEGER))refuse();
  return inspectFixtureCpu({userMicros:cpu.user,systemMicros:cpu.system,wallMicros:Number(elapsed)});
 }});
}
