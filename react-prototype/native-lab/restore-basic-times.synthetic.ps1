param(
 [Parameter(Mandatory=$true)][string]$Root,
 [Parameter(Mandatory=$true)][string]$Nonce,
 [switch]$HoldAfterPin,
 [switch]$InjectPostRestoreCorruptionForTest,
 [switch]$HoldAfterIntermediateForTest,
 [switch]$HoldAfterRestoredBytesForTest
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
using System.Text.RegularExpressions;
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
            string expectedName, bool directory, bool writer, bool verifier,
            bool ancestor = false, bool readBytes = false) {
        // Only three hardcoded fixture child names can ever be requested.
        // Dynamic root is allowed ONLY as the direct child of a pinned TEMP
        // handle, with the same strict synthetic fixture prefix as the PS gate.
        bool fixedChild = expectedName == "native-enum" ||
            expectedName == ".omsi-test-fixture-marker" ||
            expectedName == "metadata-probe.scs";
        bool fixtureRoot = directory && !writer && !verifier &&
            expectedName.Length <= 96 && Regex.IsMatch(expectedName,
                @"^omsi-manager-recovery-fixture-[A-Za-z0-9]+$",
                RegexOptions.CultureInvariant);
        // Ancestor names come only from the absolute TEMP path being pinned.
        // Disallow traversal, streams and ambiguous Win32 trailing aliases.
        bool ancestorPart = ancestor && directory && !writer && !verifier &&
            expectedName.Length > 0 && expectedName.Length <= 255 &&
            expectedName != "." && expectedName != ".." &&
            !expectedName.EndsWith(".") && !expectedName.EndsWith(" ") &&
            expectedName.IndexOfAny(new char[]{'\\', '/', ':', '\0'}) < 0;
        if (!fixedChild && !fixtureRoot && !ancestorPart)
            throw new IOException("Unexpected fixture child");
        // Read-data verification only for the one immutable fake target;
        // never for markers, other descendants or a user-provided pathname.
        if (readBytes && (!verifier || directory || writer ||
            expectedName != "metadata-probe.scs"))
            throw new IOException("Unexpected fixture data verification");
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
            if (directory || !verifier || readBytes) access |= 1; // list directory/read data
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

    // Build a complete, read-only ancestry chain for TEMP. Only the volume
    // root has an absolute CreateFileW open; all later names resolve relative
    // to the corresponding pinned parent directory handle.
    private sealed class AncestorPins : IDisposable {
        private readonly System.Collections.Generic.List<SafeFileHandle> handles =
            new System.Collections.Generic.List<SafeFileHandle>();
        private readonly System.Collections.Generic.List<string> paths =
            new System.Collections.Generic.List<string>();
        public SafeFileHandle TemporaryHandle {
            get { return handles[handles.Count - 1]; }
        }
        public static AncestorPins Pin(string temporaryPath) {
            AncestorPins pins = new AncestorPins();
            try {
                string temp = Path.GetFullPath(temporaryPath).TrimEnd('\\');
                string volume = Path.GetPathRoot(temp);
                // Only a local drive volume is allowed by this Windows-only
                // disposable test. Reject UNC and device namespace paths.
                if (String.IsNullOrEmpty(volume) || volume.Length != 3 ||
                    !Char.IsLetter(volume[0]) || volume[1] != ':' ||
                    volume[2] != '\\' ||
                    temp.Length <= volume.Length)
                    throw new IOException("Nonlocal temporary ancestor");
                const uint readAttributes = 0x80, readData = 1;
                const uint shareRead = 1, openExisting = 3;
                const uint backupSemantics = 0x02000000, openReparse = 0x00200000;
                SafeFileHandle disk = OpenFile(volume, readAttributes | readData,
                    shareRead, IntPtr.Zero, openExisting,
                    backupSemantics | openReparse, IntPtr.Zero);
                if (disk == null || disk.IsInvalid) {
                    if (disk != null) disk.Dispose();
                    throw new IOException("Volume root unavailable");
                }
                try {
                    CheckDirectory(disk);
                    pins.handles.Add(disk);
                    pins.paths.Add(volume);
                } catch { disk.Dispose(); throw; }
                string remainder = temp.Substring(volume.Length);
                foreach (string part in remainder.Split(new char[]{'\\'},
                           StringSplitOptions.RemoveEmptyEntries)) {
                    SafeFileHandle next = OpenChild(
                        pins.handles[pins.handles.Count - 1], part,
                        true, false, false, true);
                    string absolute = Path.Combine(
                        pins.paths[pins.paths.Count - 1], part);
                    pins.handles.Add(next);
                    pins.paths.Add(absolute);
                }
                pins.Verify();
                return pins;
            } catch {
                pins.Dispose();
                throw;
            }
        }
        public void Verify() {
            const uint readAttributes = 0x80, shareRead = 1, openExisting = 3;
            const uint backupSemantics = 0x02000000, openReparse = 0x00200000;
            for (int i = 0; i < handles.Count; i++) {
                CheckDirectory(handles[i]);
                // Independently resolve each absolute ancestor for identity
                // consistency, never for file content or write authority.
                using (SafeFileHandle named = OpenFile(paths[i], readAttributes,
                    shareRead, IntPtr.Zero, openExisting,
                    backupSemantics | openReparse, IntPtr.Zero)) {
                    CheckDirectory(named);
                    if (!SameId(NativeInfo(handles[i]), NativeInfo(named)))
                        throw new IOException("Ancestor pathname mismatch");
                }
                if (i > 0) {
                    using (SafeFileHandle relative = OpenChild(handles[i - 1],
                        Path.GetFileName(paths[i]), true, false, false, true)) {
                        if (!SameId(NativeInfo(handles[i]), NativeInfo(relative)))
                            throw new IOException("Ancestor relative mismatch");
                    }
                }
            }
        }
        public void Dispose() {
            for (int i = handles.Count - 1; i >= 0; i--)
                handles[i].Dispose();
            handles.Clear();
            paths.Clear();
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
    // Re-validate only the fixed synthetic scope. This is a fail-closed
    // checkpoint after the deliberate race barrier, NOT an atomic filesystem
    // transaction and not a general-purpose mod writer.
    private static void CheckPinnedFixture(
            AncestorPins ancestors, string root, string directory,
            SafeFileHandle rootHandle, SafeFileHandle directoryHandle,
            SafeFileHandle markerHandle, FileStream markerStream, string nonce,
            SafeFileHandle fileHandle, NativeFileInfo rootId,
            NativeFileInfo directoryId, NativeFileInfo markerId,
            NativeFileInfo fileId, FileBasicInfo fileBasic) {
        ancestors.Verify();
        if (!SameId(rootId, NativeInfo(rootHandle)) ||
            !SameId(directoryId, NativeInfo(directoryHandle)) ||
            !SameId(markerId, NativeInfo(markerHandle)) ||
            !SameId(fileId, NativeInfo(fileHandle)))
            throw new IOException("Pinned fixture identity diverged");
        CheckDirectory(rootHandle);
        CheckDirectory(directoryHandle);
        NativeFileInfo markerNow = NativeInfo(markerHandle);
        NativeFileInfo fileNow = NativeInfo(fileHandle);
        if (markerNow.NumberOfLinks != 1 ||
            fileNow.NumberOfLinks != 1 ||
            (markerNow.Attributes & (0x10u | 0x400u)) != 0 ||
            (fileNow.Attributes & (0x10u | 0x400u)) != 0)
            throw new IOException("Pinned fixture type or link count diverged");

        // Prevent added siblings from changing the scan's scope. Directory
        // names are read only to validate this disposable fixed fixture.
        AssertExactRootNames(root);
        string[] entries = Directory.GetFileSystemEntries(directory);
        if (entries.Length != 1 ||
            !String.Equals(Path.GetFileName(entries[0]),
                "metadata-probe.scs", StringComparison.Ordinal))
            throw new IOException("Pinned fixture child set diverged");

        markerStream.Position = 0;
        CheckNonce(markerStream, nonce);
        FileBasicInfo current;
        if (!GetBasic(fileHandle, 0, out current, 40) ||
            !Same(fileBasic, current))
            throw new IOException("Pinned fixture metadata diverged");

        using (SafeFileHandle currentRoot = OpenChild(
            ancestors.TemporaryHandle, Path.GetFileName(root),
            true, false, false))
        using (SafeFileHandle currentDirectory = OpenChild(
            rootHandle, "native-enum", true, false, false))
        using (SafeFileHandle currentMarker = OpenChild(
            rootHandle, ".omsi-test-fixture-marker", false, false, true))
        using (SafeFileHandle currentTarget = OpenChild(
            directoryHandle, "metadata-probe.scs", false, false, true)) {
            if (!SameId(rootId, NativeInfo(currentRoot)) ||
                !SameId(directoryId, NativeInfo(currentDirectory)) ||
                !SameId(markerId, NativeInfo(currentMarker)) ||
                !SameId(fileId, NativeInfo(currentTarget)))
                throw new IOException("Relative fixture path changed");
        }
    }

    // Exact bounded comparison using an already authenticated, open handle.
    // Length and every byte must match, not merely metadata or a hash.
    private static void VerifyExact(FileStream stream, byte[] expected) {
        if (stream.Length != expected.Length)
            throw new IOException("Synthetic fixture byte length diverged");
        stream.Position = 0;
        for (int i = 0; i < expected.Length; i++)
            if (stream.ReadByte() != expected[i])
                throw new IOException("Synthetic fixture byte content diverged");
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
    public static void Run(string temp, string root, string directory,
                           string file, string marker, string nonce,
                           bool holdAfterPin, bool injectCorruption,
                           bool holdIntermediate, bool holdRestoredBytes) {
        const uint readAttributes = 0x80;
        const uint shareRead = 0x1;
        const uint openExisting = 3, openReparse = 0x00200000;
        const uint backupSemantics = 0x02000000;
        byte[] original = Encoding.ASCII.GetBytes(
            "SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS");
        byte[] intermediate = Encoding.ASCII.GetBytes(
            "SYNTHETIC FIXTURE INTERMEDIATE CONTENT");
        // The two mid-write gates are opt-in for independent CI test processes.
        // They cannot be combined with each other or the corruption injector.
        if (injectCorruption && !holdAfterPin ||
            (holdIntermediate || holdRestoredBytes) && !holdAfterPin ||
            holdIntermediate && holdRestoredBytes ||
            injectCorruption && (holdIntermediate || holdRestoredBytes))
            throw new IOException("Test-only fault requires isolated barrier");

        // The entire local volume-to-TEMP chain is pinned first. The
        // fixture root and every writable descendant use relative handles.
        // No path-based handle is used to authorize a write.
        using (var ancestors = AncestorPins.Pin(temp)) {
            using (var rootHandle = OpenChild(ancestors.TemporaryHandle,
                        Path.GetFileName(root), true, false, false)) {
            CheckDirectory(rootHandle);
            AssertExactRootNames(root);
            using (var rootPathCheck = OpenFile(root,
                    readAttributes, shareRead, IntPtr.Zero, openExisting,
                    backupSemantics | openReparse, IntPtr.Zero)) {
                CheckDirectory(rootPathCheck);
                if (!SameId(NativeInfo(rootHandle), NativeInfo(rootPathCheck)))
                    throw new IOException("Fixture root pathname diverged");
            }
            using (var directoryHandle = OpenChild(rootHandle,
                        "native-enum", true, false, false))
            using (var markerHandle = OpenChild(rootHandle,
                        ".omsi-test-fixture-marker", false, false, false))
            using (var fileHandle = OpenChild(directoryHandle,
                        "metadata-probe.scs", false, true, false)) {
            CheckDirectory(directoryHandle);
            NativeFileInfo markerInfo = NativeInfo(markerHandle);
            if ((markerInfo.Attributes & (0x10u | 0x400u)) != 0 ||
                markerInfo.NumberOfLinks != 1)
                throw new IOException("Marker is not a single regular file");
            using (var markerStream = new FileStream(markerHandle, FileAccess.Read,
                                                      4096, false)) {
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
            NativeFileInfo pinnedRootId = NativeInfo(rootHandle);
            NativeFileInfo pinnedDirectoryId = NativeInfo(directoryHandle);
            NativeFileInfo pinnedMarkerId = NativeInfo(markerHandle);

            using (var stream = new FileStream(fileHandle, FileAccess.ReadWrite,
                                                4096, false)) {
                // Refuse every byte sequence except the exact hardcoded fixture.
                // All reads and writes use the same pinned fake file handle.
                VerifyExact(stream, original);

                FileBasicInfo before;
                if (!GetBasic(fileHandle, 0, out before, 40))
                    throw new IOException("Cannot read fixture metadata");
                if (holdAfterPin) {
                    Console.Out.WriteLine("HANDLE_HELD");
                    Console.Out.Flush();
                    if (Console.In.ReadLine() != "CONTINUE")
                        throw new IOException("Test barrier refused");
                }

                CheckPinnedFixture(ancestors, root, directory,
                    rootHandle, directoryHandle, markerHandle, markerStream, nonce,
                    fileHandle, pinnedRootId, pinnedDirectoryId, pinnedMarkerId,
                    initialIdentity, before);

                // Verify the intermediate state and the restored bytes through
                // the SAME native handle, while the write lock stays held.
                VerifyExact(stream, original);
                WriteExact(stream, intermediate);
                VerifyExact(stream, intermediate);
                if (holdIntermediate) {
                    // Kill the disposable child here: a flushed intermediate
                    // state must remain, with NO success acknowledgement.
                    Console.Out.WriteLine("INTERMEDIATE_HELD");
                    Console.Out.Flush();
                    if (Console.In.ReadLine() != "CONTINUE")
                        throw new IOException("Intermediate test barrier refused");
                }
                WriteExact(stream, original);
                VerifyExact(stream, original);
                if (holdRestoredBytes) {
                    // Bytes are original, but four timestamps have NOT yet
                    // been restored. This is not a committed operation.
                    Console.Out.WriteLine("RESTORED_BYTES_HELD");
                    Console.Out.Flush();
                    if (Console.In.ReadLine() != "CONTINUE")
                        throw new IOException("Restored-bytes test barrier refused");
                }
                FileBasicInfo restore = before;
                if (!SetBasic(fileHandle, 0, ref restore, 40))
                    throw new IOException("Fixture time restoration failed");

                FileBasicInfo current;
                if (!GetBasic(fileHandle, 0, out current, 40) ||
                    !Same(before, current) ||
                    !SameId(initialIdentity, NativeInfo(fileHandle)))
                    throw new IOException("Pinned fixture metadata changed");

                // Fault injection only on nonce-authenticated disposable
                // fixtures after the HELD/CONTINUE test barrier. Deliberately
                // does NOT roll back a damaged fixture; tests attest refusal.
                if (injectCorruption) {
                    stream.Position = 0;
                    stream.WriteByte((byte)'X');
                    stream.Flush(true);
                }
                VerifyExact(stream, original);

                // Validate ancestry and synthetic contents again after
                // restoration. This detects a scope change but is not rollback.
                CheckPinnedFixture(ancestors, root, directory,
                    rootHandle, directoryHandle, markerHandle, markerStream, nonce,
                    fileHandle, pinnedRootId, pinnedDirectoryId, pinnedMarkerId,
                    initialIdentity, before);

                // Cross-check the path while the original handle still denies
                // DELETE and external WRITE access. The second handle shares
                // WRITE only with our already pinned writer.
                using (var verification = OpenChild(directoryHandle,
                        "metadata-probe.scs", false, false, true, false, true)) {
                    NativeFileInfo reopened = NativeInfo(verification);
                    FileBasicInfo finalBasic;
                    if (!SameId(initialIdentity, reopened) ||
                        !GetBasic(verification, 0, out finalBasic, 40) ||
                        !Same(before, finalBasic))
                        throw new IOException("Pinned file/path identity diverged");
                    using (var reader = new FileStream(
                            verification, FileAccess.Read, 4096, false)) {
                        VerifyExact(reader, original);
                    }
                }
            }
            } // markerStream remains open until file verification finishes
            } // child handles remain pinned until all writes have completed
            } // fixture root is opened relative to the TEMP parent handle
        } // Pinned volume-to-TEMP ancestors are released last
    }
}
'@
Add-Type -TypeDefinition $code -ErrorAction Stop
[SyntheticBasicTimeRestoration]::Run($temp,$path,$dir,$file,$marker,$Nonce,[bool]$HoldAfterPin,[bool]$InjectPostRestoreCorruptionForTest,[bool]$HoldAfterIntermediateForTest,[bool]$HoldAfterRestoredBytesForTest)
[Console]::Out.WriteLine('RESTORATION_PERFORMED')
} catch {
 # Nothing about filenames, TEMP paths, nonce, binary content or stack traces
 # is printed by this disposable test-only mutator on refusal.
 [Console]::Error.WriteLine('Synthetic timestamp restoration refused')
 exit 3
}
