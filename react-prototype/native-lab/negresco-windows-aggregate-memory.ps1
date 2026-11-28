# F4.02b.6: aggregate commit limit in a private job, two owned suspended children.
$ErrorActionPreference='Stop'
$stage='admission'
try {
 if($args.Count -ne 0 -or [Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'refused'}
 $stage='compile'
 Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class NegrescoAggregateMemoryFixture {
 const uint JobMemory=0x200,ActiveCount=8,KillOnClose=0x2000;
 const ulong Cap=192UL*1024*1024,Request=112UL*1024*1024;
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
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool IsProcessInJob(IntPtr process,IntPtr job,[MarshalAs(UnmanagedType.Bool)]out bool inside);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="CreateProcessW")]
 static extern bool CreateProcess(string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref Startup startup,out ProcessInfo info);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr VirtualAllocEx(IntPtr process,IntPtr address,UIntPtr size,uint allocation,uint protection);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool VirtualFreeEx(IntPtr process,IntPtr address,UIntPtr size,uint freeType);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr handle,uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
 public static string Stage="setup";
 public static int Code=0;
 static void Need(bool b,string stage){if(!b){Stage=stage;Code=Marshal.GetLastWin32Error();throw new Exception("fixture refused");}}
 static void Spawn(IntPtr job,out ProcessInfo child){
  string exe=System.IO.Path.Combine(Environment.SystemDirectory,"cmd.exe");
  Startup s=new Startup();s.cb=(uint)Marshal.SizeOf(typeof(Startup));
  Need(CreateProcess(exe,new StringBuilder("\""+exe+"\" /d /c exit 77"),IntPtr.Zero,IntPtr.Zero,false,0x08000004,IntPtr.Zero,Environment.SystemDirectory,ref s,out child),"create-suspended");
  Need(AssignProcessToJobObject(job,child.process),"assign-child");
  bool inside;
  Need(IsProcessInJob(child.process,job,out inside)&&inside,"membership");
  Need(WaitForSingleObject(child.process,0)==258,"child-alive");
 }
 static IntPtr Allocate(ProcessInfo p){return VirtualAllocEx(p.process,IntPtr.Zero,new UIntPtr(Request),0x3000,4);}
 static void Release(ProcessInfo p,ref IntPtr address,string stage){
  if(address!=IntPtr.Zero){Need(VirtualFreeEx(p.process,address,UIntPtr.Zero,0x8000),stage);address=IntPtr.Zero;}
 }
 static void Check(IntPtr job,uint size){
  Extended actual;
  Need(QueryInformationJobObject(job,9,out actual,size,IntPtr.Zero),"query-limit");
  Need((actual.BasicLimitInformation.LimitFlags&(JobMemory|ActiveCount|KillOnClose))==(JobMemory|ActiveCount|KillOnClose)
   &&(actual.BasicLimitInformation.LimitFlags&0x100)==0&&actual.JobMemoryLimit.ToUInt64()==Cap
   &&actual.BasicLimitInformation.ActiveProcessLimit==2,"limit-mismatch");
 }
 static void Cleanup(ProcessInfo p){
  if(p.process!=IntPtr.Zero){
   if(WaitForSingleObject(p.process,0)==258){TerminateProcess(p.process,3);WaitForSingleObject(p.process,5000);}
   CloseHandle(p.process);
  }
  if(p.thread!=IntPtr.Zero)CloseHandle(p.thread);
 }
 public static int Run(){
  Need(Environment.Is64BitProcess,"architecture");
  IntPtr job=CreateJobObject(IntPtr.Zero,null);Need(job!=IntPtr.Zero,"create-job");
  ProcessInfo a=new ProcessInfo(),b=new ProcessInfo();
  IntPtr ma=IntPtr.Zero,mb=IntPtr.Zero;
  try{
   Extended limits=new Extended();
   limits.BasicLimitInformation.LimitFlags=JobMemory|ActiveCount|KillOnClose;
   limits.BasicLimitInformation.ActiveProcessLimit=2;limits.JobMemoryLimit=new UIntPtr(Cap);
   uint size=(uint)Marshal.SizeOf(typeof(Extended));
   Need(SetInformationJobObject(job,9,ref limits,size),"set-limit");
   Check(job,size);
   Spawn(job,out a);Spawn(job,out b);
   // No child is resumed, no data or executable code is written.
   mb=Allocate(b);Need(mb!=IntPtr.Zero,"positive-b-before");Release(b,ref mb,"free-b-before");
   ma=Allocate(a);Need(ma!=IntPtr.Zero,"positive-a-hold");
   mb=Allocate(b);int refusal=Marshal.GetLastWin32Error();
   Need(mb==IntPtr.Zero,"combined-allocation-admitted");
   Code=refusal;Stage="allocation-error";
   if(refusal!=8&&refusal!=14&&refusal!=1455&&refusal!=1816)throw new Exception("unexpected allocation error");
   Release(a,ref ma,"free-a");
   mb=Allocate(b);Need(mb!=IntPtr.Zero,"positive-b-after");Release(b,ref mb,"free-b-after");
   Check(job,size);
   Need(WaitForSingleObject(a.process,0)==258&&WaitForSingleObject(b.process,0)==258,"children-still-alive");
   return refusal;
  }finally{
   // Owned child handles only. Closing the job also terminates both children.
   CloseHandle(job);Cleanup(a);Cleanup(b);
  }
 }
}
'@ -ErrorAction Stop
 $stage='native'
 $code=[NegrescoAggregateMemoryFixture]::Run()
 $report=[ordered]@{
  scope='disposable-windows-aggregate-memory';jobLimitBytes=201326592;individualRequestBytes=117440512
  twoOwnedChildrenAssigned=$true;allChildrenSuspended=$true;individualProcessLimitConfigured=$false
  positiveBefore=$true;firstAllocationHeld=$true;combinedAllocationRefused=$true;refusalWin32Code=$code
  positiveAfterRelease=$true;limitReadbackVerified=$true;aggregateCommitLimitObserved=$true
  hardRssLimitVerified=$false;readerLimitIntegrated=$false;osIsolationVerified=$false;operationsEnabled=$false;realReadsPerformed=$false
 }
 [Console]::Out.WriteLine(($report|ConvertTo-Json -Compress -Depth 3))
 exit 0
}catch{
 $detail=$stage
 if($stage -eq 'native'){$detail=$stage+':'+[NegrescoAggregateMemoryFixture]::Stage+':'+[NegrescoAggregateMemoryFixture]::Code}
 if($detail -cnotmatch '\A[a-zA-Z0-9:-]{1,120}\z'){$detail='unknown'}
 [Console]::Error.WriteLine('NEGRESCO_WINDOWS_AGGREGATE_MEMORY_REFUSED:'+ $detail)
 exit 3
}
