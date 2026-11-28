# Disposable Windows file-handle inheritance allowlist. No caller paths.
$ErrorActionPreference='Stop'
$stage='admission'
$root=$null
try{
 if($args.Count -ne 0 -or [Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'refused'}
 $root=[IO.Path]::Combine([IO.Path]::GetTempPath(),'NegrescoHandles-'+[Guid]::NewGuid().ToString('N'))
 [IO.Directory]::CreateDirectory($root)|Out-Null
 $helper=[IO.Path]::Combine($root,'NegrescoHandleWorker.exe')
 $stage='helper-compile'
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Globalization;
public static class NegrescoHandleWorker{
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool ReadFile(IntPtr h,byte[] b,uint n,out uint got,IntPtr overlapped);
 static bool Marker(IntPtr h,string expected){
  byte[] b=new byte[7];uint got;
  return ReadFile(h,b,7,out got,IntPtr.Zero)&&got==7&&System.Text.Encoding.ASCII.GetString(b)==expected;
 }
 public static int Main(string[] args){
  try{
   long a,b;
   if(args.Length!=3||(args[0]!="control"&&args[0]!="restricted")||
      !long.TryParse(args[1],NumberStyles.None,CultureInfo.InvariantCulture,out a)||
      !long.TryParse(args[2],NumberStyles.None,CultureInfo.InvariantCulture,out b)||a<=0||b<=0||a==b)return 79;
   if(!Marker(new IntPtr(a),"allowed"))return 90;
   if(args[0]=="control")return Marker(new IntPtr(b),"fixture")?77:91;
   byte[] bytes=new byte[7];uint got;
   bool ok=ReadFile(new IntPtr(b),bytes,7,out got,IntPtr.Zero);
   int error=Marshal.GetLastWin32Error();
   return !ok&&error==6?81:92;
  }catch{return 79;}
 }
}
'@ -OutputAssembly $helper -OutputType WindowsApplication -ErrorAction Stop
 $stage='broker-compile'
 Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Runtime.InteropServices;
using System.Globalization;
public static class NegrescoHandleFixture{
 [StructLayout(LayoutKind.Sequential)] struct Security{public uint length;public IntPtr descriptor;[MarshalAs(UnmanagedType.Bool)] public bool inherit;}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup{
  public uint cb;public string reserved,desktop,title;
  public uint x,y,xSize,ySize,xCount,yCount,fill,flags;
  public ushort showWindow,reserved2Length;
  public IntPtr reserved2,stdIn,stdOut,stdErr;
 }
 [StructLayout(LayoutKind.Sequential)] struct StartupEx{public Startup startup;public IntPtr attributes;}
 [StructLayout(LayoutKind.Sequential)] struct Proc{public IntPtr process,thread;public uint pid,tid;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateFile(string path,uint access,uint share,ref Security security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetHandleInformation(IntPtr h,out uint flags);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetFilePointerEx(IntPtr h,long offset,out long position,uint method);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,uint flags,ref IntPtr size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
 [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="CreateProcessW")] static extern bool CreateProcess(string app,StringBuilder cmd,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref StartupEx startup,out Proc p);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr h,uint ms);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr h,out uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr h,uint code);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 public static string Stage="setup";public static int Code=0;
 static void Need(bool ok,string stage){if(!ok){Stage=stage;Code=Marshal.GetLastWin32Error();throw new Exception("fixture refused");}}
 static IntPtr Open(string path){
  Security security=new Security();security.length=(uint)Marshal.SizeOf(typeof(Security));security.inherit=true;
  IntPtr h=CreateFile(path,0x80000000,1,ref security,3,0x80,IntPtr.Zero);
  Need(h!=new IntPtr(-1)&&h!=IntPtr.Zero,"open");
  uint flags;
  if(!GetHandleInformation(h,out flags)||(flags&1)==0){CloseHandle(h);Need(false,"inherit-flag");}
  return h;
 }
 static void Trial(string exe,IntPtr a,IntPtr b,bool restricted){
  IntPtr list=IntPtr.Zero,handles=IntPtr.Zero;bool initialized=false;
  Proc p=new Proc();
  try{
   long position;
   Need(SetFilePointerEx(a,0,out position,0)&&position==0,"rewind-a");
   Need(SetFilePointerEx(b,0,out position,0)&&position==0,"rewind-b");
   IntPtr size=IntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);
   Need(size.ToInt64()>0&&size.ToInt64()<65536,"attribute-size");
   list=Marshal.AllocHGlobal(size);
   Need(InitializeProcThreadAttributeList(list,1,0,ref size),"attribute-init");initialized=true;
   int bytes=(restricted?1:2)*IntPtr.Size;
   handles=Marshal.AllocHGlobal(bytes);Marshal.WriteIntPtr(handles,0,a);
   if(!restricted)Marshal.WriteIntPtr(handles,IntPtr.Size,b);
   Need(UpdateProcThreadAttribute(list,0,new IntPtr(0x00020002),handles,new IntPtr(bytes),IntPtr.Zero,IntPtr.Zero),"handle-list");
   StartupEx start=new StartupEx();start.startup.cb=(uint)Marshal.SizeOf(typeof(StartupEx));start.attributes=list;
   string args=(restricted?"restricted":"control")+" "+a.ToInt64().ToString(CultureInfo.InvariantCulture)+" "+b.ToInt64().ToString(CultureInfo.InvariantCulture);
   Need(CreateProcess(exe,new StringBuilder("\""+exe+"\" "+args),IntPtr.Zero,IntPtr.Zero,true,0x00080000,IntPtr.Zero,Environment.SystemDirectory,ref start,out p),"create");
   Need(WaitForSingleObject(p.process,10000)==0,"wait");
   uint code;Need(GetExitCodeProcess(p.process,out code),"exit");
   Need(code==(restricted?81u:77u),(restricted?"restricted":"control")+"-exit-"+code);
  }finally{
   if(p.process!=IntPtr.Zero){
    if(WaitForSingleObject(p.process,0)==258){TerminateProcess(p.process,3);WaitForSingleObject(p.process,5000);}
    CloseHandle(p.process);
   }
   if(p.thread!=IntPtr.Zero)CloseHandle(p.thread);
   if(initialized)DeleteProcThreadAttributeList(list);
   if(list!=IntPtr.Zero)Marshal.FreeHGlobal(list);
   if(handles!=IntPtr.Zero)Marshal.FreeHGlobal(handles);
  }
 }
 public static void Run(string exe){
  Need(Environment.Is64BitProcess,"architecture");
  string root=Path.GetDirectoryName(exe),allowed=Path.Combine(root,"allowed.txt"),sentinel=Path.Combine(root,"sentinel.txt");
  File.WriteAllText(allowed,"allowed");File.WriteAllText(sentinel,"fixture");
  IntPtr a=IntPtr.Zero,b=IntPtr.Zero;
  try{
   a=Open(allowed);b=Open(sentinel);
   Trial(exe,a,b,false);Trial(exe,a,b,true);Trial(exe,a,b,false);
  }finally{if(a!=IntPtr.Zero)CloseHandle(a);if(b!=IntPtr.Zero)CloseHandle(b);}
  Need(File.ReadAllText(allowed)=="allowed"&&File.ReadAllText(sentinel)=="fixture","fixture-changed");
 }
}
'@ -ErrorAction Stop
 $stage='native'
 [NegrescoHandleFixture]::Run($helper)
 $stage='cleanup'
 [IO.Directory]::Delete($root,$true)
 $root=$null
 $report=[ordered]@{
  scope='disposable-windows-file-handle-allowlist';mechanism='PROC_THREAD_ATTRIBUTE_HANDLE_LIST'
  positiveBefore=$true;positiveAfter=$true;bothSourceHandlesInheritable=$true
  explicitHandleListApplied=$true;allowedHandleRead=$true;omittedHandleRefused=$true
  refusalWin32Code=6;fixturesUnchanged=$true;temporaryFilesRemoved=$true
  allHandlesEnumerated=$false;inheritedSocketsVerified=$false;automaticProductionHygieneVerified=$false
  readerIntegrated=$false;operationsEnabled=$false;realReadsPerformed=$false
 }
 [Console]::Out.WriteLine(($report|ConvertTo-Json -Compress))
 exit 0
}catch{
 $detail=$stage
 if($stage -eq 'native'){$detail=$stage+':'+[NegrescoHandleFixture]::Stage+':'+[NegrescoHandleFixture]::Code}
 if($stage -like '*compile'){
  $ids=@([regex]::Matches(($_|Out-String),'CS[0-9]{4}')|ForEach-Object {$_.Value}|Select-Object -Unique -First 4)
  if($ids.Count -gt 0){$detail=$stage+':'+($ids -join ':')}
 }
 if($detail -cnotmatch '\A[a-zA-Z0-9:-]{1,120}\z'){$detail='unknown'}
 [Console]::Error.WriteLine('NEGRESCO_WINDOWS_HANDLE_ALLOWLIST_REFUSED:'+$detail)
 exit 3
}finally{
 if($root -and [IO.Directory]::Exists($root)){
  try{[IO.Directory]::Delete($root,$true)}catch{[Console]::Error.WriteLine('NEGRESCO_WINDOWS_HANDLE_ALLOWLIST_CLEANUP_REFUSED')}
 }
}
