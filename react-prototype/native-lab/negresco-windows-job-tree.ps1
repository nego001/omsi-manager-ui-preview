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
 static void VerifyActiveCount(IntPtr job,IntPtr parent,IntPtr descendant){
  // Accounting can include terminated processes whose references have not been released.
  // Require convergence, not an assumed cause or permission to admit extra processes.
  const int size=48;IntPtr buffer=Marshal.AllocHGlobal(size);
  try{
   var clock=System.Diagnostics.Stopwatch.StartNew();
   int active=0,total=0,terminated=0;
   do{
    for(int i=0;i<size;i++)Marshal.WriteByte(buffer,i,0);
    Need(QueryIds(job,1,buffer,size,IntPtr.Zero),"query-accounting");
    total=Marshal.ReadInt32(buffer,36);active=Marshal.ReadInt32(buffer,40);terminated=Marshal.ReadInt32(buffer,44);
    Need(WaitForSingleObject(parent,0)==258&&WaitForSingleObject(descendant,0)==258,"members-not-alive");
    if(active==2)return;
    Thread.Sleep(50);
   }while(clock.ElapsedMilliseconds<3000);
   Need(false,"active-count-"+active+"-total-"+total+"-terminated-"+terminated);
  }finally{Marshal.FreeHGlobal(buffer);}
 }
 static IntPtr Descendant(IntPtr job,uint parentPid,uint pid){
  Need(pid>0&&pid!=parentPid,"descendant-id");
  IntPtr handle=OpenProcess(0x100000|0x1000,false,pid);
  Need(handle!=IntPtr.Zero,"open-descendant");
  bool inside;
  if(!IsProcessInJob(handle,job,out inside)||!inside){CloseHandle(handle);Need(false,"descendant-membership");}
  return handle;
 }
 static uint[] Trial(bool terminate){
  IntPtr job=IntPtr.Zero,descendant=IntPtr.Zero;
  ProcessInfo parent=new ProcessInfo();
  EventWaitHandle ready=null,release=null;
  System.IO.MemoryMappedFiles.MemoryMappedFile identity=null;
  try{
   job=CreateJobObject(IntPtr.Zero,null);Need(job!=IntPtr.Zero,"job");
   Extended limit=new Extended();limit.BasicLimitInformation.LimitFlags=0x2000|8;
   limit.BasicLimitInformation.ActiveProcessLimit=2;
   uint size=(uint)Marshal.SizeOf(typeof(Extended));Need(SetInformationJobObject(job,9,ref limit,size),"set");
   Extended actual;Need(QueryInformationJobObject(job,9,out actual,size,IntPtr.Zero),"query");
   Need((actual.BasicLimitInformation.LimitFlags&0x2008)==0x2008&&actual.BasicLimitInformation.ActiveProcessLimit==2,"readback");
   string suffix=Guid.NewGuid().ToString("N"),rn="Local\\NegrescoTreeReady-"+suffix,ln="Local\\NegrescoTreeRelease-"+suffix;
   string mapName="Local\\NegrescoTreeIdentity-"+suffix;
   identity=System.IO.MemoryMappedFiles.MemoryMappedFile.CreateNew(mapName,8);
   bool created;ready=new EventWaitHandle(false,EventResetMode.ManualReset,rn,out created);Need(created,"ready-create");
   release=new EventWaitHandle(false,EventResetMode.ManualReset,ln,out created);Need(created,"release-create");
   string exe=System.IO.Path.Combine(Environment.SystemDirectory,"WindowsPowerShell\\v1.0\\powershell.exe");
   string childBody="$ErrorActionPreference='Stop'; $r=[Threading.EventWaitHandle]::OpenExisting('"+rn+"'); $l=[Threading.EventWaitHandle]::OpenExisting('"+ln+"'); $m=[IO.MemoryMappedFiles.MemoryMappedFile]::OpenExisting('"+mapName+"'); $v=$m.CreateViewAccessor(); $v.Write(0,[int]$PID); $v.Dispose(); $m.Dispose(); $r.Set() | Out-Null; if($l.WaitOne(20000)){exit 77}; exit 78";
   string parentBody="$ErrorActionPreference='Stop'; $s=New-Object Diagnostics.ProcessStartInfo; $s.FileName='"+exe.Replace("'","''")+"'; $s.Arguments='-NoProfile -NonInteractive -EncodedCommand "+Enc(childBody)+"'; $s.UseShellExecute=$false; $s.CreateNoWindow=$true; $p=[Diagnostics.Process]::Start($s); if(!$p.WaitForExit(25000)){exit 78}; if($p.ExitCode -eq 77){exit 77}; exit 79";
   Startup start=new Startup();start.cb=(uint)Marshal.SizeOf(typeof(Startup));
   Need(CreateProcess(exe,new StringBuilder("\""+exe+"\" -NoProfile -NonInteractive -EncodedCommand "+Enc(parentBody)),IntPtr.Zero,IntPtr.Zero,false,0x08000004,IntPtr.Zero,Environment.SystemDirectory,ref start,out parent),"create-parent");
   Need(AssignProcessToJobObject(job,parent.process),"assign-parent");
   bool member;Need(IsProcessInJob(parent.process,job,out member)&&member,"parent-in-job");
   Need(ResumeThread(parent.thread)==1,"resume");
   Need(ready.WaitOne(12000),"descendant-ready");
   uint descendantPid;
   using(var view=identity.CreateViewAccessor()){int value=view.ReadInt32(0);Need(value>0,"identity-handshake");descendantPid=(uint)value;}
   descendant=Descendant(job,parent.processId,descendantPid);
   VerifyActiveCount(job,parent.process,descendant);
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
   if(ready!=null)ready.Dispose();if(release!=null)release.Dispose();if(identity!=null)identity.Dispose();
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
  descendantIdentityHandshake=$true;activeCountVerified=$true
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
