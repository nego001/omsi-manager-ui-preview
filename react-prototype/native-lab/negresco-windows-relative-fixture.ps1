# F4.01d: fixed disposable Windows fixture, not shipped or invoked by Electron.
$ErrorActionPreference='Stop'
$root=$null
$junction=$null
try {
 if ($args.Count -ne 0 -or [Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'fixture refused' }
 Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using Microsoft.Win32.SafeHandles;
public static class NegrescoWindowsReadFixture {
 [StructLayout(LayoutKind.Sequential)] struct UnicodeString { public ushort Length, MaximumLength; public IntPtr Buffer; }
 [StructLayout(LayoutKind.Sequential)] struct ObjectAttributes { public int Length; public IntPtr RootDirectory, ObjectName; public uint Attributes; public IntPtr SecurityDescriptor, SecurityQualityOfService; }
 [StructLayout(LayoutKind.Sequential)] struct IoStatus { public IntPtr Status, Information; }
 [StructLayout(LayoutKind.Sequential)] struct FileTime { public uint Low, High; }
 [StructLayout(LayoutKind.Sequential)] struct Info {
  public uint Attributes; public FileTime Creation, Access, Write;
  public uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
 }
 [StructLayout(LayoutKind.Sequential)] struct FileId { public ulong Volume; [MarshalAs(UnmanagedType.ByValArray,SizeConst=16)] public byte[] Id; }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="CreateFileW")]
 static extern SafeFileHandle CreateFile(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("ntdll.dll")]
 static extern int NtCreateFile(out SafeFileHandle file,uint access,ref ObjectAttributes oa,out IoStatus io,IntPtr allocation,uint attrs,uint share,uint disposition,uint options,IntPtr ea,uint eaLength);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool GetFileInformationByHandle(SafeFileHandle h,out Info i);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool GetFileInformationByHandleEx(SafeFileHandle h,int kind,out FileId i,uint size);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern uint GetFileType(SafeFileHandle h);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool ReadFile(SafeFileHandle h,byte[] buffer,uint count,out uint got,IntPtr overlapped);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="CreateHardLinkW")]
 static extern bool CreateHardLink(string target,string existing,IntPtr security);
 sealed class Refused:Exception {}
 static void Need(bool b){if(!b)throw new Refused();}
 static string Key(SafeFileHandle h,bool directory,ulong volume,out long size) {
  Info i; FileId id;
  Need(!h.IsInvalid && GetFileType(h)==1);
  Need(GetFileInformationByHandle(h,out i));
  Need(GetFileInformationByHandleEx(h,18,out id,(uint)Marshal.SizeOf(typeof(FileId))));
  Need(id.Id!=null && id.Id.Length==16 && (i.Attributes&0x400)==0 && ((i.Attributes&0x10)!=0)==directory);
  Need(id.Volume==volume && (directory || i.Links==1));
  size=((long)i.SizeHigh<<32)|i.SizeLow;
  return id.Volume+":"+BitConverter.ToString(id.Id)+":"+i.Attributes+":"+i.Links+":"+size+":"+i.Write.High+":"+i.Write.Low;
 }
 static ulong Volume(SafeFileHandle h) {
  FileId id; Need(GetFileInformationByHandleEx(h,18,out id,(uint)Marshal.SizeOf(typeof(FileId))));return id.Volume;
 }
 static SafeFileHandle OpenOne(SafeFileHandle parent,string name,bool directory) {
  Need(name.Length>0 && name.Length<=80 && name!="." && name!=".." && name.IndexOfAny(new char[]{'\\','/',':','\0'})<0);
  IntPtr chars=IntPtr.Zero,ptr=IntPtr.Zero;
  try {
   chars=Marshal.StringToHGlobalUni(name);
   UnicodeString u=new UnicodeString();u.Length=(ushort)(name.Length*2);u.MaximumLength=(ushort)(u.Length+2);u.Buffer=chars;
   ptr=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(UnicodeString)));Marshal.StructureToPtr(u,ptr,false);
   ObjectAttributes oa=new ObjectAttributes();oa.Length=Marshal.SizeOf(typeof(ObjectAttributes));oa.RootDirectory=parent.DangerousGetHandle();oa.ObjectName=ptr;oa.Attributes=0x40;
   SafeFileHandle file;IoStatus io;
   int status=NtCreateFile(out file,0x00100081,ref oa,out io,IntPtr.Zero,0,7,1,0x00200020u|(directory?1u:0x40u),IntPtr.Zero,0);
   if(status<0 || file==null || file.IsInvalid){if(file!=null)file.Dispose();throw new Refused();}
   return file;
  } finally {if(ptr!=IntPtr.Zero)Marshal.FreeHGlobal(ptr);if(chars!=IntPtr.Zero)Marshal.FreeHGlobal(chars);}
 }
 static SafeFileHandle Resolve(SafeFileHandle root,string path,ulong volume) {
  string[] parts=path.Split('/');Need(parts.Length>=1 && parts.Length<=4);
  SafeFileHandle parent=root;
  try {
   for(int i=0;i<parts.Length;i++){
    bool dir=i<parts.Length-1;SafeFileHandle child=OpenOne(parent,parts[i],dir);
    try{long size;Key(child,dir,volume,out size);}catch{child.Dispose();throw;}
    if(parent!=root)parent.Dispose();parent=child;
   }
   SafeFileHandle result=parent;parent=root;return result;
  }finally{if(parent!=root)parent.Dispose();}
 }
 static string Hash(byte[] bytes){using(SHA256 sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(bytes));}
 static string Read(SafeFileHandle root,string path,ulong volume,int cap,Action barrier) {
  using(SafeFileHandle h=Resolve(root,path,volume)){
   long length;string before=Key(h,false,volume,out length);Need(length>=0 && length<=cap);
   if(barrier!=null)barrier();
   byte[] bytes=new byte[(int)length];int pos=0;
   while(pos<bytes.Length){byte[] chunk=new byte[Math.Min(4096,bytes.Length-pos)];uint got;Need(ReadFile(h,chunk,(uint)chunk.Length,out got,IntPtr.Zero)&&got>0&&got<=chunk.Length);Array.Copy(chunk,0,bytes,pos,(int)got);pos+=(int)got;}
   long after;Need(Key(h,false,volume,out after)==before);
   using(SafeFileHandle check=Resolve(root,path,volume)){long checkSize;Need(Key(check,false,volume,out checkSize)==before);}
   return Hash(bytes);
  }
 }
 static void Denied(List<string> cases,string name,Action fn){try{fn();}catch(Refused){cases.Add(name);return;}throw new Exception("expected refusal");}
 public static string[] Run(string root,string sibling){
  List<string> cases=new List<string>();
  string nested=Path.Combine(root,"nested");
  Directory.CreateDirectory(nested);
  File.WriteAllBytes(Path.Combine(nested,"valid.bin"),new byte[]{1,2,3});
  File.WriteAllBytes(Path.Combine(root,"hard-source.bin"),new byte[]{4});
  Need(CreateHardLink(Path.Combine(root,"hard.bin"),Path.Combine(root,"hard-source.bin"),IntPtr.Zero));
  File.WriteAllBytes(Path.Combine(root,"large.bin"),new byte[33]);
  File.WriteAllBytes(Path.Combine(root,"mutate.bin"),new byte[]{1,2,3});
  File.WriteAllBytes(Path.Combine(root,"replace.bin"),new byte[]{1,2,3});
  Directory.CreateDirectory(Path.Combine(root,"parent"));
  File.WriteAllBytes(Path.Combine(root,"parent","data.bin"),new byte[]{1,2,3});
  using(SafeFileHandle h=CreateFile(root,0x80000000,7,IntPtr.Zero,3,0x02200000,IntPtr.Zero)){
   Need(!h.IsInvalid);ulong volume=Volume(h);long rootSize;Key(h,true,volume,out rootSize);
   Need(Read(h,"nested/valid.bin",volume,3,null)==Hash(new byte[]{1,2,3}));cases.Add("nested-regular-same-handle");
   Denied(cases,"parent-junction",()=>Read(h,"redirect/sentinel.bin",volume,64,null));
   Denied(cases,"leaf-junction",()=>Read(h,"redirect",volume,64,null));
   Denied(cases,"traversal",()=>Read(h,"../sentinel.bin",volume,64,null));
   Denied(cases,"absolute",()=>Read(h,"/sentinel.bin",volume,64,null));
   Denied(cases,"alternate-stream",()=>Read(h,"nested/valid.bin:stream",volume,64,null));
   Denied(cases,"hardlink",()=>Read(h,"hard.bin",volume,64,null));
   Denied(cases,"directory",()=>Read(h,"nested",volume,64,null));
   Denied(cases,"size-cap",()=>Read(h,"large.bin",volume,32,null));
   Denied(cases,"in-place-mutation",()=>Read(h,"mutate.bin",volume,64,()=>File.WriteAllBytes(Path.Combine(root,"mutate.bin"),new byte[9])));
   Denied(cases,"file-replacement",()=>Read(h,"replace.bin",volume,64,()=>{
    File.Move(Path.Combine(root,"replace.bin"),Path.Combine(root,"retired.bin"));
    File.WriteAllBytes(Path.Combine(root,"replace.bin"),new byte[]{1,2,3});
   }));
   Denied(cases,"parent-substitution",()=>Read(h,"parent/data.bin",volume,64,()=>{
    Directory.Move(Path.Combine(root,"parent"),Path.Combine(root,"retired-parent"));
    Directory.CreateDirectory(Path.Combine(root,"parent"));
    File.WriteAllBytes(Path.Combine(root,"parent","data.bin"),new byte[]{1,2,3});
   }));
  }
  Need(Hash(File.ReadAllBytes(Path.Combine(sibling,"sentinel.bin")))==Hash(new byte[]{9,8,7}));cases.Add("sibling-unchanged");
  return cases.ToArray();
 }
}
'@ -ErrorAction Stop
 $root=Join-Path ([IO.Path]::GetTempPath()) ('negresco-winread-fixture-'+[Guid]::NewGuid().ToString('N'))
 [void][IO.Directory]::CreateDirectory($root)
 $selected=Join-Path $root 'selected'
 $sibling=Join-Path $root 'sibling'
 [void][IO.Directory]::CreateDirectory($selected)
 [void][IO.Directory]::CreateDirectory($sibling)
 [IO.File]::WriteAllBytes((Join-Path $sibling 'sentinel.bin'),[byte[]]@(9,8,7))
 $junction=Join-Path $selected 'redirect'
 New-Item -ItemType Junction -Path $junction -Target $sibling -ErrorAction Stop | Out-Null
 $cases=[NegrescoWindowsReadFixture]::Run($selected,$sibling)
 [IO.Directory]::Delete($junction)
 $junction=$null
 [IO.Directory]::Delete($root,$true)
 $root=$null
 $report=[ordered]@{scope='disposable-windows-fixture';cases=$cases;nativeRelativeHandleObserved=$true;atomicContainmentProven=$false;abaRuledOut=$false;realReadsPerformed=$false;operationsEnabled=$false;releaseAuthorized=$false}
 [Console]::Out.WriteLine(($report|ConvertTo-Json -Compress -Depth 3))
 exit 0
} catch {
 [Console]::Error.WriteLine('NEGRESCO_NATIVE_WINDOWS_FIXTURE_REFUSED')
 exit 3
} finally {
 # Never recursively traverse an unremoved junction.
 if($junction -and [IO.Directory]::Exists($junction)){try{[IO.Directory]::Delete($junction);$junction=$null}catch{}}
 if($root -and -not $junction){try{[IO.Directory]::Delete($root,$true)}catch{}}
}
