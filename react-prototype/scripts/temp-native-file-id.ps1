# TEST-ONLY. Windows native read-only FileIdInfo observation for a marker-bound
# disposable fixture in os.tmpdir(). Never called by Electron/preload/IPC.
param(
 [Parameter(Mandatory=$true)][string]$Root,
 [Parameter(Mandatory=$true)][string]$Nonce
)
$ErrorActionPreference='Stop'
try {
 if ($Nonce -cnotmatch '^[0-9a-f]{32}$') { throw 'invalid fixture id' }
 $base=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\','/')
 $canonical=[IO.Path]::GetFullPath($Root).TrimEnd('\','/')
 $name=[IO.Path]::GetFileName($canonical)
 if ([IO.Path]::GetDirectoryName($canonical) -ine $base -or
     $name -cnotmatch '^omsi-manager-recovery-fixture-[a-zA-Z0-9_-]+$') {
  throw 'outside fixture scope'
 }
 $directory=Get-Item -LiteralPath $canonical -Force -ErrorAction Stop
 if (-not $directory.PSIsContainer -or
     ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
  throw 'unsafe fixture directory'
 }
 $marker=Join-Path $canonical '.omsi-test-fixture-marker'
 $markerInfo=Get-Item -LiteralPath $marker -Force -ErrorAction Stop
 if ($markerInfo.PSIsContainer -or
     ($markerInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
     $markerInfo.Length -ne 32 -or
     [IO.File]::ReadAllText($marker) -cne $Nonce) {
  throw 'fixture marker invalid'
 }
 $target=Join-Path $canonical 'identity-target.bin'
 # C# performs the file type / reparse check on the OS handle itself.
 Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Security.Cryptography;
using System.ComponentModel;
using Microsoft.Win32.SafeHandles;
using System.Runtime.InteropServices;

public static class OmsiTemporaryNativeFileIdProbe
{
 [StructLayout(LayoutKind.Sequential)]
 private struct FileIdInfo {
  public ulong VolumeSerialNumber;
  [MarshalAs(UnmanagedType.ByValArray, SizeConst=16)]
  public byte[] FileId;
 }
 [StructLayout(LayoutKind.Sequential)]
 private struct FileAttributeTagInfo {
  public uint FileAttributes;
  public uint ReparseTag;
 }
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true, EntryPoint="CreateFileW")]
 private static extern SafeFileHandle CreateFile(
  string name,uint access,uint sharing,IntPtr security,
  uint disposition,uint flags,IntPtr templateFile);
 [DllImport("kernel32.dll", SetLastError=true, EntryPoint="GetFileInformationByHandleEx")]
 [return: MarshalAs(UnmanagedType.Bool)]
 private static extern bool GetFileId(
  SafeFileHandle handle,int kind,out FileIdInfo info,uint size);
 [DllImport("kernel32.dll", SetLastError=true, EntryPoint="GetFileInformationByHandleEx")]
 [return: MarshalAs(UnmanagedType.Bool)]
 private static extern bool GetFileAttributesByHandle(
  SafeFileHandle handle,int kind,out FileAttributeTagInfo info,uint size);

 private static byte[] CollectReadOnly(string pathname)
 {
  const uint GENERIC_READ=0x80000000;
  const uint FILE_SHARE_READ_WRITE_DELETE=7;
  const uint OPEN_EXISTING=3;
  const uint OPEN_REPARSE_POINT=0x00200000;
  using(SafeFileHandle handle=CreateFile(pathname,GENERIC_READ,
    FILE_SHARE_READ_WRITE_DELETE,IntPtr.Zero,OPEN_EXISTING,
    OPEN_REPARSE_POINT,IntPtr.Zero))
  {
   if(handle.IsInvalid) throw new IOException("file cannot be opened");
   FileAttributeTagInfo tag;
   if(!GetFileAttributesByHandle(handle,9,out tag,
     (uint)Marshal.SizeOf(typeof(FileAttributeTagInfo))))
     throw new IOException("file attributes unavailable");
   if((tag.FileAttributes & 0x400u)!=0u || (tag.FileAttributes & 0x10u)!=0u)
     throw new IOException("reparse point or directory refused");
   FileIdInfo first;
   if(!GetFileId(handle,18,out first,
     (uint)Marshal.SizeOf(typeof(FileIdInfo))))
     throw new IOException("native file ID unavailable");
   if(first.FileId==null||first.FileId.Length!=16)
     throw new IOException("invalid native file ID");
   byte[] bytes;
   using(FileStream stream=new FileStream(handle,FileAccess.Read,4096,false))
   {
    long length=stream.Length;
    if(length<1||length>4096)throw new IOException("fixture size refused");
    bytes=new byte[(int)length];
    int offset=0;
    while(offset<bytes.Length) {
     int got=stream.Read(bytes,offset,bytes.Length-offset);
     if(got==0)throw new IOException("incomplete fixture read");
     offset+=got;
    }
    if(stream.Length!=length)throw new IOException("file length changed");
    FileIdInfo after;
    if(!GetFileId(handle,18,out after,
       (uint)Marshal.SizeOf(typeof(FileIdInfo))) ||
       after.VolumeSerialNumber!=first.VolumeSerialNumber ||
       !Same(first.FileId,after.FileId))
      throw new IOException("file ID changed while opened");
   }
   // Hash binds volume+file ID+observed bytes, but remains untrusted evidence.
   using(SHA256 sha=SHA256.Create())
   {
    byte[] digest=sha.ComputeHash(bytes);
    byte[] evidence=new byte[8+16+digest.Length];
    Array.Copy(BitConverter.GetBytes(first.VolumeSerialNumber),0,evidence,0,8);
    Array.Copy(first.FileId,0,evidence,8,16);
    Array.Copy(digest,0,evidence,24,digest.Length);
    return evidence;
   }
  }
 }
 private static bool Same(byte[] a,byte[] b) {
  if(a==null||b==null||a.Length!=b.Length)return false;
  for(int i=0;i<a.Length;i++)if(a[i]!=b[i])return false;
  return true;
 }
 public static string Observe(string pathname,string nonce)
 {
  // Both samples use independently obtained native Windows handles.
  byte[] first=CollectReadOnly(pathname);
  byte[] second=CollectReadOnly(pathname);
  if(!Same(first,second))throw new IOException("file changed between handles");
  using(SHA256 sha=SHA256.Create())
  {
   byte[] prefix=System.Text.Encoding.UTF8.GetBytes(nonce+":");
   byte[] input=new byte[prefix.Length+first.Length];
   Array.Copy(prefix,input,prefix.Length);
   Array.Copy(first,0,input,prefix.Length,first.Length);
   return BitConverter.ToString(sha.ComputeHash(input)).Replace("-","");
  }
 }
}
'@ -ErrorAction Stop
 $fingerprint=[OmsiTemporaryNativeFileIdProbe]::Observe($target,$Nonce)
 # Raw file IDs, volume serial, paths, PID, and private bytes are never emitted.
 $report=[ordered]@{
  source='temporary-windows-native-fixture'
  status='observed-stable-untrusted'
  nativeFileIdObserved=$true
  nativeHandlesOpened=2
  reparseHandleCheckPerformed=$true
  fixtureBoundFingerprint=$fingerprint.ToLowerInvariant()
  identityAuthorizedForRealMods=$false
  atomicPathIdentityProven=$false
  processIdentityNativeVerified=$false
  directoryDurabilityProven=$false
  canRecover=$false
  canInstall=$false
  canDelete=$false
  operationsEnabled=$false
  filesModifiedInGames=0
 }
 [Console]::Out.WriteLine(($report | ConvertTo-Json -Compress -Depth 3))
 exit 0
} catch {
 # No exception, path, or raw Windows information is printed to the caller.
 [Console]::Error.WriteLine('Temporary native file identity fixture refused.')
 exit 3
}
