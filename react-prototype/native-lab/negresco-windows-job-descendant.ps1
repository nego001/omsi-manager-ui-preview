# F4.02b.5: fixed child creation test in an unnamed private Job Object.
$ErrorActionPreference='Stop'
$stage='admission'
try {
 if($args.Count -ne 0 -or [Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'refused'}
 $stage='compile'
 Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class NegrescoJobDescendantFixture {
 [StructLayout(LayoutKind.Sequential)] struct Basic {
  public long PerProcessUserTimeLimit,PerJobUserTimeLimit;
  public uint LimitFlags;
  public UIntPtr MinimumWorkingSetSize,MaximumWorkingSetSize;
  public uint ActiveProcessLimit;
  public UIntPtr Affinity;
  public uint PriorityClass,SchedulingClass;
 }
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup {
  public uint cb;
  public string reserved,desktop,title;
  public uint x,y,xSize,ySize,xCount,yCount,fill,flags;
  public ushort showWindow,reserved2Length;
  public IntPtr reserved2,stdIn,stdOut,stdErr;
 }
 [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {
  public IntPtr process,thread;
  public uint processId,threadId;
 }
 [StructLayout(LayoutKind.Sequential)] struct Accounting {
  public long TotalUserTime,TotalKernelTime,ThisPeriodTotalUserTime,ThisPeriodTotalKernelTime;
  public uint TotalPageFaultCount,TotalProcesses,ActiveProcesses,TotalTerminatedProcesses;
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
 static extern IntPtr CreateJobObject(IntPtr security,string name);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool SetInformationJobObject(IntPtr job,int kind,ref Basic info,uint size);
 [DllImport("kernel32.dll",SetLastError=true,EntryPoint="QueryInformationJobObject")]
 static extern bool QueryBasic(IntPtr job,int kind,out Basic info,uint size,IntPtr returned);
 [DllImport("kernel32.dll",SetLastError=true,EntryPoint="QueryInformationJobObject")]
 static extern bool QueryAccounting(IntPtr job,int kind,out Accounting info,uint size,IntPtr returned);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsProcessInJob(IntPtr process,IntPtr job,[MarshalAs(UnmanagedType.Bool)]out bool inside);
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="CreateProcessW")]
 static extern bool CreateProcess(string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref Startup startup,out ProcessInfo info);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr handle,uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
 public static string Stage="setup";
 public static int Code=0;
 static void Need(bool b,string stage){if(!b){Stage=stage;Code=Marshal.GetLastWin32Error();throw new Exception("fixture refused");}}
 static bool Spawn(out ProcessInfo p,out int code){
  string exe=System.IO.Path.Combine(Environment.SystemDirectory,"cmd.exe");
  Startup s=new Startup();s.cb=(uint)Marshal.SizeOf(typeof(Startup));
  bool ok=CreateProcess(exe,new StringBuilder("\""+exe+"\" /d /c exit 77"),IntPtr.Zero,IntPtr.Zero,false,0x08000004,IntPtr.Zero,Environment.SystemDirectory,ref s,out p);
  code=Marshal.GetLastWin32Error();
  return ok;
 }
 static void Cleanup(ProcessInfo p){
  if(p.process!=IntPtr.Zero){
   if(WaitForSingleObject(p.process,0)==258){Need(TerminateProcess(p.process,3),"cleanup-child");Need(WaitForSingleObject(p.process,5000)==0,"cleanup-wait");}
   CloseHandle(p.process);
  }
  if(p.thread!=IntPtr.Zero)CloseHandle(p.thread);
 }
 static void Positive(string stage){
  ProcessInfo p;int code;
  bool ok=Spawn(out p,out code);
  try{Need(ok,stage+"-spawn");Need(WaitForSingleObject(p.process,0)==258,stage+"-alive-suspended");}
  finally{Cleanup(p);}
 }
 static void Check(IntPtr job,uint cap){
  Basic b;Accounting a;
  Need(QueryBasic(job,2,out b,(uint)Marshal.SizeOf(typeof(Basic)),IntPtr.Zero),"query-active-limit");
  Need((b.LimitFlags&8)!=0&&b.ActiveProcessLimit==cap,"active-limit-mismatch");
  Need(QueryAccounting(job,1,out a,(uint)Marshal.SizeOf(typeof(Accounting)),IntPtr.Zero),"query-accounting");
  Need(a.ActiveProcesses==1,"unexpected-active-count");
 }
 public static string Run(){
  Need(Environment.Is64BitProcess,"architecture");
  Positive("outside-job-control");
  IntPtr job=CreateJobObject(IntPtr.Zero,null);Need(job!=IntPtr.Zero,"create-job");
  try{
   Basic limit=new Basic();limit.LimitFlags=8;limit.ActiveProcessLimit=1;
   uint size=(uint)Marshal.SizeOf(typeof(Basic));
   Need(SetInformationJobObject(job,2,ref limit,size),"set-active-limit");
   Need(AssignProcessToJobObject(job,GetCurrentProcess()),"assign-self");
   bool inside;Need(IsProcessInJob(GetCurrentProcess(),job,out inside)&&inside,"membership");
   Check(job,1);
   ProcessInfo p;int code;
   bool ok=Spawn(out p,out code);
   string outcome;
   try{
    if(!ok){
     Need(code==5||code==1816,"unexpected-create-error");
     outcome="create-refused-"+code;
    }else{
     Need(WaitForSingleObject(p.process,2000)==0,"descendant-not-blocked");
     outcome="created-but-terminated-before-resume";
    }
   }finally{Cleanup(p);}
   Check(job,1);
   // Same parent, same command, same job: change only active count to 2.
   limit.ActiveProcessLimit=2;
   Need(SetInformationJobObject(job,2,ref limit,size),"raise-limit-for-control");
   Check(job,2);
   ProcessInfo control;int controlCode;
   bool controlOk=Spawn(out control,out controlCode);
   try{
    Need(controlOk,"inside-job-control-spawn");
    Need(WaitForSingleObject(control.process,0)==258,"inside-job-control-alive");
    bool member;
    Need(IsProcessInJob(control.process,job,out member)&&member,"control-membership");
    Accounting a;
    Need(QueryAccounting(job,1,out a,(uint)Marshal.SizeOf(typeof(Accounting)),IntPtr.Zero)&&a.ActiveProcesses==2,"control-active-count");
   }finally{Cleanup(control);}
   limit.ActiveProcessLimit=1;
   Need(SetInformationJobObject(job,2,ref limit,size),"restore-limit");
   Check(job,1);
   return outcome;
  }finally{CloseHandle(job);}
 }
}
'@ -ErrorAction Stop
 $stage='native'
 $outcome=[NegrescoJobDescendantFixture]::Run()
 $report=[ordered]@{
  scope='disposable-windows-job-descendant';activeProcessLimit=1
  outsideJobPositiveControl=$true;descendantAttemptOutcome=$outcome
  insideJobRaisedLimitPositiveControl=$true;controlChildMembershipVerified=$true
  restoredLimitVerified=$true;descendantLimitObserved=$true;allChildrenCreatedSuspended=$true
  aggregateAllocationRefusalVerified=$false;readerLimitIntegrated=$false;osIsolationVerified=$false
  operationsEnabled=$false;realReadsPerformed=$false
 }
 [Console]::Out.WriteLine(($report|ConvertTo-Json -Compress -Depth 3))
 exit 0
}catch{
 $detail=$stage
 if($stage -eq 'native'){$detail=$stage+':'+[NegrescoJobDescendantFixture]::Stage+':'+[NegrescoJobDescendantFixture]::Code}
 if($detail -cnotmatch '\A[a-zA-Z0-9:-]{1,120}\z'){$detail='unknown'}
 [Console]::Error.WriteLine('NEGRESCO_WINDOWS_JOB_DESCENDANT_REFUSED:'+ $detail)
 exit 3
}
