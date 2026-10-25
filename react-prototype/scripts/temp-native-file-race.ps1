# TEST-ONLY: deterministic two-process Windows file-identity race fixture.
# The only candidate is a fixed, marker-bound file in a child of os.tmpdir().
# Read-only native handles; never imported into Electron or used for game files.
param(
 [Parameter(Mandatory=$true)][string]$Root,
 [Parameter(Mandatory=$true)][string]$Nonce
)
$ErrorActionPreference='Stop'
$witness=$null
try {
 if($Nonce -cnotmatch '^[0-9a-f]{32}$'){throw 'invalid fixture nonce'}
 $base=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\','/')
 $canonical=[IO.Path]::GetFullPath($Root).TrimEnd('\','/')
 if([IO.Path]::GetDirectoryName($canonical) -ine $base -or
    [IO.Path]::GetFileName($canonical) -cnotmatch '^omsi-manager-recovery-fixture-[a-zA-Z0-9_-]+$'){
  throw 'not an isolated fixture'
 }
 $directory=Get-Item -LiteralPath $canonical -Force
 if(-not $directory.PSIsContainer -or
   ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'unsafe directory'}
 $marker=Join-Path $canonical '.omsi-test-fixture-marker'
 $markerFile=Get-Item -LiteralPath $marker -Force
 if($markerFile.PSIsContainer -or
    ($markerFile.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
    $markerFile.Length -ne 32 -or
    [IO.File]::ReadAllText($marker) -cne $Nonce){throw 'invalid marker'}
 $target=Join-Path $canonical 'identity-target.bin'
 Add-Type -TypeDefinition @'
using System;
using System.IO;
using Microsoft.Win32.SafeHandles;
using System.Runtime.InteropServices;

public sealed class OmsiTestNativeRaceWitness : IDisposable {
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
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true,EntryPoint="CreateFileW")]
 private static extern SafeFileHandle OpenNative(string name,uint access,uint share,
  IntPtr security,uint disposition,uint flags,IntPtr templateFile);
 [DllImport("kernel32.dll",SetLastError=true,EntryPoint="GetFileInformationByHandleEx")]
 [return:MarshalAs(UnmanagedType.Bool)]
 private static extern bool QueryId(SafeFileHandle handle,int kind,out FileIdInfo info,uint size);
 [DllImport("kernel32.dll",SetLastError=true,EntryPoint="GetFileInformationByHandleEx")]
 [return:MarshalAs(UnmanagedType.Bool)]
 private static extern bool QueryAttributes(SafeFileHandle handle,int kind,out FileAttributeTagInfo info,uint size);
 private SafeFileHandle handle;
 private FileStream stream;
 private string file;
 private FileIdInfo beforeId;
 private byte[] beforeBytes;
 private bool closed;
 private static SafeFileHandle OpenAllowed(string pathname){
  const uint GENERIC_READ=0x80000000u;
  const uint SHARE_ALL=7u,OPEN_EXISTING=3u,OPEN_REPARSE=0x00200000u;
  SafeFileHandle h=OpenNative(pathname,GENERIC_READ,SHARE_ALL,
   IntPtr.Zero,OPEN_EXISTING,OPEN_REPARSE,IntPtr.Zero);
  if(h==null||h.IsInvalid)throw new IOException("fixture file unavailable");
  FileAttributeTagInfo tag;
  if(!QueryAttributes(h,9,out tag,(uint)Marshal.SizeOf(typeof(FileAttributeTagInfo))) ||
     (tag.FileAttributes & 0x400u)!=0u ||(tag.FileAttributes & 0x10u)!=0u){
   h.Dispose();throw new IOException("unsafe reparse point or file type");
  }
  return h;
 }
 private static FileIdInfo Id(SafeFileHandle h){
  FileIdInfo result;
  if(!QueryId(h,18,out result,(uint)Marshal.SizeOf(typeof(FileIdInfo)))||
     result.FileId==null||result.FileId.Length!=16)throw new IOException("FileIdInfo unavailable");
  return result;
 }
 private static byte[] ReadSmall(FileStream s){
  long size=s.Length;
  if(size<1||size>4096)throw new IOException("invalid fixture length");
  s.Seek(0,SeekOrigin.Begin);
  byte[] buffer=new byte[(int)size];int offset=0;
  while(offset<buffer.Length){
   int n=s.Read(buffer,offset,buffer.Length-offset);
   if(n<=0)throw new IOException("short fixture read");
   offset+=n;
  }
  if(s.Length!=size)throw new IOException("file changed during read");
  return buffer;
 }
 private static bool Same(byte[] a,byte[] b){
  if(a==null||b==null||a.Length!=b.Length)return false;
  for(int i=0;i<a.Length;i++)if(a[i]!=b[i])return false;
  return true;
 }
 private static bool Same(FileIdInfo a,FileIdInfo b){
  return a.VolumeSerialNumber==b.VolumeSerialNumber&&Same(a.FileId,b.FileId);
 }
 public OmsiTestNativeRaceWitness(string pathname){
  file=pathname;
  handle=OpenAllowed(pathname);
  try{
   stream=new FileStream(handle,FileAccess.Read,4096,false);
   beforeId=Id(handle);
   beforeBytes=ReadSmall(stream);
   if(!Same(beforeId,Id(handle)))throw new IOException("changed on opening");
  }catch{Dispose();throw;}
 }
 public string Recheck(){
  if(closed)throw new ObjectDisposedException("witness");
  try{
   FileIdInfo heldId=Id(handle);
   byte[] heldBytes=ReadSmall(stream);
   if(!Same(beforeId,heldId)||!Same(beforeBytes,heldBytes))
    return "changed-or-unavailable";
   using(SafeFileHandle again=OpenAllowed(file)){
    FileIdInfo pathId=Id(again);
    using(FileStream fresh=new FileStream(again,FileAccess.Read,4096,false)){
     byte[] pathBytes=ReadSmall(fresh);
     if(!Same(beforeId,pathId)||!Same(beforeBytes,pathBytes))
      return "changed-or-unavailable";
    }
   }
   return "observed-stable-untrusted";
  }catch(IOException){return "changed-or-unavailable";}
   catch(UnauthorizedAccessException){return "changed-or-unavailable";}
 }
 public void Dispose(){
  if(!closed){closed=true;if(stream!=null)stream.Dispose();else if(handle!=null)handle.Dispose();}
 }
}
'@ -ErrorAction Stop
 $witness=[OmsiTestNativeRaceWitness]::new($target)
 # The independent Node test receives this boundary before attempting changes.
 [Console]::Out.WriteLine('READY')
 [Console]::Out.Flush()
 $command=[Console]::In.ReadLine()
 if($command -cne 'CONTINUE'){throw 'invalid test control'}
 # Revalidate the marker before accepting any second observation.
 $check=Get-Item -LiteralPath $marker -Force
 if($check.PSIsContainer -or
    ($check.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
    $check.Length -ne 32 -or
    [IO.File]::ReadAllText($marker) -cne $Nonce){throw 'marker changed'}
 $result=$witness.Recheck()
 $report=[ordered]@{
  source='temporary-windows-native-race-fixture'
  outcome=$result
  realNativeHandleHeldAcrossBarrier=$true
  checkedPathThroughSecondHandle=$true
  nativeIdentityApprovedForRealMods=$false
  atomicFilesystemIdentityProven=$false
  directoryDurabilityProven=$false
  cleanupAllowed=$false
  canInstall=$false
  canRecover=$false
  operationsEnabled=$false
  bytesFromGames=0
 }
 [Console]::Out.WriteLine(($report|ConvertTo-Json -Compress))
 exit 0
} catch {
 # No user paths, native FileIDs, or private bytes in diagnostics.
 [Console]::Error.WriteLine('Temporary native race fixture refused.')
 exit 3
} finally {
 if($null -ne $witness){$witness.Dispose()}
}
