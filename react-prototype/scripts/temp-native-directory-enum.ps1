# TEST-ONLY. Win32 handle-bound directory enumeration of ONE marker-scoped
# fixture subfolder; NEVER run by the app, preload, renderer or production IPC.
param(
 [Parameter(Mandatory=$true)][string]$Root,
 [Parameter(Mandatory=$true)][string]$Nonce
)
$ErrorActionPreference='Stop'
try {
 if($Nonce -cnotmatch '^[0-9a-f]{32}$'){throw 'invalid nonce'}
 $base=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\','/')
 $canonical=[IO.Path]::GetFullPath($Root).TrimEnd('\','/')
 if([IO.Path]::GetDirectoryName($canonical) -ine $base -or
    [IO.Path]::GetFileName($canonical) -cnotmatch '^omsi-manager-recovery-fixture-[a-zA-Z0-9_-]+$'){
  throw 'not a disposable fixture'
 }
 $d=Get-Item -LiteralPath $canonical -Force
 if(-not $d.PSIsContainer -or ($d.Attributes -band [IO.FileAttributes]::ReparsePoint)){
  throw 'unsafe fixture root'
 }
 $marker=Join-Path $canonical '.omsi-test-fixture-marker'
 $m=Get-Item -LiteralPath $marker -Force
 if($m.PSIsContainer -or ($m.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
    $m.Length -ne 32 -or [IO.File]::ReadAllText($marker) -cne $Nonce){
  throw 'fixture marker invalid'
 }
 $target=Join-Path $canonical 'native-enum'
 $di=Get-Item -LiteralPath $target -Force
 if(-not $di.PSIsContainer -or ($di.Attributes -band [IO.FileAttributes]::ReparsePoint)){
  throw 'unsafe target'
 }
 Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class OmsiTestNativeDirectoryEnumeration {
 [StructLayout(LayoutKind.Sequential)]
 private struct FileIdInfo {
  public ulong VolumeSerialNumber;
  [MarshalAs(UnmanagedType.ByValArray,SizeConst=16)]
  public byte[] FileId;
 }
 [StructLayout(LayoutKind.Sequential)]
 private struct FileAttributeTagInfo {
  public uint FileAttributes;
  public uint ReparseTag;
 }
 [StructLayout(LayoutKind.Sequential)]
 private struct FileBasicInfo {
  public long CreationTime,LastAccessTime,LastWriteTime,ChangeTime;
  public uint FileAttributes;
 }
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]
 private struct FileIdBothDirInfoLayout {
  public uint NextEntryOffset,FileIndex;
  public long CreationTime,LastAccessTime,LastWriteTime,ChangeTime;
  public long EndOfFile,AllocationSize;
  public uint FileAttributes,FileNameLength,EaSize;
  public byte ShortNameLength;
  [MarshalAs(UnmanagedType.ByValArray,SizeConst=12)]
  public ushort[] ShortName;
  public long FileId;
  public ushort FileName;
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="CreateFileW")]
 private static extern SafeFileHandle OpenDir(string name,uint access,uint share,
  IntPtr security,uint creation,uint flags,IntPtr templateFile);
 [DllImport("kernel32.dll",SetLastError=true,EntryPoint="GetFileInformationByHandleEx")]
 [return:MarshalAs(UnmanagedType.Bool)]
 private static extern bool GetFileId(SafeFileHandle h,int cls,
  out FileIdInfo info,uint bytes);
 [DllImport("kernel32.dll",SetLastError=true,EntryPoint="GetFileInformationByHandleEx")]
 [return:MarshalAs(UnmanagedType.Bool)]
 private static extern bool GetTag(SafeFileHandle h,int cls,
  out FileAttributeTagInfo tag,uint bytes);
 [DllImport("kernel32.dll",SetLastError=true,EntryPoint="GetFileInformationByHandleEx")]
 [return:MarshalAs(UnmanagedType.Bool)]
 private static extern bool GetBasic(SafeFileHandle h,int cls,
  out FileBasicInfo info,uint bytes);
 [DllImport("kernel32.dll",SetLastError=true,EntryPoint="GetFileInformationByHandleEx")]
 [return:MarshalAs(UnmanagedType.Bool)]
 private static extern bool GetItems(SafeFileHandle h,int cls,IntPtr data,uint bytes);
 private static bool Same(byte[] a,byte[] b){
  if(a==null||b==null||a.Length!=b.Length)return false;
  for(int i=0;i<a.Length;i++)if(a[i]!=b[i])return false;
  return true;
 }
 private static bool Same(FileIdInfo a,FileIdInfo b){
  return a.VolumeSerialNumber==b.VolumeSerialNumber&&Same(a.FileId,b.FileId);
 }
 private static SafeFileHandle OpenAllowed(string path){
  const uint LIST_DIRECTORY=1u, READ_ATTRIBUTES=0x80u;
  const uint SHARE_ALL=7u, OPEN_EXISTING=3u;
  const uint BACKUP_SEMANTICS=0x02000000u,OPEN_REPARSE_POINT=0x00200000u;
  SafeFileHandle handle=OpenDir(path,LIST_DIRECTORY|READ_ATTRIBUTES,
   SHARE_ALL,IntPtr.Zero,OPEN_EXISTING,BACKUP_SEMANTICS|OPEN_REPARSE_POINT,
   IntPtr.Zero);
  if(handle==null||handle.IsInvalid)throw new IOException("directory handle unavailable");
  FileAttributeTagInfo tag;
  if(!GetTag(handle,9,out tag,(uint)Marshal.SizeOf(typeof(FileAttributeTagInfo))) ||
    (tag.FileAttributes & 0x10u)==0u||(tag.FileAttributes & 0x400u)!=0u){
   handle.Dispose();
   throw new IOException("directory handle unsafe");
  }
  return handle;
 }
 private static FileIdInfo Identity(SafeFileHandle h){
  FileIdInfo info;
  if(!GetFileId(h,18,out info,(uint)Marshal.SizeOf(typeof(FileIdInfo))) ||
    info.FileId==null||info.FileId.Length!=16)
   throw new IOException("native FileIdInfo unavailable");
  return info;
 }
 private static FileBasicInfo Basic(SafeFileHandle h){
  FileBasicInfo info;
  if(!GetBasic(h,0,out info,(uint)Marshal.SizeOf(typeof(FileBasicInfo))))
   throw new IOException("native basic directory identity unavailable");
  return info;
 }
 public static int[] Observe(string path){
  const int MAX_ENTRIES=128,BUFFER=65536,MAX_PAGES=16;
  // Validate that the managed layout matches the Win32 FILE_ID_BOTH_DIR_INFO
  // prefix before reading any variable-length native data.
  int attr=(int)Marshal.OffsetOf(typeof(FileIdBothDirInfoLayout),"FileAttributes");
  int length=(int)Marshal.OffsetOf(typeof(FileIdBothDirInfoLayout),"FileNameLength");
  int name=(int)Marshal.OffsetOf(typeof(FileIdBothDirInfoLayout),"FileName");
  if(attr!=56||length!=60||name!=104)
   throw new IOException("unexpected native record ABI");
  using(SafeFileHandle held=OpenAllowed(path)){
   FileIdInfo before=Identity(held);
   FileBasicInfo first=Basic(held);
   int total=0,dirs=0,files=0,links=0,packages=0;
   bool finished=false;
   IntPtr memory=Marshal.AllocHGlobal(BUFFER);
   try{
    for(int page=0;page<MAX_PAGES;page++){
     // Zero the buffer so malformed or short returned records fail closed.
     for(int i=0;i<BUFFER;i++)Marshal.WriteByte(memory,i,0);
     if(!GetItems(held,page==0?11:10,memory,BUFFER)){
      int error=Marshal.GetLastWin32Error();
      if(error==18){finished=true;break;} // ERROR_NO_MORE_FILES
      throw new IOException("native enumeration unavailable");
     }
     int offset=0;
     for(int entry=0;entry<MAX_ENTRIES+2;entry++){
      if(offset<0||offset>BUFFER-name)throw new IOException("invalid record offset");
      int jump=Marshal.ReadInt32(memory,offset);
      int byteCount=Marshal.ReadInt32(memory,offset+length);
      int attrib=Marshal.ReadInt32(memory,offset+attr);
      int bound=(jump==0)?BUFFER-offset:jump;
      if((byteCount&1)!=0||byteCount<2||byteCount>1024||
        name+byteCount>bound|| (jump!=0&&(jump<name+2||(jump&7)!=0)) )
       throw new IOException("invalid variable native record");
      string fileName=Marshal.PtrToStringUni(
        new IntPtr(memory.ToInt64()+offset+name),byteCount/2);
      if(String.IsNullOrEmpty(fileName)||fileName.IndexOf('\0')>=0)
       throw new IOException("invalid returned native name");
      if(fileName!="."&&fileName!=".."){
       if(++total>=MAX_ENTRIES)throw new IOException("enumeration budget exceeded");
       if((attrib&0x400)!=0){links++;}
       else if((attrib&0x10)!=0){dirs++;}
       else{
        files++;
        if(fileName.EndsWith(".scs",StringComparison.OrdinalIgnoreCase)||
           fileName.EndsWith(".zip",StringComparison.OrdinalIgnoreCase))
         packages++;
       }
      }
      if(jump==0)break;
      offset=checked(offset+jump);
     }
    }
   }finally{Marshal.FreeHGlobal(memory);}
   if(!finished)throw new IOException("enumeration page budget reached");
   FileIdInfo after=Identity(held);
   FileBasicInfo last=Basic(held);
   if(!Same(before,after)||first.ChangeTime!=last.ChangeTime||
      first.LastWriteTime!=last.LastWriteTime)
    throw new IOException("directory changed while enumerating");
   using(SafeFileHandle fresh=OpenAllowed(path)){
    if(!Same(before,Identity(fresh)))
     throw new IOException("directory pathname changed");
   }
   return new int[]{total,dirs,files,links,packages};
  }
 }
}
'@ -ErrorAction Stop
 $sample=[OmsiTestNativeDirectoryEnumeration]::Observe($target)
 $report=[ordered]@{
  source='temporary-native-windows-directory-fixture'
  outcome='observed-bounded-untrusted'
  nativeDirectoryHandleUsed=$true
  nativeDirectoryEnumerationByHandle=$true
  nativeFileIdChecked=$true
  targetIsSynthetic=$true
  entries=$sample[0]
  directories=$sample[1]
  files=$sample[2]
  linksSkipped=$sample[3]
  packageCandidates=$sample[4]
  completedWithinBudget=$true
  nativeIdentityAuthorizedForGameFolders=$false
  guaranteesNoABA=$false
  atomicPathContainmentProven=$false
  supportsRealGameInspection=$false
  canRecover=$false
  canInstall=$false
  canDelete=$false
  operationsEnabled=$false
  bytesReadFromMods=0
 }
 [Console]::Out.WriteLine(($report|ConvertTo-Json -Compress -Depth 3))
 exit 0
} catch {
 # Do not expose a pathname, native identifier, raw entry name or C# exception.
 [Console]::Error.WriteLine('Temporary native directory enumeration refused.')
 exit 3
}
