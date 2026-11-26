# F4.02b.3: disposable job lifecycle. Only a child created by this fixture is assigned.
$ErrorActionPreference='Stop'
$stage='admission'
try {
 if($args.Count -ne 0 -or [Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'refused'}
 $stage='compile'
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class NegrescoJobLifecycleFixture {
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
  public Basic BasicLimitInformation; public Io IoInfo;
  public UIntPtr ProcessMemoryLimit,JobMemoryLimit,PeakProcessMemoryUsed,PeakJobMemoryUsed;
 }
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup {
  public uint cb;
  public string reserved,desktop,title;
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
 static extern bool CreateProcess(string app,StringBuilder command,IntPtr processAttrs,IntPtr threadAttrs,bool inherit,uint flags,IntPtr env,string cwd,ref Startup startup,out ProcessInfo info);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr handle,out uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr handle,uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
 public static string Stage="setup";
 public static int Code=0;
 static void Need(bool condition,string stage){if(!condition){Stage=stage;Code=Marshal.GetLastWin32Error();throw new Exception("fixture refused");}}
 public static uint Run(){
  const uint KillOnClose=0x2000,ActiveProcess=8,CommitLimit=0x200;
  const uint WaitTimeout=258;
  const ulong JobCap=512UL*1024*1024;
  IntPtr job=IntPtr.Zero;
  ProcessInfo child=new ProcessInfo();
  bool exited=false;
  try{
   Need(Environment.Is64BitProcess,"architecture");
   job=CreateJobObject(IntPtr.Zero,null);Need(job!=IntPtr.Zero,"create-job");
   Extended limits=new Extended();
   limits.BasicLimitInformation.LimitFlags=KillOnClose|ActiveProcess|CommitLimit;
   limits.BasicLimitInformation.ActiveProcessLimit=1;
   limits.JobMemoryLimit=new UIntPtr(JobCap);
   uint size=(uint)Marshal.SizeOf(typeof(Extended));
   Need(SetInformationJobObject(job,9,ref limits,size),"set-job-limits");
   Extended actual;
   Need(QueryInformationJobObject(job,9,out actual,size,IntPtr.Zero),"query-job-limits");
   Need((actual.BasicLimitInformation.LimitFlags&(KillOnClose|ActiveProcess|CommitLimit))==(KillOnClose|ActiveProcess|CommitLimit)
    &&actual.BasicLimitInformation.ActiveProcessLimit==1&&actual.JobMemoryLimit.ToUInt64()==JobCap,"verify-job-limits");
   // Fixed system executable and fixed benign command; no client arguments or shell.
   string exe=System.IO.Path.Combine(Environment.SystemDirectory,"WindowsPowerShell\\v1.0\\powershell.exe");
   StringBuilder command=new StringBuilder("\""+exe+"\" -NoProfile -NonInteractive -Command \"Start-Sleep -Seconds 20\"");
   Startup start=new Startup();start.cb=(uint)Marshal.SizeOf(typeof(Startup));
   Need(CreateProcess(exe,command,IntPtr.Zero,IntPtr.Zero,false,0x08000004,IntPtr.Zero,Environment.SystemDirectory,ref start,out child),"create-suspended-child");
   Need(AssignProcessToJobObject(job,child.process),"assign-owned-child");
   bool inside;
   Need(IsProcessInJob(child.process,job,out inside)&&inside,"verify-membership");
   Need(ResumeThread(child.thread)==1,"resume-child");
   Need(WaitForSingleObject(child.process,250)==WaitTimeout,"alive-before-close");
   Need(CloseHandle(job),"close-last-job-handle");job=IntPtr.Zero;
   Need(WaitForSingleObject(child.process,5000)==0,"child-exit-after-close");
   exited=true;
   uint code;Need(GetExitCodeProcess(child.process,out code)&&code!=0&&code!=259,"terminated-exit-code");
   return code;
  }finally{
   if(job!=IntPtr.Zero)CloseHandle(job);
   // Failure cleanup targets only the retained handle of the child created above.
   if(child.process!=IntPtr.Zero){
    if(!exited&&WaitForSingleObject(child.process,0)==258){TerminateProcess(child.process,3);WaitForSingleObject(child.process,5000);}
    CloseHandle(child.process);
   }
   if(child.thread!=IntPtr.Zero)CloseHandle(child.thread);
  }
 }
}
'@ -ErrorAction Stop
 $stage='native'
 $code=[NegrescoJobLifecycleFixture]::Run()
 $report=[ordered]@{
  scope='disposable-windows-job-lifecycle';jobCommitLimitBytes=536870912
  activeProcessLimit=1;limitsReadBack=$true;suspendedAssignmentObserved=$true
  ownedChildAliveBeforeClose=$true;ownedChildTerminatedAfterClose=$true;childExitCode=$code
  aggregateAllocationRefusalVerified=$false;descendantLimitVerified=$false
  readerLimitIntegrated=$false;osIsolationVerified=$false;operationsEnabled=$false;realReadsPerformed=$false
 }
 [Console]::Out.WriteLine(($report|ConvertTo-Json -Compress -Depth 3))
 exit 0
}catch{
 $detail=$stage
 if($stage -eq 'native'){$detail=$stage+':'+[NegrescoJobLifecycleFixture]::Stage+':'+[NegrescoJobLifecycleFixture]::Code}
 if($detail -cnotmatch '\A[a-zA-Z0-9:-]{1,120}\z'){$detail='unknown'}
 [Console]::Error.WriteLine('NEGRESCO_WINDOWS_JOB_LIFECYCLE_REFUSED:'+ $detail)
 exit 3
}
