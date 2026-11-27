# Disposable AppContainer loopback experiment; no firewall or loopback exemption changes.
$ErrorActionPreference='Stop'
$stage='admission'
$root=$null
try{
 if($args.Count -ne 0 -or [Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'refused'}
 $root=[IO.Path]::Combine([IO.Path]::GetTempPath(),'NegrescoNet-'+[Guid]::NewGuid().ToString('N'))
 [IO.Directory]::CreateDirectory($root)|Out-Null
 $helper=[IO.Path]::Combine($root,'NegrescoNetWorker.exe')
 $stage='helper-compile'
 Add-Type -TypeDefinition @'
using System;
using System.Net;
using System.Net.Sockets;
public static class NegrescoNetWorker {
 public static int Main(string[] args){
  int port;
  if(args.Length!=1||!int.TryParse(args[0],out port)||port<1||port>65535)return 79;
  try{
   using(var s=new Socket(AddressFamily.InterNetwork,SocketType.Stream,ProtocolType.Tcp)){
    s.Blocking=false;
    try{s.Connect(IPAddress.Loopback,port);}
    catch(SocketException e){
     if(e.NativeErrorCode==10013)return 81;
     if(e.SocketErrorCode!=SocketError.WouldBlock&&e.SocketErrorCode!=SocketError.InProgress)return 82;
     var writable=new System.Collections.ArrayList();var errors=new System.Collections.ArrayList();
     writable.Add(s);errors.Add(s);
     // Socket.Select expects IList, not a list of file descriptors.
     Socket.Select(null,writable,errors,2000000);
     if(writable.Count==0&&errors.Count==0)return 83;
     int error=(int)s.GetSocketOption(SocketOptionLevel.Socket,SocketOptionName.Error);
     if(error==10013)return 81;
     if(error!=0||errors.Count!=0)return 82;
    }
    s.Blocking=true;s.SendTimeout=2000;
    return s.Send(new byte[]{70,73,88})==3?77:79;
   }
  }catch(SocketException){return 84;}
  catch{return 79;}
 }
}
'@ -OutputAssembly $helper -OutputType WindowsApplication -ErrorAction Stop
 $stage='broker-compile'
 Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Net;
using System.Net.Sockets;
using System.IO;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Runtime.InteropServices;
public static class NegrescoAppContainerFixture{
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
 static void Trial(string exe,IntPtr sid,TcpListener listener,string phase){
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
   int port=((IPEndPoint)listener.LocalEndpoint).Port;
   uint previousMode=SetErrorMode(0x8003);
   try{Need(CreateProcess(exe,new StringBuilder("\""+exe+"\" "+port),IntPtr.Zero,IntPtr.Zero,false,flags,IntPtr.Zero,Environment.SystemDirectory,ref start,out p),phase+"-create");}
   finally{SetErrorMode(previousMode);}
   Token(p.process,sid);
   Need(ResumeThread(p.thread)==1,"resume");
   uint wait=WaitForSingleObject(p.process,12000);
   Need(wait==0,phase+"-wait-"+wait);
   uint code;Need(GetExitCodeProcess(p.process,out code),"exit");
   if(sid!=IntPtr.Zero){
    Need(code==81,phase+"-exit-"+code);
    Need(!listener.Server.Poll(250000,SelectMode.SelectRead),"unexpected-connection");
   }else{
    Need(code==77,phase+"-exit-"+code);
    Need(listener.Server.Poll(2000000,SelectMode.SelectRead),"control-connection");
    using(var client=listener.AcceptTcpClient()){
     client.ReceiveTimeout=2000;
     var stream=client.GetStream();
     Need(stream.ReadByte()==70&&stream.ReadByte()==73&&stream.ReadByte()==88&&stream.ReadByte()==-1,"control-marker");
    }
   }
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
 public static void Run(string exe){
  Need(Environment.Is64BitProcess,"architecture");
  string name="NegrescoNet"+Guid.NewGuid().ToString("N");
  IntPtr sid=IntPtr.Zero;bool created=false;
  TcpListener listener=new TcpListener(IPAddress.Loopback,0);
  try{
   int hr=CreateAppContainerProfile(name,name,"Disposable Negresco network fixture",IntPtr.Zero,0,out sid);
   Need(hr==0&&sid!=IntPtr.Zero,"profile-create-"+unchecked((uint)hr));created=true;
   var identity=new SecurityIdentifier(sid);
   // Grant only this disposable directory and executable to the new profile.
   string dir=Path.GetDirectoryName(exe);
   var ds=Directory.GetAccessControl(dir);ds.AddAccessRule(new FileSystemAccessRule(identity,FileSystemRights.ReadAndExecute,AccessControlType.Allow));Directory.SetAccessControl(dir,ds);
   var fs=File.GetAccessControl(exe);fs.AddAccessRule(new FileSystemAccessRule(identity,FileSystemRights.ReadAndExecute,AccessControlType.Allow));File.SetAccessControl(exe,fs);
   listener.Start(2);
   Trial(exe,IntPtr.Zero,listener,"before");Trial(exe,sid,listener,"restricted");Trial(exe,IntPtr.Zero,listener,"after");
  }finally{
   listener.Stop();
   if(sid!=IntPtr.Zero)FreeSid(sid);
   if(created){int hr=DeleteAppContainerProfile(name);Need(hr==0,"profile-delete-"+unchecked((uint)hr));}
  }
 }
}
'@ -ErrorAction Stop
 $stage='native'
 [NegrescoAppContainerFixture]::Run($helper)
 $stage='cleanup'
 [IO.Directory]::Delete($root,$true)
 $root=$null
 $report=[ordered]@{
  scope='disposable-windows-appcontainer-network';mechanism='AppContainer'
  positiveBefore=$true;positiveAfter=$true;appContainerTokenVerified=$true;zeroCapabilitiesVerified=$true;profileSidVerified=$true
  loopbackConnectRefused=$true;refusalWin32Code=10013;loopbackListenerUnreached=$true
  profileDeleteSucceeded=$true;temporaryFilesRemoved=$true;firewallChanged=$false
  allNetworkDeniedVerified=$false;readerIntegrated=$false;operationsEnabled=$false;realReadsPerformed=$false
 }
 [Console]::Out.WriteLine(($report|ConvertTo-Json -Compress))
 exit 0
}catch{
 $detail=$stage
 if($stage -eq 'native'){$detail=$stage+':'+[NegrescoAppContainerFixture]::Stage+':'+[NegrescoAppContainerFixture]::Code}
 if($stage -like '*compile'){
  $ids=@([regex]::Matches(($_|Out-String),'CS[0-9]{4}')|ForEach-Object {$_.Value}|Select-Object -Unique -First 4)
  if($ids.Count -gt 0){$detail=$stage+':'+($ids -join ':')}
 }
 if($detail -cnotmatch '\A[a-zA-Z0-9:-]{1,120}\z'){$detail='unknown'}
 [Console]::Error.WriteLine('NEGRESCO_WINDOWS_APPCONTAINER_REFUSED:'+$detail)
 exit 3
}finally{
 if($root -and [IO.Directory]::Exists($root)){
  try{[IO.Directory]::Delete($root,$true)}catch{[Console]::Error.WriteLine('NEGRESCO_WINDOWS_APPCONTAINER_CLEANUP_REFUSED')}
 }
}
