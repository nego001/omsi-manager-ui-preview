// F4.02c.4 — native CPU rate configuration only; no load or enforcement proof.
// A private empty job avoids changing the CPU allocation of any running process.
// API: https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_cpu_rate_control_information
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const fixture=String.raw`
$ErrorActionPreference='Stop'
try {
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class NegrescoCpuRateFixture {
 [StructLayout(LayoutKind.Sequential)] struct Rate {
  public uint ControlFlags,CpuRate;
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
 static extern IntPtr CreateJobObject(IntPtr security,string name);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool SetInformationJobObject(IntPtr job,int kind,ref Rate info,uint length);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool QueryInformationJobObject(IntPtr job,int kind,out Rate info,uint length,IntPtr returned);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool CloseHandle(IntPtr handle);
 public static string Stage="setup";
 public static int Code=0;
 static void Need(bool ok,string stage){if(!ok){Stage=stage;Code=Marshal.GetLastWin32Error();throw new Exception("fixture refused");}}
 static void Check(IntPtr job,uint rate){
  Rate q;
  Need(QueryInformationJobObject(job,15,out q,8,IntPtr.Zero),"query");
  Need(q.ControlFlags==5&&q.CpuRate==rate,"readback");
 }
 static void Set(IntPtr job,uint rate){
  Rate r=new Rate();r.ControlFlags=5;r.CpuRate=rate;
  Need(SetInformationJobObject(job,15,ref r,8),"set-"+rate);
  Check(job,rate);
 }
 public static void Run(){
  Need(Marshal.SizeOf(typeof(Rate))==8,"layout");
  IntPtr job=CreateJobObject(IntPtr.Zero,null);Need(job!=IntPtr.Zero,"create");
  try{
   Set(job,2000);Set(job,500);
   Rate invalid=new Rate();invalid.ControlFlags=5;invalid.CpuRate=0;
   bool accepted=SetInformationJobObject(job,15,ref invalid,8);
   int code=Marshal.GetLastWin32Error();
   Need(!accepted&&code==87,"invalid-zero");
   Check(job,500);
   Set(job,10000);
  }finally{Need(CloseHandle(job),"close");}
 }
}
'@ -ErrorAction Stop
 [NegrescoCpuRateFixture]::Run()
 $report=[ordered]@{
  scope='disposable-windows-cpu-rate-config';mechanism='JobObjectCpuRateControlInformation'
  controlFlags=5;initialRate=2000;reducedRate=500;invalidZeroRejected=$true
  previousRatePreserved=$true;restoredRate=10000;configurationReadbackVerified=$true
  childProcessesAssigned=0;cpuRateThrottleVerified=$false;processTreeLimitVerified=$false
  readerLimitIntegrated=$false;operationsEnabled=$false;realReadsPerformed=$false
 }
 [Console]::Out.WriteLine(($report|ConvertTo-Json -Compress))
 exit 0
}catch{
 $detail='compile-or-native'
 if('NegrescoCpuRateFixture' -as [type]){$detail=[NegrescoCpuRateFixture]::Stage+':'+[NegrescoCpuRateFixture]::Code}
 if($detail -cnotmatch '\A[a-zA-Z0-9:-]{1,120}\z'){$detail='unknown'}
 [Console]::Error.WriteLine('NEGRESCO_WINDOWS_CPU_RATE_REFUSED:'+ $detail)
 exit 3
}
`;
test('Windows private empty job accepts and reads back fixed CPU rate caps',t=>{
 if(process.platform!=='win32'){t.diagnostic('Windows CPU rate configuration not executed on this host.');return;}
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(fixture,'utf16le').toString('base64')],{encoding:'utf8',timeout:30000,maxBuffer:16384,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);
 assert.deepEqual(JSON.parse(p.stdout),{
  scope:'disposable-windows-cpu-rate-config',mechanism:'JobObjectCpuRateControlInformation',
  controlFlags:5,initialRate:2000,reducedRate:500,invalidZeroRejected:true,previousRatePreserved:true,
  restoredRate:10000,configurationReadbackVerified:true,childProcessesAssigned:0,cpuRateThrottleVerified:false,
  processTreeLimitVerified:false,readerLimitIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Windows CPU rate configuration: 20%, 5%, zero rejected, 5% preserved, 100% readback; empty job only; no throttling proof.');
});
