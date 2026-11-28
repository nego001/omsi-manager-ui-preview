# Disposable AppContainer file permission experiment. Only generated fixtures.
$ErrorActionPreference='Stop'
$stage='admission'
$root=$null
try{
 if($args.Count -ne 0 -or [Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'refused'}
 $root=[IO.Path]::Combine([IO.Path]::GetTempPath(),'NegrescoFiles-'+[Guid]::NewGuid().ToString('N'))
 [IO.Directory]::CreateDirectory($root)|Out-Null
 $helper=[IO.Path]::Combine($root,'NegrescoFileWorker.exe')
 $stage='helper-compile'
 Add-Type -TypeDefinition @'
using System;
using System.IO;
public static class NegrescoFileWorker{
 static bool Denied(Action action){
  try{action();return false;}
  catch(UnauthorizedAccessException){return true;}
 }
 static bool Marker(string path){return File.ReadAllText(path)=="fixture";}
 public static int Main(string[] args){
  if(args.Length!=1||(args[0]!="control"&&args[0]!="restricted"))return 79;
  try{
   string root=AppDomain.CurrentDomain.BaseDirectory;
   string inside=Path.Combine(root,"allowed","input.txt");
   string outside=Path.Combine(root,"outside","sentinel.txt");
   string fresh=Path.Combine(root,"allowed","new.txt");
   string remove=Path.Combine(root,"allowed","delete.txt");
   if(!Marker(inside))return 90;
   if(args[0]=="control"){
    if(!Marker(outside)||!Marker(remove))return 91;
    using(var f=File.Open(inside,FileMode.Open,FileAccess.Write)){f.WriteByte(102);}
    using(var f=File.Open(inside,FileMode.Truncate,FileAccess.Write)){byte[] data=System.Text.Encoding.ASCII.GetBytes("fixture");f.Write(data,0,data.Length);}
    using(var f=File.Open(fresh,FileMode.CreateNew,FileAccess.Write)){f.WriteByte(1);}
    File.Delete(fresh);File.Delete(remove);File.WriteAllText(remove,"fixture");
    return 77;
   }
   if(!Denied(()=>{File.ReadAllBytes(outside);}))return 92;
   if(!Denied(()=>{using(var f=File.Open(inside,FileMode.Open,FileAccess.Write)){} }))return 93;
   if(!Denied(()=>{using(var f=File.Open(inside,FileMode.Truncate,FileAccess.Write)){} }))return 94;
   if(!Denied(()=>{using(var f=File.Open(fresh,FileMode.CreateNew,FileAccess.Write)){} }))return 95;
   if(!Denied(()=>File.Delete(remove)))return 96;
   return 81;
  }catch{return 79;}
 }
}
'@ -OutputAssembly $helper -OutputType WindowsApplication -ErrorAction Stop
 $stage='broker-compile'
 Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.IO;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Runtime.InteropServices;
public static class NegrescoAppContainerFileFixture{
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup{
  public uint cb;public string reserved,desktop,title;
  public uint x,y,xSize,ySize,xCount,yCount,fill,flags;
  public ushort showWindow,reserved2Length;
  public IntPtr reserved2,stdIn,stdOut,stdErr;
 }
 [StructLayout(LayoutKind.Sequential)] struct StartupEx{public Startup startup;public IntPtr attributes;}
 [StructLayout(LayoutKind.Sequential)] struct Proc{public IntPtr process,thread;public uint pid,tid;}
 [StructLayout(LayoutKind.Sequential)] struct Caps{public IntPtr sid,capabilities;public uint count,reserved;}
 [DllImport("userenv.dll",CharSet=CharSet.Unicode)] static extern int CreateAppContainerProfile(string name,string display,string description,IntPtr caps,uint count,out IntPtr sid);
 [DllImport("userenv.dll",CharSet=CharSet.Unicode)] static extern int DeleteAppContainerProfile(string name);
 [DllImport("advapi32.dll")] static extern IntPtr FreeSid(IntPtr sid);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,uint flags,ref IntPtr size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
 [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="CreateProcessW")] static extern bool CreateProcess(string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref StartupEx startup,out Proc proc);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr handle,out uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr handle,uint code);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll")] static extern uint SetErrorMode(uint mode);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr buffer,uint size,out uint used);
 [DllImport("advapi32.dll")] static extern bool EqualSid(IntPtr a,IntPtr b);
 public static string Stage="setup";public static int Code=0;
 static void Need(bool b,string stage){if(!b){Stage=stage;Code=Marshal.GetLastWin32Error();throw new Exception("fixture refused");}}
 static void Token(IntPtr process,IntPtr sid){
  IntPtr token;Need(OpenProcessToken(process,8,out token),"open-token");
  IntPtr data=Marshal.AllocHGlobal(4096);
  try{
   uint used;Need(GetTokenInformation(token,29,data,4096,out used),"appcontainer-token");
   Need(Marshal.ReadInt32(data)==(sid==IntPtr.Zero?0:1),"token-kind");
   if(sid!=IntPtr.Zero){
    Need(GetTokenInformation(token,30,data,4096,out used),"token-capabilities");
    Need(Marshal.ReadInt32(data)==0,"nonempty-capabilities");
    Need(GetTokenInformation(token,31,data,4096,out used),"token-sid");
    Need(EqualSid(Marshal.ReadIntPtr(data),sid),"token-sid-mismatch");
   }
  }finally{Marshal.FreeHGlobal(data);CloseHandle(token);}
 }
 static void Trial(string exe,IntPtr sid,string phase){
  IntPtr list=IntPtr.Zero,cap=IntPtr.Zero;bool initialized=false;
  Proc p=new Proc();
  try{
   StartupEx start=new StartupEx();start.startup.cb=(uint)Marshal.SizeOf(typeof(StartupEx));
   uint flags=4|0x00080000;
   if(sid!=IntPtr.Zero){
    IntPtr size=IntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);
    Need(size.ToInt64()>0&&size.ToInt64()<65536,"attribute-size");
    list=Marshal.AllocHGlobal(size);Need(InitializeProcThreadAttributeList(list,1,0,ref size),"attribute-init");initialized=true;
    Caps c=new Caps();c.sid=sid;int bytes=Marshal.SizeOf(typeof(Caps));cap=Marshal.AllocHGlobal(bytes);
    Marshal.StructureToPtr(c,cap,false);
    Need(UpdateProcThreadAttribute(list,0,new IntPtr(0x00020009),cap,new IntPtr(bytes),IntPtr.Zero,IntPtr.Zero),"security-capabilities");
    start.attributes=list;
   }else{flags=4;start.startup.cb=(uint)Marshal.SizeOf(typeof(Startup));}
   string mode=sid==IntPtr.Zero?"control":"restricted";
   uint previousMode=SetErrorMode(0x8003);
   try{Need(CreateProcess(exe,new StringBuilder("\""+exe+"\" "+mode),IntPtr.Zero,IntPtr.Zero,false,flags,IntPtr.Zero,Environment.SystemDirectory,ref start,out p),phase+"-create");}
   finally{SetErrorMode(previousMode);}
   Token(p.process,sid);
   Need(ResumeThread(p.thread)==1,"resume");
   uint wait=WaitForSingleObject(p.process,12000);
   Need(wait==0,phase+"-wait-"+wait);
   uint code;Need(GetExitCodeProcess(p.process,out code),"exit");
   Need(code==(sid==IntPtr.Zero?77u:81u),phase+"-exit-"+code);
  }finally{
   if(p.process!=IntPtr.Zero){
    if(WaitForSingleObject(p.process,0)==258){TerminateProcess(p.process,3);WaitForSingleObject(p.process,5000);}
    CloseHandle(p.process);
   }
   if(p.thread!=IntPtr.Zero)CloseHandle(p.thread);
   if(initialized)DeleteProcThreadAttributeList(list);
   if(list!=IntPtr.Zero)Marshal.FreeHGlobal(list);
   if(cap!=IntPtr.Zero)Marshal.FreeHGlobal(cap);
  }
 }
 static void AllowRead(string path,SecurityIdentifier sid,bool directory){
  if(directory){
   var ds=Directory.GetAccessControl(path);
   ds.AddAccessRule(new FileSystemAccessRule(sid,FileSystemRights.ReadAndExecute,AccessControlType.Allow));
   Directory.SetAccessControl(path,ds);
  }else{
   var fs=File.GetAccessControl(path);
   fs.AddAccessRule(new FileSystemAccessRule(sid,FileSystemRights.ReadAndExecute,AccessControlType.Allow));
   File.SetAccessControl(path,fs);
  }
 }
 static void Deny(string path,SecurityIdentifier sid,FileSystemRights rights,bool directory){
  if(directory){
   var ds=Directory.GetAccessControl(path);ds.AddAccessRule(new FileSystemAccessRule(sid,rights,AccessControlType.Deny));Directory.SetAccessControl(path,ds);
  }else{
   var fs=File.GetAccessControl(path);fs.AddAccessRule(new FileSystemAccessRule(sid,rights,AccessControlType.Deny));File.SetAccessControl(path,fs);
  }
 }
 static void VerifyFixtures(string inside,string outside,string remove,string allowed){
  Need(File.ReadAllText(inside)=="fixture"&&File.ReadAllText(outside)=="fixture"&&File.ReadAllText(remove)=="fixture","fixtures-changed");
  Need(Directory.GetFiles(allowed).Length==2&&!File.Exists(Path.Combine(allowed,"new.txt")),"unexpected-files");
 }
 public static void Run(string exe){
  Need(Environment.Is64BitProcess,"architecture");
  string name="NegrescoFiles"+Guid.NewGuid().ToString("N");
  IntPtr sid=IntPtr.Zero;bool created=false;
  try{
   int hr=CreateAppContainerProfile(name,name,"Disposable Negresco filesystem fixture",IntPtr.Zero,0,out sid);
   Need(hr==0&&sid!=IntPtr.Zero,"profile-create-"+unchecked((uint)hr));created=true;
   var identity=new SecurityIdentifier(sid);
   string dir=Path.GetDirectoryName(exe),allowed=Path.Combine(dir,"allowed"),external=Path.Combine(dir,"outside");
   Directory.CreateDirectory(allowed);Directory.CreateDirectory(external);
   string inside=Path.Combine(allowed,"input.txt"),outside=Path.Combine(external,"sentinel.txt"),remove=Path.Combine(allowed,"delete.txt");
   File.WriteAllText(inside,"fixture");File.WriteAllText(outside,"fixture");File.WriteAllText(remove,"fixture");
   AllowRead(dir,identity,true);AllowRead(exe,identity,false);
   AllowRead(allowed,identity,true);AllowRead(external,identity,true);
   AllowRead(inside,identity,false);AllowRead(remove,identity,false);
   // Explicit deny only the disposable profile SID; the ordinary control retains access.
   Deny(outside,identity,FileSystemRights.ReadData,false);
   Deny(allowed,identity,FileSystemRights.CreateFiles|FileSystemRights.DeleteSubdirectoriesAndFiles,true);
   Deny(inside,identity,FileSystemRights.WriteData|FileSystemRights.AppendData|FileSystemRights.Delete,false);
   Deny(remove,identity,FileSystemRights.Delete,false);
   Trial(exe,IntPtr.Zero,"before");
   // Control recreated the deletion fixture: restore its profile-specific deny.
   AllowRead(remove,identity,false);Deny(remove,identity,FileSystemRights.Delete,false);
   VerifyFixtures(inside,outside,remove,allowed);
   Trial(exe,sid,"restricted");VerifyFixtures(inside,outside,remove,allowed);
   Trial(exe,IntPtr.Zero,"after");VerifyFixtures(inside,outside,remove,allowed);
  }finally{
   if(sid!=IntPtr.Zero)FreeSid(sid);
   if(created){int hr=DeleteAppContainerProfile(name);Need(hr==0,"profile-delete-"+unchecked((uint)hr));}
  }
 }
}
'@ -ErrorAction Stop
 $stage='native'
 [NegrescoAppContainerFileFixture]::Run($helper)
 $stage='cleanup'
 [IO.Directory]::Delete($root,$true)
 $root=$null
 $report=[ordered]@{
  scope='disposable-windows-appcontainer-filesystem';mechanism='AppContainerFixtureAcl'
  positiveBefore=$true;positiveAfter=$true;appContainerTokenVerified=$true;zeroCapabilitiesVerified=$true;profileSidVerified=$true
  allowedRead=$true;outsideReadRefused=$true;writeRefused=$true;truncateRefused=$true;createRefused=$true;deleteRefused=$true
  explicitFixtureAcl=$true;fixturesUnchanged=$true;profileDeleteSucceeded=$true;temporaryFilesRemoved=$true
  inheritedHandlesVerified=$false;universalFilesystemIsolationVerified=$false;readerIntegrated=$false;operationsEnabled=$false;realReadsPerformed=$false
 }
 [Console]::Out.WriteLine(($report|ConvertTo-Json -Compress))
 exit 0
}catch{
 $detail=$stage
 if($stage -eq 'native'){$detail=$stage+':'+[NegrescoAppContainerFileFixture]::Stage+':'+[NegrescoAppContainerFileFixture]::Code}
 if($stage -like '*compile'){
  $ids=@([regex]::Matches(($_|Out-String),'CS[0-9]{4}')|ForEach-Object {$_.Value}|Select-Object -Unique -First 4)
  if($ids.Count -gt 0){$detail=$stage+':'+($ids -join ':')}
 }
 if($detail -cnotmatch '\A[a-zA-Z0-9:-]{1,120}\z'){$detail='unknown'}
 [Console]::Error.WriteLine('NEGRESCO_WINDOWS_APPCONTAINER_FILESYSTEM_REFUSED:'+$detail)
 exit 3
}finally{
 if($root -and [IO.Directory]::Exists($root)){
  try{[IO.Directory]::Delete($root,$true)}catch{[Console]::Error.WriteLine('NEGRESCO_WINDOWS_APPCONTAINER_FILESYSTEM_CLEANUP_REFUSED')}
 }
}
