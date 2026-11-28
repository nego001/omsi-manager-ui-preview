# Disposable Windows CPU rate differential experiment. Fixed owned child only.
$ErrorActionPreference='Stop'
$stage='admission'
$tempRoot=$null
try {
 if($args.Count -ne 0 -or [Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'refused'}
 $stage='compile'
 Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class NegrescoWindowsCpuRateLoad {
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
 [StructLayout(LayoutKind.Sequential)] struct Rate {public uint ControlFlags,CpuRate;}
 [DllImport("kernel32.dll",SetLastError=true,EntryPoint="SetInformationJobObject")]
 static extern bool SetRate(IntPtr job,int kind,ref Rate info,uint size);
 [DllImport("kernel32.dll",SetLastError=true,EntryPoint="QueryInformationJobObject")]
 static extern bool QueryRate(IntPtr job,int kind,out Rate info,uint size,IntPtr returned);
 [DllImport("kernel32.dll")] static extern uint GetActiveProcessorCount(ushort group);
 static void Cap(IntPtr job,uint rate){
  Rate r=new Rate();r.ControlFlags=5;r.CpuRate=rate;
  Need(SetRate(job,15,ref r,8),"set-rate-"+rate);
  Rate q;Need(QueryRate(job,15,out q,8,IntPtr.Zero),"query-rate");
  Need(q.ControlFlags==5&&q.CpuRate==rate,"rate-readback");
 }
 static long Cpu(IntPtr process){
  long c,e,k,u;Need(GetProcessTimes(process,out c,out e,out k,out u),"process-times");
  return checked(k+u);
 }
 static long[] Sample(IntPtr child,string phase){
  System.Threading.Thread.Sleep(700);
  Need(WaitForSingleObject(child,0)==258,phase+"-alive-before");
  long start=Cpu(child);
  var watch=System.Diagnostics.Stopwatch.StartNew();
  System.Threading.Thread.Sleep(4000);
  long end=Cpu(child);watch.Stop();
  Need(WaitForSingleObject(child,0)==258,phase+"-alive-after");
  long wall=watch.Elapsed.Ticks,delta=end-start;
  Need(wall>=38000000L&&wall<=65000000L,phase+"-wall-"+wall);
  Need(delta>0&&delta<=wall*2,phase+"-cpu-"+delta+"-wall-"+wall);
  return new long[]{delta,wall};
 }
 public static long[] Run(string exe){
  Need(Environment.Is64BitProcess,"architecture");
  uint processors=GetActiveProcessorCount(0xffff);
  Need(processors>=1&&processors<=32,"unsupported-processor-count-"+processors);
  IntPtr job=CreateJobObject(IntPtr.Zero,null);Need(job!=IntPtr.Zero,"job");
  ProcessInfo child=new ProcessInfo();
  System.Threading.EventWaitHandle ready=null;
  try{
   Extended limit=new Extended();limit.BasicLimitInformation.LimitFlags=0x2000|8;limit.BasicLimitInformation.ActiveProcessLimit=1;
   uint size=(uint)Marshal.SizeOf(typeof(Extended));
   Need(SetInformationJobObject(job,9,ref limit,size),"set-job");
   Cap(job,10000);
   string name="Local\\NegrescoCpuRate-"+Guid.NewGuid().ToString("N");
   ready=new System.Threading.EventWaitHandle(false,System.Threading.EventResetMode.ManualReset,name);
   Startup start=new Startup();start.cb=(uint)Marshal.SizeOf(typeof(Startup));
   Need(CreateProcess(exe,new StringBuilder("\""+exe+"\" "+name),IntPtr.Zero,IntPtr.Zero,false,4,IntPtr.Zero,Environment.SystemDirectory,ref start,out child),"create");
   Need(AssignProcessToJobObject(job,child.process),"assign");
   bool inside;Need(IsProcessInJob(child.process,job,out inside)&&inside,"membership");
   Need(ResumeThread(child.thread)==1,"resume");
   if(!ready.WaitOne(10000)){
    uint exit;Need(GetExitCodeProcess(child.process,out exit),"ready-exit-query");
    Need(false,"ready-exit-"+exit);
   }
   long[] before=Sample(child.process,"before");
   // Target approximately 0.1 logical core, accounting for host CPU count.
   uint limitedRate=1000/processors;
   Cap(job,limitedRate);
   long[] limited=Sample(child.process,"limited");
   Cap(job,10000);
   long[] after=Sample(child.process,"after");
   double a=(double)before[0]/before[1],b=(double)limited[0]/limited[1],d=(double)after[0]/after[1];
   Need(a>=0.5&&d>=0.5,"insufficient-control-load");
   Need(b<=Math.Min(a,d)*0.5,"no-differential");
   // Empirical tolerance of 0.15 logical core for scheduling granularity; not a hard guarantee.
   Need(b<=processors*(limitedRate/10000.0)+0.15,"observed-rate-excess");
   return new long[]{processors,before[0],before[1],limited[0],limited[1],after[0],after[1],limitedRate};
  }finally{
   CloseHandle(job);
   if(child.process!=IntPtr.Zero){
    if(WaitForSingleObject(child.process,5000)!=0){TerminateProcess(child.process,3);WaitForSingleObject(child.process,5000);}
    CloseHandle(child.process);
   }
   if(child.thread!=IntPtr.Zero)CloseHandle(child.thread);
   if(ready!=null)ready.Dispose();
  }
 }
}
'@ -ErrorAction Stop
 $stage='helper-compile'
 $tempRoot=[IO.Path]::Combine([IO.Path]::GetTempPath(),'NegrescoCpuRate-'+[Guid]::NewGuid().ToString('N'))
 [IO.Directory]::CreateDirectory($tempRoot) | Out-Null
 $helper=[IO.Path]::Combine($tempRoot,'NegrescoCpuRateWorker.exe')
 Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Threading;
using System.Text.RegularExpressions;
public static class NegrescoCpuRateWorker {
 static volatile int sink;
 public static int Main(string[] args){
  try{
   if(args.Length!=1||!Regex.IsMatch(args[0],@"\ALocal\\NegrescoCpuRate-[a-f0-9]{32}\z"))return 79;
   using(var ready=EventWaitHandle.OpenExisting(args[0])){
    var watch=Stopwatch.StartNew();
    int value=sink+1;
    ready.Set();
    while(watch.ElapsedMilliseconds<30000){
     for(int i=0;i<65536;i++)value=unchecked(value*1664525+1013904223);
     sink=value;
    }
    return 77;
   }
  }catch{return 79;}
 }
}
'@ -OutputAssembly $helper -OutputType WindowsApplication -ErrorAction Stop
 $stage='native'
 $samples=[NegrescoWindowsCpuRateLoad]::Run($helper)
 $report=[ordered]@{
  scope='disposable-windows-cpu-rate-load';mechanism='JobObjectCpuRateControlInformation'
  controlRate=10000;limitedRate=$samples[7];logicalProcessors=$samples[0];sampleMilliseconds=4000
  beforeCpuTicks=$samples[1];beforeWallTicks=$samples[2];limitedCpuTicks=$samples[3];limitedWallTicks=$samples[4];afterCpuTicks=$samples[5];afterWallTicks=$samples[6]
  sameOwnedChild=$true;readyObserved=$true;rateReadbackVerified=$true;differentialObserved=$true
  exactCpuRateGuaranteeVerified=$false;processTreeLimitVerified=$false;readerLimitIntegrated=$false
  operationsEnabled=$false;realReadsPerformed=$false
 }
 [Console]::Out.WriteLine(($report|ConvertTo-Json -Compress -Depth 3))
 exit 0
}catch{
 $detail=$stage
 if($stage -eq 'compile' -or $stage -eq 'helper-compile'){
  $matchesFound=[regex]::Matches(($_ | Out-String),'(?<![A-Z0-9])CS[0-9]{4}(?![0-9])')
  $codes=@($matchesFound | ForEach-Object {$_.Value} | Select-Object -Unique -First 4)
  if($codes.Count -gt 0){$detail=$stage+':'+($codes -join ':')}
 }
 if($stage -eq 'native'){$detail=$stage+':'+[NegrescoWindowsCpuRateLoad]::Stage+':'+[NegrescoWindowsCpuRateLoad]::Code}
 if($detail -cnotmatch '\A[a-zA-Z0-9:-]{1,120}\z'){$detail='unknown'}
 [Console]::Error.WriteLine('NEGRESCO_WINDOWS_CPU_RATE_LOAD_REFUSED:'+ $detail)
 exit 3
}
finally{
 if($null -ne $tempRoot -and [IO.Directory]::Exists($tempRoot)){
  try{[IO.Directory]::Delete($tempRoot,$true)}catch{[Console]::Error.WriteLine('NEGRESCO_WINDOWS_CPU_RATE_CLEANUP_REFUSED')}
 }
}
