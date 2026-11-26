# Disposable Windows aggregate user-mode CPU time limit. Fixed owned children only.
$ErrorActionPreference='Stop'
$stage='admission'
try {
 if($args.Count -ne 0 -or [Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'refused'}
 $stage='compile'
 Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class NegrescoWindowsCpuFixture {
 [StructLayout(LayoutKind.Sequential)] struct Basic {
  public long PerProcessUserTimeLimit,PerJobUserTimeLimit;
  public uint LimitFlags;
  public UIntPtr MinimumWorkingSetSize,MaximumWorkingSetSize;
  public uint ActiveProcessLimit;
  public UIntPtr Affinity;
  public uint PriorityClass,SchedulingClass;
 }
 [StructLayout(LayoutKind.Sequential)] struct Io {
  public ulong ReadOperationCount,WriteOperationCount,OtherOperationCount;
  public ulong ReadTransferCount,WriteTransferCount,OtherTransferCount;
 }
 [StructLayout(LayoutKind.Sequential)] struct Extended {
  public Basic BasicLimitInformation;public Io IoInfo;
  public UIntPtr ProcessMemoryLimit,JobMemoryLimit,PeakProcessMemoryUsed,PeakJobMemoryUsed;
 }
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup {
  public uint cb;public string reserved,desktop,title;
  public uint x,y,xSize,ySize,xCount,yCount,fill,flags;
  public ushort showWindow,reserved2Length;
  public IntPtr reserved2,stdIn,stdOut,stdErr;
 }
 [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {
  public IntPtr process,thread;public uint processId,threadId;
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
 static extern IntPtr CreateJobObject(IntPtr security,string name);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool SetInformationJobObject(IntPtr job,int kind,ref Extended info,uint size);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool QueryInformationJobObject(IntPtr job,int kind,out Extended info,uint size,IntPtr returned);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsProcessInJob(IntPtr process,IntPtr job,[MarshalAs(UnmanagedType.Bool)]out bool inside);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="CreateProcessW")]
 static extern bool CreateProcess(string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref Startup startup,out ProcessInfo info);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr handle,out uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr handle,out long creation,out long exit,out long kernel,out long user);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr handle,uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
 public static string Stage="setup";public static int Code=0;
 static void Need(bool b,string stage){if(!b){Stage=stage;Code=Marshal.GetLastWin32Error();throw new Exception("fixture refused");}}
 static long Trial(int seconds,bool denied,string phase){
  IntPtr job=CreateJobObject(IntPtr.Zero,null);Need(job!=IntPtr.Zero,phase+"-job");
  ProcessInfo child=new ProcessInfo();
  try{
   Extended limit=new Extended();
   limit.BasicLimitInformation.LimitFlags=0x2000|4;
   limit.BasicLimitInformation.PerJobUserTimeLimit=seconds*10000000L;
   uint size=(uint)Marshal.SizeOf(typeof(Extended));
   Need(SetInformationJobObject(job,9,ref limit,size),phase+"-set");
   Extended q;
   Need(QueryInformationJobObject(job,9,out q,size,IntPtr.Zero),phase+"-query");
   Need((q.BasicLimitInformation.LimitFlags&0x2004)==0x2004&&q.BasicLimitInformation.PerJobUserTimeLimit==seconds*10000000L,phase+"-limit");
   string exe=System.IO.Path.Combine(Environment.SystemDirectory,"WindowsPowerShell\\v1.0\\powershell.exe");
   // Fixed finite work: natural completion at 4.5 s of user CPU, independent 18 s wall fallback.
   string body="$p=[Diagnostics.Process]::GetCurrentProcess(); $t=[Diagnostics.Stopwatch]::StartNew(); $x=0; while($t.ElapsedMilliseconds -lt 18000){for($i=0;$i -lt 4096;$i++){$x=($x+$i) -band 65535}; $p.Refresh(); if($p.UserProcessorTime.TotalMilliseconds -ge 4500){exit 77}}; exit 78";
   Startup start=new Startup();start.cb=(uint)Marshal.SizeOf(typeof(Startup));
   Need(CreateProcess(exe,new StringBuilder("\""+exe+"\" -NoProfile -NonInteractive -Command \""+body+"\""),IntPtr.Zero,IntPtr.Zero,false,0x08000004,IntPtr.Zero,Environment.SystemDirectory,ref start,out child),phase+"-create");
   Need(AssignProcessToJobObject(job,child.process),phase+"-assign");
   bool inside;Need(IsProcessInJob(child.process,job,out inside)&&inside,phase+"-membership");
   Need(ResumeThread(child.thread)==1,phase+"-resume");
   Need(WaitForSingleObject(child.process,23000)==0,phase+"-wait");
   uint code;Need(GetExitCodeProcess(child.process,out code),phase+"-exit");
   long c,e,k,u;Need(GetProcessTimes(child.process,out c,out e,out k,out u),phase+"-times");
   if(denied){
    Need(code==1816,phase+"-quota-exit");
    Need(WaitForSingleObject(job,1000)==0,phase+"-job-signaled");
    Need(u>=20000000L&&u<45000000L,phase+"-cpu-range");
   }else{
    Need(code==77&&u>=45000000L,phase+"-natural-exit");
   }
   return u;
  }finally{
   CloseHandle(job);
   if(child.process!=IntPtr.Zero){
    if(WaitForSingleObject(child.process,0)==258){TerminateProcess(child.process,3);WaitForSingleObject(child.process,5000);}
    CloseHandle(child.process);
   }
   if(child.thread!=IntPtr.Zero)CloseHandle(child.thread);
  }
 }
 public static long[] Run(){
  Need(Environment.Is64BitProcess,"architecture");
  return new long[]{Trial(8,false,"before"),Trial(2,true,"limited"),Trial(8,false,"after")};
 }
}
'@ -ErrorAction Stop
 $stage='native'
 $samples=[NegrescoWindowsCpuFixture]::Run()
 $report=[ordered]@{
  scope='disposable-windows-cpu-fixture';mechanism='JobObjectJobUserTime'
  controlSeconds=8;limitSeconds=2;naturalExitCode=77;quotaExitCode=1816
  beforeUserTicks=$samples[0];limitedUserTicks=$samples[1];afterUserTicks=$samples[2]
  jobSignaled=$true;positiveBefore=$true;positiveAfter=$true;cpuTimeLimitObserved=$true
  cpuRateThrottleVerified=$false;processTreeLimitVerified=$false;readerLimitIntegrated=$false
  operationsEnabled=$false;realReadsPerformed=$false
 }
 [Console]::Out.WriteLine(($report|ConvertTo-Json -Compress -Depth 3))
 exit 0
}catch{
 $detail=$stage
 if($stage -eq 'native'){$detail=$stage+':'+[NegrescoWindowsCpuFixture]::Stage+':'+[NegrescoWindowsCpuFixture]::Code}
 if($detail -cnotmatch '\A[a-zA-Z0-9:-]{1,120}\z'){$detail='unknown'}
 [Console]::Error.WriteLine('NEGRESCO_WINDOWS_CPU_FIXTURE_REFUSED:'+ $detail)
 exit 3
}
