import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../../native-lab/negresco-windows-cpu-rate-load.ps1',import.meta.url));
test('Windows private job CPU rate cap reduces observed CPU use and restoring rate recovers it',t=>{
 if(process.platform!=='win32'){t.diagnostic('Windows CPU rate load laboratory not executed on this host.');return;}
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:55000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.ok(Number.isInteger(r.logicalProcessors)&&r.logicalProcessors>=1&&r.logicalProcessors<=32);
 for(const phase of ['before','limited','after']){
  const cpu=r[phase+'CpuTicks'],wall=r[phase+'WallTicks'];
  assert.ok(Number.isSafeInteger(cpu)&&Number.isSafeInteger(wall)&&wall>=38000000&&wall<=65000000&&cpu>0&&cpu<=wall*2);
 }
 const before=r.beforeCpuTicks/r.beforeWallTicks,limited=r.limitedCpuTicks/r.limitedWallTicks,after=r.afterCpuTicks/r.afterWallTicks;
 assert.ok(before>=0.5&&after>=0.5);
 assert.ok(limited<=Math.min(before,after)*0.5);
 assert.equal(r.limitedRate,Math.floor(1000/r.logicalProcessors));
 assert.ok(limited<=r.logicalProcessors*r.limitedRate/10000+0.15);
 assert.deepEqual(r,{
  scope:'disposable-windows-cpu-rate-load',mechanism:'JobObjectCpuRateControlInformation',
  controlRate:10000,limitedRate:r.limitedRate,logicalProcessors:r.logicalProcessors,sampleMilliseconds:4000,
  beforeCpuTicks:r.beforeCpuTicks,beforeWallTicks:r.beforeWallTicks,limitedCpuTicks:r.limitedCpuTicks,limitedWallTicks:r.limitedWallTicks,afterCpuTicks:r.afterCpuTicks,afterWallTicks:r.afterWallTicks,
  sameOwnedChild:true,readyObserved:true,rateReadbackVerified:true,differentialObserved:true,
  exactCpuRateGuaranteeVerified:false,processTreeLimitVerified:false,readerLimitIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Windows CPU rate load: '+JSON.stringify(r));
});
