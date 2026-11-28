// F4.02c.4 — native CPU rate configuration only; no load or enforcement proof.
// A private empty job avoids changing the CPU allocation of any running process.
// API: https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_cpu_rate_control_information
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bindExecutedResource} from './runtime-resource-test-binding.mjs';
const script=fileURLToPath(new URL('../../native-lab/negresco-windows-cpu-rate-config.ps1',import.meta.url));
test('Windows private empty job accepts and reads back fixed CPU rate caps',t=>{
 if(process.platform!=='win32'){t.diagnostic('Windows CPU rate configuration not executed on this host.');return;}
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:30000,maxBuffer:16384,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.deepEqual(r,{
  scope:'disposable-windows-cpu-rate-config',mechanism:'JobObjectCpuRateControlInformation',
  controlFlags:5,initialRate:2000,reducedRate:500,invalidZeroRejected:true,previousRatePreserved:true,
  restoredRate:10000,configurationReadbackVerified:true,childProcessesAssigned:0,cpuRateThrottleVerified:false,
  processTreeLimitVerified:false,readerLimitIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Native CPU binding: '+JSON.stringify(bindExecutedResource('windowsCpuRateConfig',r,script)));
 t.diagnostic('Windows CPU rate configuration: 20%, 5%, zero rejected, 5% preserved, 100% readback; empty job only; no throttling proof.');
});
