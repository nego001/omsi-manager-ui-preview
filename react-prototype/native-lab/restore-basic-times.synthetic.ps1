param(
 [Parameter(Mandatory=$true)][string]$Root,
 [Parameter(Mandatory=$true)][string]$Nonce
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
try {

# Standalone, test-only mutator. Never shipped or called by Electron.
# One exact filename under a direct-child, nonce-marked system TEMP fixture.
$path = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
$temp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\')
if ($Nonce -cnotmatch '^[0-9a-f]{32}$' -or
    [System.IO.Path]::GetDirectoryName($path) -ine $temp -or
    [System.IO.Path]::GetFileName($path) -notmatch '^omsi-manager-recovery-fixture-[A-Za-z0-9]+$') {
 throw 'Synthetic timestamp restoration refused'
}
$dir = [System.IO.Path]::Combine($path,'native-enum')
$file = [System.IO.Path]::Combine($dir,'metadata-probe.scs')
$marker = [System.IO.Path]::Combine($path,'.omsi-test-fixture-marker')
foreach ($item in @($path,$dir,$marker,$file)) {
 $attrs = [System.IO.File]::GetAttributes($item)
 if (($attrs -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
  throw 'Synthetic timestamp restoration refused'
 }
}
if ([System.IO.File]::ReadAllText($marker) -cne $Nonce) {
 throw 'Synthetic timestamp restoration refused'
}
# Windows normally resolves filenames without case sensitivity. Require the
# ACTUAL synthetic child entry to have the exact expected spelling and reject
# unexpected siblings before opening any handle with write-attributes access.
$children = @([System.IO.Directory]::EnumerateFileSystemEntries($dir))
if ($children.Count -ne 1 -or
    [System.IO.Path]::GetFileName($children[0]) -cne 'metadata-probe.scs') {
 throw 'Synthetic timestamp restoration refused'
}
$code = @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

public static class SyntheticBasicTimeRestoration {
    [StructLayout(LayoutKind.Sequential)]
    public struct FileBasicInfo {
        public long CreationTime, LastAccessTime, LastWriteTime, ChangeTime;
        public uint FileAttributes;
    }
    // BY_HANDLE_FILE_INFORMATION contains three FILETIME pairs of DWORDs.
    // Native alignment is 4, not the default managed 8 for Int64 fields.
    [StructLayout(LayoutKind.Sequential, Pack=4)]
    public struct NativeFileInfo {
        public uint Attributes;
        public long Creation, Access, Write;
        public uint VolumeSerial, SizeHigh, SizeLow, NumberOfLinks, IndexHigh, IndexLow;
    }
    [DllImport("kernel32.dll", EntryPoint="CreateFileW", CharSet=CharSet.Unicode,
        SetLastError=true)]
    private static extern SafeFileHandle OpenFile(string path, uint access,
        uint share, IntPtr sec, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", EntryPoint="GetFileInformationByHandleEx",
        SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetBasic(SafeFileHandle handle, int cls,
        out FileBasicInfo info, uint length);
    [DllImport("kernel32.dll", EntryPoint="SetFileInformationByHandle",
        SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetBasic(SafeFileHandle handle, int cls,
        ref FileBasicInfo info, uint length);
    [DllImport("kernel32.dll", EntryPoint="GetFileInformationByHandle",
        SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetNativeInfo(SafeFileHandle handle,
        out NativeFileInfo info);

    private static bool Same(FileBasicInfo a, FileBasicInfo b) {
        return a.CreationTime == b.CreationTime &&
            a.LastAccessTime == b.LastAccessTime &&
            a.LastWriteTime == b.LastWriteTime &&
            a.ChangeTime == b.ChangeTime &&
            a.FileAttributes == b.FileAttributes;
    }

    public static void Run(string file) {
        const uint readAttributes = 0x80, writeAttributes = 0x100;
        FileBasicInfo saved = new FileBasicInfo();
        using (var handle = OpenFile(file, readAttributes|writeAttributes,
                7, IntPtr.Zero, 3, 0x00200000, IntPtr.Zero)) {
            if (handle.IsInvalid)
                throw new IOException("Fixture-only metadata handle unavailable");
            NativeFileInfo raw;
            if (!GetNativeInfo(handle,out raw) || raw.NumberOfLinks != 1 ||
                (raw.Attributes & (0x10u|0x400u)) != 0)
                throw new IOException("Fixture-only regular single-linked file required");
            FileBasicInfo before;
            if (!GetBasic(handle,0,out before,40))
                throw new IOException("Fixture-only basic metadata query failed");
            saved = before;
            byte[] content = File.ReadAllBytes(file);
            try {
                File.WriteAllBytes(file, Encoding.ASCII.GetBytes(
                    "SYNTHETIC FIXTURE INTERMEDIATE CONTENT"));
                File.WriteAllBytes(file,content);
                FileBasicInfo restore = before;
                if (!SetBasic(handle,0,ref restore,40))
                    throw new IOException("Fixture-only time restoration failed");
            }
            finally {
                // On an error never claim restoration or continue with USN evidence.
            }
            FileBasicInfo current;
            if (!GetBasic(handle,0,out current,40) || !Same(before,current))
                throw new IOException("Fixture metadata was not fully restored");
        }
        using (var afterHandle = OpenFile(file, readAttributes,
            7, IntPtr.Zero, 3, 0x00200000, IntPtr.Zero)) {
            if (afterHandle.IsInvalid)
                throw new IOException("Fixture verification handle unavailable");
            FileBasicInfo finalBasic;
            if (!GetBasic(afterHandle,0,out finalBasic,40) ||
                !Same(saved,finalBasic))
                throw new IOException("Fixture metadata differs after handle closure");
            // Caller also validates final bytes and USN; never publish timestamps.
        }
    }
}
'@
Add-Type -TypeDefinition $code -ErrorAction Stop
[SyntheticBasicTimeRestoration]::Run($file)
[Console]::Out.WriteLine('RESTORATION_PERFORMED')
} catch {
 # Nothing about filenames, TEMP paths, nonce, binary content or stack traces
 # is printed by this disposable test-only mutator on refusal.
 [Console]::Error.WriteLine('Synthetic timestamp restoration refused')
 exit 3
}
