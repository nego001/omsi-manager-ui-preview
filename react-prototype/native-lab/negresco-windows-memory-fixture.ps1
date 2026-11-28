# F4.02b.2: disposable Windows process memory limit, never used by Electron.
$ErrorActionPreference='Stop'
$stage='admission'
try {
 if($args.Count -ne 0 -or [Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'refused'}
 $stage='compile'
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class NegrescoWindowsMemoryFixture {
 const uint ProcessMemoryFlag=0x100;
 const uint MemCommitReserve=0x3000, MemRelease=0x8000, PageReadWrite=4;
 const ulong Cap=512UL*1024*1024, Small=8UL*1024*1024;
 [StructLayout(LayoutKind.Sequential)] struct Basic {
  public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
  public uint LimitFlags;
  public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
  public uint ActiveProcessLimit;
  public UIntPtr Affinity;
  public uint PriorityClass, SchedulingClass;
 }
 [StructLayout(LayoutKind.Sequential)] struct Io {
  public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
  public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
 }
 [StructLayout(LayoutKind.Sequential)] struct Extended {
  public Basic BasicLimitInformation;
  public Io IoInfo;
  public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
 static extern IntPtr CreateJobObject(IntPtr security,string name);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool SetInformationJobObject(IntPtr job,int kind,ref Extended info,uint length);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool QueryInformationJobObject(IntPtr job,int kind,out Extended info,uint length,IntPtr returned);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool IsProcessInJob(IntPtr process,IntPtr job,[MarshalAs(UnmanagedType.Bool)]out bool inside);
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern IntPtr VirtualAlloc(IntPtr address,UIntPtr size,uint allocation,uint protection);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool VirtualFree(IntPtr address,UIntPtr size,uint freeType);
 public static string Stage="setup";
 public static int Code=0;
 static void Need(bool b,string stage){if(!b){Stage=stage;Code=Marshal.GetLastWin32Error();throw new Exception("fixture refused");}}
 static void Control(string stage){
  Stage=stage;
  IntPtr mem=VirtualAlloc(IntPtr.Zero,new UIntPtr(Small),MemCommitReserve,PageReadWrite);
  Need(mem!=IntPtr.Zero,stage+"-allocate");
  try{
   Marshal.WriteByte(mem,0,17);Marshal.WriteByte(mem,(int)Small-1,23);
   Need(Marshal.ReadByte(mem,0)==17&&Marshal.ReadByte(mem,(int)Small-1)==23,stage+"-readback");
  }finally{Need(VirtualFree(mem,UIntPtr.Zero,MemRelease),stage+"-release");}
 }
 static void Check(IntPtr job,uint size){
  Extended q;
  Need(QueryInformationJobObject(job,9,out q,size,IntPtr.Zero),"query-limit");
  Need((q.BasicLimitInformation.LimitFlags&ProcessMemoryFlag)!=0&&q.ProcessMemoryLimit.ToUInt64()==Cap,"limit-mismatch");
  bool inside;
  Need(IsProcessInJob(GetCurrentProcess(),job,out inside)&&inside,"membership");
 }
 public static int Run(){
  Need(Environment.Is64BitProcess,"architecture");
  // Job handle is private and only the disposable PowerShell process joins.
  IntPtr job=CreateJobObject(IntPtr.Zero,null);
  Need(job!=IntPtr.Zero,"create-job");
  try{
   Extended limit=new Extended();
   limit.BasicLimitInformation.LimitFlags=ProcessMemoryFlag;
   limit.ProcessMemoryLimit=new UIntPtr(Cap);
   uint size=(uint)Marshal.SizeOf(typeof(Extended));
   Need(SetInformationJobObject(job,9,ref limit,size),"set-limit");
   Need(AssignProcessToJobObject(job,GetCurrentProcess()),"assign-self");
   Check(job,size);
   Control("positive-before");
   Stage="negative-allocation";
   IntPtr mem=VirtualAlloc(IntPtr.Zero,new UIntPtr(Cap),MemCommitReserve,PageReadWrite);
   int error=Marshal.GetLastWin32Error();
   if(mem!=IntPtr.Zero){
    Need(VirtualFree(mem,UIntPtr.Zero,MemRelease),"unexpected-allocation-release");
    Stage="unexpected-admission";Code=0;throw new Exception("fixture refused");
   }
   Code=error;
   if(error!=8&&error!=14&&error!=1455&&error!=1816)throw new Exception("unexpected allocation refusal");
   Control("positive-after");
   Check(job,size);
   return error;
  }finally{Need(CloseHandle(job),"close-job");}
 }
}
'@ -ErrorAction Stop
 $stage='native'
 $code=[NegrescoWindowsMemoryFixture]::Run()
 $report=[ordered]@{
  scope='disposable-windows-memory-fixture';mechanism='JobObjectProcessMemory'
  limitBytes=536870912;positiveBeforeBytes=8388608;refusedRequestBytes=536870912
  refusalWin32Code=$code;positiveAfterBytes=8388608;processCommitLimitObserved=$true
  hardRssLimitVerified=$false;readerLimitIntegrated=$false;processTreeLimitVerified=$false
  killOnJobCloseVerified=$false;operationsEnabled=$false;realReadsPerformed=$false
 }
 [Console]::Out.WriteLine(($report|ConvertTo-Json -Compress -Depth 3))
 exit 0
}catch{
 $detail=$stage
 if($stage -eq 'native'){$detail=$stage+':'+[NegrescoWindowsMemoryFixture]::Stage+':'+[NegrescoWindowsMemoryFixture]::Code}
 if($detail -cnotmatch '\A[a-zA-Z0-9:-]{1,120}\z'){$detail='unknown'}
 [Console]::Error.WriteLine('NEGRESCO_WINDOWS_MEMORY_FIXTURE_REFUSED:'+ $detail)
 exit 3
}
