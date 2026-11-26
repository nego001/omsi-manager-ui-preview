// Fixed synthetic job only. Never loaded by production IPC.
import {createFixtureReaderBridge} from './reader-bridge.mjs';
import {inspectFixtureMemory,FIXTURE_V8_ARGS} from './runtime-fixture-memory.mjs';
import {startFixtureCpuObservation} from './runtime-fixture-cpu.mjs';
const fail=()=>{process.exitCode=3;};
async function main(){
 if(process.argv.length!==2)throw Error('REFUSED');
 const chunks=[];let total=0;
 for await(const chunk of process.stdin){
  total+=chunk.length;if(total>256)throw Error('REFUSED');chunks.push(chunk);
 }
 const wire=Buffer.concat(chunks).toString('utf8');
 const match=/^\{"scope":"synthetic-fixture","scenario":"(missing-reference|clean-reference)","jobId":"([a-f0-9]{32})"\}$/.exec(wire);
 if(!match||match[0]!==wire)throw Error('REFUSED');
 const [,scenario,jobId]=match;
 if(process.execArgv.length!==1||process.execArgv[0]!==FIXTURE_V8_ARGS[0]||inspectFixtureMemory(process.memoryUsage()).decision!=='admit-fixture-only')throw Error('REFUSED');
 const cpu=startFixtureCpuObservation();
 const b=createFixtureReaderBridge({scope:'synthetic-fixture',maxJobs:1});
 try{
  const files=[{path:'a.sui',bytes:Buffer.from('@include "b.sui"'),cfgKind:null}];
  if(scenario==='clean-reference')files.push({path:'b.sui',bytes:Buffer.from('value: 1'),cfgKind:null});
  const r=await b.analyze({scope:'synthetic-fixture',roots:['a.sui'],files,encoding:'utf-8',textureRoots:[],limits:{maxBytes:8192,maxEntries:16,maxReferences:16,maxGraphBytes:65536,maxFindings:16,maxReportBytes:65536},budget:{bytes:8192,entries:16,steps:128,depth:32,durationMs:10000}});
  if(r.state!=='fixture-report-ready'||!b.verify(r.report))throw Error('REFUSED');
  if(inspectFixtureMemory(process.memoryUsage()).decision!=='admit-fixture-only')throw Error('REFUSED');
  const cpuObservation=cpu.observe();
  if(cpuObservation.decision!=='admit-fixture-only')throw Error('REFUSED');
  const report={schemaVersion:1,scope:'synthetic-fixture',scenario,jobId,pid:process.pid,bridgeDigest:r.report.bridgeDigest,fixtureStatus:r.report.fusion.summary.fixtureStatus,findings:r.report.fusion.findings.map(f=>f.code),cpuSample:cpuObservation.sample,operationsEnabled:false,realReadsPerformed:false,productionIntegrated:false};
  process.stdout.write(JSON.stringify(report));
 }finally{b.dispose();}
}
main().catch(fail);
