# F4.02d.5: disposable two-member job with actual descendant inheritance.
$ErrorActionPreference='Stop'
$stage='admission'
try {
 if($args.Count -ne 0 -or [Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'refused'}
 $stage='compile'
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
public static class NegrescoJobTreeFixture {
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
 [DllImport("kernel32.dll",SetLastError=true,EntryPoint="QueryInformationJobObject")]
 static extern bool QueryIds(IntPtr job,int kind,IntPtr buffer,uint size,IntPtr returned);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
 static string Enc(string s){return Convert.ToBase64String(Encoding.Unicode.GetBytes(s));}
 static IntPtr Descendant(IntPtr job,uint parentPid){
  // Allow bounded ABI/accounting headroom, but never accept more than two members.
  int size=8+16*IntPtr.Size;IntPtr buffer=Marshal.AllocHGlobal(size);
  try{
   for(int i=0;i<size;i++)Marshal.WriteByte(buffer,i,0);
   Need(QueryIds(job,3,buffer,(uint)size,IntPtr.Zero),"query-members");
   int assigned=Marshal.ReadInt32(buffer,0),listed=Marshal.ReadInt32(buffer,4);
   Need(assigned==2&&listed==2,"member-count-"+assigned+"-"+listed);
   long a=Marshal.ReadIntPtr(buffer,8).ToInt64(),b=Marshal.ReadIntPtr(buffer,8+IntPtr.Size).ToInt64();
   Need(a!=b&&(a==parentPid||b==parentPid),"parent-membership");
   long pid=a==parentPid?b:a;Need(pid>0&&pid<=uint.MaxValue,"descendant-id");
   // Only query and wait access, never terminate by PID.
   IntPtr handle=OpenProcess(0x100000|0x1000,false,(uint)pid);
   Need(handle!=IntPtr.Zero,"open-descendant");
   bool inside;
   if(!IsProcessInJob(handle,job,out inside)||!inside){CloseHandle(handle);Need(false,"descendant-membership");}
   return handle;
  }finally{Marshal.FreeHGlobal(buffer);}
 }
 static uint[] Trial(bool terminate){
  IntPtr job=IntPtr.Zero,descendant=IntPtr.Zero;
  ProcessInfo parent=new ProcessInfo();
  EventWaitHandle ready=null,release=null;
  try{
   job=CreateJobObject(IntPtr.Zero,null);Need(job!=IntPtr.Zero,"job");
   Extended limit=new Extended();limit.BasicLimitInformation.LimitFlags=0x2000|8;
   limit.BasicLimitInformation.ActiveProcessLimit=2;
   uint size=(uint)Marshal.SizeOf(typeof(Extended));Need(SetInformationJobObject(job,9,ref limit,size),"set");
   Extended actual;Need(QueryInformationJobObject(job,9,out actual,size,IntPtr.Zero),"query");
   Need((actual.BasicLimitInformation.LimitFlags&0x2008)==0x2008&&actual.BasicLimitInformation.ActiveProcessLimit==2,"readback");
   string suffix=Guid.NewGuid().ToString("N"),rn="Local\\NegrescoTreeReady-"+suffix,ln="Local\\NegrescoTreeRelease-"+suffix;
   bool created;ready=new EventWaitHandle(false,EventResetMode.ManualReset,rn,out created);Need(created,"ready-create");
   release=new EventWaitHandle(false,EventResetMode.ManualReset,ln,out created);Need(created,"release-create");
   string exe=System.IO.Path.Combine(Environment.SystemDirectory,"WindowsPowerShell\\v1.0\\powershell.exe");
   string childBody="$ErrorActionPreference='Stop'; $r=[Threading.EventWaitHandle]::OpenExisting('"+rn+"'); $l=[Threading.EventWaitHandle]::OpenExisting('"+ln+"'); $r.Set() | Out-Null; if($l.WaitOne(20000)){exit 77}; exit 78";
   string parentBody="$ErrorActionPreference='Stop'; $s=New-Object Diagnostics.ProcessStartInfo; $s.FileName='"+exe.Replace("'","''")+"'; $s.Arguments='-NoProfile -NonInteractive -EncodedCommand "+Enc(childBody)+"'; $s.UseShellExecute=$false; $s.CreateNoWindow=$true; $p=[Diagnostics.Process]::Start($s); if(!$p.WaitForExit(25000)){exit 78}; if($p.ExitCode -eq 77){exit 77}; exit 79";
   Startup start=new Startup();start.cb=(uint)Marshal.SizeOf(typeof(Startup));
   Need(CreateProcess(exe,new StringBuilder("\""+exe+"\" -NoProfile -NonInteractive -EncodedCommand "+Enc(parentBody)),IntPtr.Zero,IntPtr.Zero,false,0x08000004,IntPtr.Zero,Environment.SystemDirectory,ref start,out parent),"create-parent");
   Need(AssignProcessToJobObject(job,parent.process),"assign-parent");
   bool member;Need(IsProcessInJob(parent.process,job,out member)&&member,"parent-in-job");
   Need(ResumeThread(parent.thread)==1,"resume");
   Need(ready.WaitOne(12000),"descendant-ready");
   descendant=Descendant(job,parent.processId);
   Need(WaitForSingleObject(parent.process,0)==258&&WaitForSingleObject(descendant,0)==258,"both-alive");
   if(terminate){Need(CloseHandle(job),"close-job");job=IntPtr.Zero;}
   else{Need(release.Set(),"release-control");}
   Need(WaitForSingleObject(parent.process,5000)==0,"parent-exit");
   Need(WaitForSingleObject(descendant,5000)==0,"descendant-exit");
   uint p,d;
   Need(GetExitCodeProcess(parent.process,out p),"parent-exit-code");
   Need(GetExitCodeProcess(descendant,out d),"descendant-exit-code");
   if(terminate)Need(p!=77&&p!=78&&p!=79&&p!=259&&d!=77&&d!=78&&d!=259,"non-natural-exits");
   else Need(p==77&&d==77,"control-natural-exits");
   return new uint[]{p,d};
  }finally{
   if(job!=IntPtr.Zero)CloseHandle(job);
   if(parent.process!=IntPtr.Zero){
    if(WaitForSingleObject(parent.process,0)==258){TerminateProcess(parent.process,3);WaitForSingleObject(parent.process,5000);}
    CloseHandle(parent.process);
   }
   if(descendant!=IntPtr.Zero){WaitForSingleObject(descendant,5000);CloseHandle(descendant);}
   if(parent.thread!=IntPtr.Zero)CloseHandle(parent.thread);
   if(ready!=null)ready.Dispose();if(release!=null)release.Dispose();
  }
 }
 public static uint[] Run(){Need(Environment.Is64BitProcess,"architecture");Trial(false);uint[] codes=Trial(true);Trial(false);return codes;}

}
'@ -ErrorAction Stop
 $stage='native'
 $codes=[NegrescoJobTreeFixture]::Run()
 $report=[ordered]@{
  scope='disposable-windows-job-tree';mechanism='JobObjectKillOnClose';activeProcessLimit=2
  positiveBefore=$true;positiveAfter=$true;parentAssignedSuspended=$true;descendantInheritedMembership=$true
  bothReadyAndAlive=$true;lastJobHandleClosed=$true;bothTerminated=$true
  parentExitCode=$codes[0];descendantExitCode=$codes[1]
  arbitraryTreeVerified=$false;readerIntegrated=$false;operationsEnabled=$false;realReadsPerformed=$false
 }
 [Console]::Out.WriteLine(($report|ConvertTo-Json -Compress -Depth 3))
 exit 0
}catch{
 $detail=$stage
 if($stage -eq 'compile'){
  $matchesFound=[regex]::Matches(($_ | Out-String),'(?<![A-Z0-9])CS[0-9]{4}(?![0-9])')
  $codes=@($matchesFound | ForEach-Object {$_.Value} | Select-Object -Unique -First 4)
  if($codes.Count -gt 0){$detail='compile:'+($codes -join ':')}
 }
 if($stage -eq 'native'){$detail=$stage+':'+[NegrescoJobTreeFixture]::Stage+':'+[NegrescoJobTreeFixture]::Code}
 if($detail -cnotmatch '\A[a-zA-Z0-9:-]{1,120}\z'){$detail='unknown'}
 [Console]::Error.WriteLine('NEGRESCO_WINDOWS_JOB_TREE_REFUSED:'+ $detail)
 exit 3
}
