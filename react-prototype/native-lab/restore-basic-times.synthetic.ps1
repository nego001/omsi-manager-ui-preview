param(
 [Parameter(Mandatory=$true)][string]$Root,
 [Parameter(Mandatory=$true)][string]$Nonce,
 [switch]$HoldAfterPin
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$script:syntheticPhase = 'parameters'
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
    public static string DiagnosticGate = "entry";
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

    // Child opens are relative to already pinned directory handles. Do not
    // let Win32 resolve any intermediate pathname during a fixture write.
    [StructLayout(LayoutKind.Sequential)]
    private struct UnicodeString {
        public ushort Length, MaximumLength;
        public IntPtr Buffer;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct ObjectAttributes {
        public uint Length;
        public IntPtr RootDirectory, ObjectName;
        public uint Attributes;
        public IntPtr SecurityDescriptor, SecurityQualityOfService;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct IoStatusBlock {
        public IntPtr Status, Information;
    }
    [DllImport("ntdll.dll", ExactSpelling=true)]
    private static extern int NtOpenFile(out SafeFileHandle handle,
        uint desiredAccess, ref ObjectAttributes attributes,
        out IoStatusBlock ioStatus, uint shareAccess, uint openOptions);

    private static SafeFileHandle OpenChild(SafeFileHandle parent,
            string expectedName, bool directory, bool writer, bool verifier) {
        // Only three hardcoded fixture child names can ever be requested.
        if (expectedName != "native-enum" &&
            expectedName != ".omsi-test-fixture-marker" &&
            expectedName != "metadata-probe.scs")
            throw new IOException("Unexpected fixture child");
        DiagnosticGate = "child-open:" + expectedName;
        const uint readAttributes = 0x80, writeAttributes = 0x100;
        const uint synchronize = 0x00100000;
        const uint shareRead = 1, shareReadWrite = 3;
        const uint openReparse = 0x00200000, syncIo = 0x20;
        const uint directoryFile = 1, nonDirectoryFile = 0x40;
        const uint caseInsensitive = 0x40;
        IntPtr namePointer = IntPtr.Zero;
        IntPtr unicodePointer = IntPtr.Zero;
        try {
            namePointer = Marshal.StringToHGlobalUni(expectedName);
            UnicodeString name = new UnicodeString {
                Length = checked((ushort)(expectedName.Length * 2)),
                MaximumLength = checked((ushort)((expectedName.Length + 1) * 2)),
                Buffer = namePointer
            };
            unicodePointer = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(UnicodeString)));
            Marshal.StructureToPtr(name, unicodePointer, false);
            ObjectAttributes attributes = new ObjectAttributes {
                Length = (uint)Marshal.SizeOf(typeof(ObjectAttributes)),
                RootDirectory = parent.DangerousGetHandle(),
                ObjectName = unicodePointer,
                Attributes = caseInsensitive
            };
            uint access = readAttributes | synchronize;
            if (directory || !verifier) access |= 1; // list directory/read data
            if (writer) access |= 2 | writeAttributes;
            uint options = syncIo | openReparse |
                (directory ? directoryFile : nonDirectoryFile);
            SafeFileHandle child;
            IoStatusBlock io;
            int status = NtOpenFile(out child, access, ref attributes, out io,
                verifier ? shareReadWrite : shareRead, options);
            if (status < 0 || child == null || child.IsInvalid) {
                if (child != null) child.Dispose();
                throw new IOException("Relative fixture open refused");
            }
            NativeFileInfo info = NativeInfo(child);
            if ((info.Attributes & 0x400u) != 0 ||
                ((info.Attributes & 0x10u) != 0) != directory) {
                child.Dispose();
                throw new IOException("Relative fixture is wrong type");
            }
            return child;
        } finally {
            if (unicodePointer != IntPtr.Zero) Marshal.FreeHGlobal(unicodePointer);
            if (namePointer != IntPtr.Zero) Marshal.FreeHGlobal(namePointer);
        }
    }

    private static void AssertExactRootNames(string root) {
        bool markerFound = false, directoryFound = false;
        string[] entries = Directory.GetFileSystemEntries(root);
        foreach (string entry in entries) {
            string name = Path.GetFileName(entry);
            if (String.Equals(name, ".omsi-test-fixture-marker",
                              StringComparison.OrdinalIgnoreCase)) {
                if (!String.Equals(name, ".omsi-test-fixture-marker",
                                   StringComparison.Ordinal) || markerFound)
                    throw new IOException("Marker spelling differs");
                markerFound = true;
            }
            if (String.Equals(name, "native-enum",
                              StringComparison.OrdinalIgnoreCase)) {
                if (!String.Equals(name, "native-enum",
                                   StringComparison.Ordinal) || directoryFound)
                    throw new IOException("Directory spelling differs");
                directoryFound = true;
            }
        }
        if (!markerFound || !directoryFound)
            throw new IOException("Expected root fixture names absent");
    }

    private static bool Same(FileBasicInfo a, FileBasicInfo b) {
        return a.CreationTime == b.CreationTime &&
            a.LastAccessTime == b.LastAccessTime &&
            a.LastWriteTime == b.LastWriteTime &&
            a.ChangeTime == b.ChangeTime &&
            a.FileAttributes == b.FileAttributes;
    }

    private static NativeFileInfo NativeInfo(SafeFileHandle handle) {
        if (handle.IsInvalid) throw new IOException("Fixture handle invalid");
        NativeFileInfo info;
        if (!GetNativeInfo(handle, out info))
            throw new IOException("Fixture metadata unavailable");
        return info;
    }
    private static bool SameId(NativeFileInfo a, NativeFileInfo b) {
        return a.VolumeSerial == b.VolumeSerial &&
            a.IndexHigh == b.IndexHigh && a.IndexLow == b.IndexLow;
    }
    private static void CheckDirectory(SafeFileHandle handle) {
        NativeFileInfo info = NativeInfo(handle);
        if ((info.Attributes & 0x10u) == 0 ||
            (info.Attributes & 0x400u) != 0)
            throw new IOException("Only real fixture directories permitted");
    }
    private static void CheckNonce(FileStream stream, string nonce) {
        byte[] expected = Encoding.ASCII.GetBytes(nonce);
        if (stream.Length != expected.Length)
            throw new IOException("Marker length changed");
        for (int i = 0; i < expected.Length; i++)
            if (stream.ReadByte() != expected[i])
                throw new IOException("Marker changed");
    }
    private static void WriteExact(FileStream stream, byte[] bytes) {
        stream.Position = 0;
        stream.Write(bytes, 0, bytes.Length);
        stream.SetLength(bytes.Length);
        stream.Flush(true);
    }

    // Open and pin all three path components BEFORE writing. FILE_SHARE_READ
    // intentionally omits FILE_SHARE_DELETE/WRITE: Windows refuses concurrent
    // pathname replacement, renaming and new writers while our handles live.
    // The ONLY mutation is through the already pinned, single-link SafeFileHandle.
    // This narrows TOCTOU; it is not proof against privileged kernel adversaries.
    public static void Run(string root, string directory, string file,
                           string marker, string nonce, bool holdAfterPin) {
        const uint readData = 0x1, writeData = 0x2;
        const uint readAttributes = 0x80, writeAttributes = 0x100;
        const uint shareRead = 0x1, shareReadWrite = 0x3;
        const uint openExisting = 3, openReparse = 0x00200000;
        const uint backupSemantics = 0x02000000;
        byte[] original = Encoding.ASCII.GetBytes(
            "SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS");
        byte[] intermediate = Encoding.ASCII.GetBytes(
            "SYNTHETIC FIXTURE INTERMEDIATE CONTENT");

        DiagnosticGate = "root-open";
        using (var rootHandle = OpenFile(root, readAttributes | readData,
                    shareRead, IntPtr.Zero, openExisting,
                    backupSemantics | openReparse, IntPtr.Zero)) {
            DiagnosticGate = "root-check";
            CheckDirectory(rootHandle);
            DiagnosticGate = "root-names";
            AssertExactRootNames(root);
            using (var directoryHandle = OpenChild(rootHandle,
                        "native-enum", true, false, false))
            using (var markerHandle = OpenChild(rootHandle,
                        ".omsi-test-fixture-marker", false, false, false))
            using (var fileHandle = OpenChild(directoryHandle,
                        "metadata-probe.scs", false, true, false)) {
            DiagnosticGate = "children-verified";
            CheckDirectory(directoryHandle);
            NativeFileInfo markerInfo = NativeInfo(markerHandle);
            if ((markerInfo.Attributes & (0x10u | 0x400u)) != 0 ||
                markerInfo.NumberOfLinks != 1)
                throw new IOException("Marker is not a single regular file");
            using (var markerStream = new FileStream(markerHandle, FileAccess.Read,
                                                      4096, false)) {
                DiagnosticGate = "nonce-check";
                CheckNonce(markerStream, nonce);

            // Recheck exact spelling while each directory and target is pinned.
            string[] entries = Directory.GetFileSystemEntries(directory);
            if (entries.Length != 1 ||
                !String.Equals(Path.GetFileName(entries[0]),
                               "metadata-probe.scs", StringComparison.Ordinal))
                throw new IOException("Unexpected fixture entry");
            NativeFileInfo initialIdentity = NativeInfo(fileHandle);
            if (initialIdentity.NumberOfLinks != 1 ||
                (initialIdentity.Attributes & (0x10u | 0x400u)) != 0)
                throw new IOException("Only a single linked regular fake file permitted");

            using (var stream = new FileStream(fileHandle, FileAccess.ReadWrite,
                                                4096, false)) {
                // Refuse unknown bytes, including a real mod moved into the
                // disposable directory. No user-selected content is writable.
                if (stream.Length != original.Length)
                    throw new IOException("Unknown fixture content length");
                for (int i = 0; i < original.Length; i++)
                    if (stream.ReadByte() != original[i])
                        throw new IOException("Unknown fixture contents");

                FileBasicInfo before;
                if (!GetBasic(fileHandle, 0, out before, 40))
                    throw new IOException("Cannot read fixture metadata");
                if (holdAfterPin) {
                    Console.Out.WriteLine("HANDLE_HELD");
                    Console.Out.Flush();
                    if (Console.In.ReadLine() != "CONTINUE")
                        throw new IOException("Test barrier refused");
                }

                DiagnosticGate = "write";
                WriteExact(stream, intermediate);
                WriteExact(stream, original);
                FileBasicInfo restore = before;
                if (!SetBasic(fileHandle, 0, ref restore, 40))
                    throw new IOException("Fixture time restoration failed");

                FileBasicInfo current;
                if (!GetBasic(fileHandle, 0, out current, 40) ||
                    !Same(before, current) ||
                    !SameId(initialIdentity, NativeInfo(fileHandle)))
                    throw new IOException("Pinned fixture metadata changed");

                // Cross-check the path while the original handle still denies
                // DELETE and external WRITE access. The second handle shares
                // WRITE only with our already pinned writer.
                DiagnosticGate = "final-verification";
                using (var verification = OpenChild(directoryHandle,
                        "metadata-probe.scs", false, false, true)) {
                    NativeFileInfo reopened = NativeInfo(verification);
                    FileBasicInfo finalBasic;
                    if (!SameId(initialIdentity, reopened) ||
                        !GetBasic(verification, 0, out finalBasic, 40) ||
                        !Same(before, finalBasic))
                        throw new IOException("Pinned file/path identity diverged");
                }
            }
            } // markerStream remains open and locks the nonce marker until exit
            } // child handles are pinned to the verified root/directory
        } // root handle is released last
    }
}
'@
$script:syntheticPhase = 'compile'
Add-Type -TypeDefinition $code -ErrorAction Stop
$script:syntheticPhase = 'native'
[SyntheticBasicTimeRestoration]::Run($path,$dir,$file,$marker,$Nonce,[bool]$HoldAfterPin)
[Console]::Out.WriteLine('RESTORATION_PERFORMED')
} catch {
 if ($env:OMSI_SYNTHETIC_DIAG -ceq '1') {
  [Console]::Error.WriteLine('SYNTHETIC_PHASE=' + $script:syntheticPhase)
  if ($script:syntheticPhase -eq 'compile') {
   $safeCodes = @([regex]::Matches(($_.Exception.ToString()), 'CS[0-9]{4}') |
      ForEach-Object { $_.Value } | Select-Object -Unique)
   [Console]::Error.WriteLine('SYNTHETIC_COMPILE_CODES=' + ($safeCodes -join ','))
   [Console]::Error.WriteLine('SYNTHETIC_ERROR_CLASS=' + $_.Exception.GetType().Name)
  }
  if ($script:syntheticPhase -eq 'native') {
   [Console]::Error.WriteLine('SYNTHETIC_GATE=' + [SyntheticBasicTimeRestoration]::DiagnosticGate)
  }
 }
 # Nothing about filenames, TEMP paths, nonce, binary content or stack traces
 # is printed by this disposable test-only mutator on refusal.
 [Console]::Error.WriteLine('Synthetic timestamp restoration refused')
 exit 3
}
