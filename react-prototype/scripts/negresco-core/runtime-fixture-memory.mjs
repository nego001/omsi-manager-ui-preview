// F4.02b: bounded synthetic memory policy. V8 old-space is not an RSS limit.
const MiB=1024*1024;
export const FIXTURE_MEMORY_POLICY=Object.freeze({
 oldSpaceMiB:128,explicitBufferBytes:8*MiB,heapUsedBytes:96*MiB,
 observedRssBytes:256*MiB,observedExternalBytes:32*MiB
});
export const FIXTURE_V8_ARGS=Object.freeze(['--max-old-space-size='+FIXTURE_MEMORY_POLICY.oldSpaceMiB]);
const refused=()=>{throw Error('CORE_FIXTURE_MEMORY_REFUSED');};
export function inspectFixtureMemory(sample,requestedBytes=0){
 if(!sample||Object.getPrototypeOf(sample)!==Object.prototype||
  Reflect.ownKeys(sample).length!==5||!Number.isSafeInteger(requestedBytes)||requestedBytes<0)refused();
 const x={};for(const k of ['rss','heapTotal','heapUsed','external','arrayBuffers']){
  const d=Object.getOwnPropertyDescriptor(sample,k);
  if(!d||!Object.hasOwn(d,'value')||!Number.isSafeInteger(d.value)||d.value<0)refused();
  x[k]=d.value;
 }
 if(x.heapUsed>x.heapTotal||x.arrayBuffers>x.external)refused();
 const p=FIXTURE_MEMORY_POLICY;
 const reasons=[];
 if(requestedBytes>p.explicitBufferBytes||x.arrayBuffers>p.explicitBufferBytes-requestedBytes)reasons.push('buffer-budget');
 if(x.heapUsed>p.heapUsedBytes)reasons.push('heap-sample');
 if(x.external>p.observedExternalBytes||requestedBytes>p.observedExternalBytes-x.external)reasons.push('external-sample');
 if(x.rss>p.observedRssBytes||requestedBytes>p.observedRssBytes-x.rss)reasons.push('rss-sample');
 return Object.freeze({scope:'synthetic-fixture',decision:reasons.length?'deny':'admit-fixture-only',reasons:Object.freeze(reasons),sample:Object.freeze(x),requestedBytes,
  osMemoryLimitVerified:false,hardRssLimitVerified:false,realReadsPerformed:false,operationsEnabled:false});
}
