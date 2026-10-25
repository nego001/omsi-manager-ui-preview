// Isolated Windows native directory lab. Never installed with Electron.
// Accepts only a marker-bound direct child of the process TEMP folder.
// Observations are not authorizations and no game file contents are opened.
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Win32.SafeHandles;

internal static class Program
{
    private const int EntryLimit = 128;
    private const int BufferSize = 65536;
    private const int PageLimit = 16;
    private const string Refusal = "Temporary standalone native directory lab refused.";
    private const int FileIdInfoClass = 18;
    private const int FileAttributeTagInfoClass = 9;
    private const int FileBasicInfoClass = 0;
    private const int FileIdBothDirectoryInfoClass = 10;
    private const int FileIdBothDirectoryRestartInfoClass = 11;
    private const int NoMoreFiles = 18;

    [StructLayout(LayoutKind.Sequential)]
    private struct FileIdInfo
    {
        public ulong VolumeSerialNumber;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)]
        public byte[]? FileId;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct FileAttributeTagInfo
    {
        public uint FileAttributes;
        public uint ReparseTag;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct FileBasicInfo
    {
        public long CreationTime, LastAccessTime, LastWriteTime, ChangeTime;
        public uint FileAttributes;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct FileIdBothDirectoryLayout
    {
        public uint NextEntryOffset, FileIndex;
        public long CreationTime, LastAccessTime, LastWriteTime, ChangeTime;
        public long EndOfFile, AllocationSize;
        public uint FileAttributes, FileNameLength, EaSize;
        public byte ShortNameLength;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 12)]
        public ushort[]? ShortName;
        public long FileId;
        public ushort FileName;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, EntryPoint = "CreateFileW", SetLastError = true)]
    private static extern SafeFileHandle CreateFile(
        string name, uint access, uint share, IntPtr security,
        uint creation, uint flags, IntPtr templateFile);

    [DllImport("kernel32.dll", EntryPoint = "GetFileInformationByHandleEx", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool QueryId(
        SafeFileHandle handle, int infoClass, out FileIdInfo info, uint size);

    [DllImport("kernel32.dll", EntryPoint = "GetFileInformationByHandleEx", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool QueryTag(
        SafeFileHandle handle, int infoClass, out FileAttributeTagInfo info, uint size);

    [DllImport("kernel32.dll", EntryPoint = "GetFileInformationByHandleEx", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool QueryBasic(
        SafeFileHandle handle, int infoClass, out FileBasicInfo info, uint size);

    [DllImport("kernel32.dll", EntryPoint = "GetFileInformationByHandleEx", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool QueryEntries(
        SafeFileHandle handle, int infoClass, IntPtr buffer, uint size);

    private static void Deny() => throw new IOException(Refusal);

    private static SafeFileHandle OpenDirectory(string directory)
    {
        const uint listDirectory = 0x0001, readAttributes = 0x0080;
        const uint shareAll = 0x0007, openExisting = 3;
        const uint backupSemantics = 0x02000000, openReparsePoint = 0x00200000;

        SafeFileHandle handle = CreateFile(directory, listDirectory | readAttributes, shareAll,
            IntPtr.Zero, openExisting, backupSemantics | openReparsePoint, IntPtr.Zero);
        if (handle is null || handle.IsInvalid) { handle?.Dispose(); Deny(); }
        FileAttributeTagInfo tag;
        if (!QueryTag(handle!, FileAttributeTagInfoClass, out tag,
                (uint)Marshal.SizeOf<FileAttributeTagInfo>()) ||
            (tag.FileAttributes & 0x10U) == 0U ||
            (tag.FileAttributes & 0x400U) != 0U)
        {
            handle!.Dispose();
            Deny();
        }
        return handle!;
    }

    private static SafeFileHandle OpenMarker(string marker)
    {
        // Open the marker itself as a file, never follow its final reparse
        // component. Keep a read-only native handle alive during enumeration.
        const uint readData = 0x0001, readAttributes = 0x0080;
        const uint shareAll = 0x0007, openExisting = 3;
        const uint openReparsePoint = 0x00200000;
        SafeFileHandle handle = CreateFile(marker, readData | readAttributes,
            shareAll, IntPtr.Zero, openExisting, openReparsePoint, IntPtr.Zero);
        if (handle is null || handle.IsInvalid) { handle?.Dispose(); Deny(); }
        if (!QueryTag(handle!, FileAttributeTagInfoClass,
                out FileAttributeTagInfo tag,
                (uint)Marshal.SizeOf<FileAttributeTagInfo>()) ||
            (tag.FileAttributes & 0x400U) != 0U ||
            (tag.FileAttributes & 0x10U) != 0U)
        {
            handle!.Dispose();
            Deny();
        }
        return handle!;
    }

    private static void VerifyMarkerBytes(SafeFileHandle marker, string nonce)
    {
        // 33 bytes make an appended byte an explicit failure, not a silent
        // truncation to a matching 32-byte nonce.
        Span<byte> bytes = stackalloc byte[33];
        int received = RandomAccess.Read(marker, bytes, 0);
        if (received != 32 ||
            !Encoding.ASCII.GetBytes(nonce).AsSpan().SequenceEqual(bytes[..32]))
            Deny();
    }

    private static void VerifyHeldMarker(
        string path, string nonce, SafeFileHandle heldMarker,
        FileIdInfo initialId, FileBasicInfo initialBasic)
    {
        FileIdInfo currentId = Identity(heldMarker);
        FileBasicInfo currentBasic = Basic(heldMarker);
        if (!Same(initialId, currentId) ||
            initialBasic.ChangeTime != currentBasic.ChangeTime ||
            initialBasic.LastWriteTime != currentBasic.LastWriteTime) Deny();
        VerifyMarkerBytes(heldMarker, nonce);

        // Compare pathname identity *while* the original file handle is held:
        // an identically written replacement must not inherit the old grant.
        using SafeFileHandle reopened = OpenMarker(path);
        if (!Same(initialId, Identity(reopened))) Deny();
        VerifyMarkerBytes(reopened, nonce);
    }

    private static FileIdInfo Identity(SafeFileHandle handle)
    {
        if (!QueryId(handle, FileIdInfoClass, out FileIdInfo info,
                (uint)Marshal.SizeOf<FileIdInfo>()) ||
            info.FileId is null || info.FileId.Length != 16) Deny();
        return info;
    }

    private static FileBasicInfo Basic(SafeFileHandle handle)
    {
        if (!QueryBasic(handle, FileBasicInfoClass, out FileBasicInfo info,
                (uint)Marshal.SizeOf<FileBasicInfo>())) Deny();
        return info;
    }

    private static bool Same(FileIdInfo a, FileIdInfo b) =>
        a.VolumeSerialNumber == b.VolumeSerialNumber &&
        a.FileId is not null && b.FileId is not null &&
        a.FileId.AsSpan().SequenceEqual(b.FileId);

    // Pin every component of the TEMP ancestor path, including the volume
    // root. CreateFileW with OPEN_REPARSE_POINT on only the leaf does not
    // protect against a junction in a parent component.
    // A held handle plus a second pathname open detects observable swaps;
    // these checkpoints still do not prove atomic containment or prevent ABA.
    private sealed class AncestorPins : IDisposable
    {
        private readonly List<(string Path, SafeFileHandle Handle, FileIdInfo Id)> pins = new();

        public static AncestorPins Pin(string directory)
        {
            AncestorPins result = new();
            try
            {
                string cursor = Path.TrimEndingDirectorySeparator(Path.GetFullPath(directory));
                Stack<string> chain = new();
                while (true)
                {
                    chain.Push(cursor);
                    string? parent = Path.GetDirectoryName(cursor);
                    if (String.IsNullOrEmpty(parent) ||
                        String.Equals(parent, cursor, StringComparison.OrdinalIgnoreCase)) break;
                    cursor = Path.TrimEndingDirectorySeparator(parent);
                }

                while (chain.Count > 0)
                {
                    string path = chain.Pop();
                    SafeFileHandle handle = OpenDirectory(path);
                    try { result.pins.Add((path, handle, Identity(handle))); }
                    catch { handle.Dispose(); throw; }
                }
                result.Verify();
                return result;
            }
            catch
            {
                result.Dispose();
                throw;
            }
        }

        public void Verify()
        {
            foreach (var pin in pins)
            {
                if (!Same(pin.Id, Identity(pin.Handle))) Deny();
                using SafeFileHandle reopened = OpenDirectory(pin.Path);
                if (!Same(pin.Id, Identity(reopened))) Deny();
            }
        }

        public void Dispose()
        {
            foreach (var pin in pins) pin.Handle.Dispose();
            pins.Clear();
        }
    }

    private static string ValidateFixture(string root, string nonce)
    {
        if (!Regex.IsMatch(nonce, "^[a-f0-9]{32}$", RegexOptions.CultureInvariant)) Deny();
        if (!Path.IsPathFullyQualified(root)) Deny();

        string tmp = Path.TrimEndingDirectorySeparator(Path.GetFullPath(Path.GetTempPath()));
        string directory = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root));
        if (!String.Equals(Path.GetDirectoryName(directory), tmp,
                StringComparison.OrdinalIgnoreCase) ||
            !Regex.IsMatch(Path.GetFileName(directory),
                "^omsi-manager-recovery-fixture-[A-Za-z0-9_-]+$",
                RegexOptions.CultureInvariant)) Deny();

        DirectoryInfo dirInfo = new(directory);
        if (!dirInfo.Exists ||
            (dirInfo.Attributes & FileAttributes.ReparsePoint) != 0) Deny();

        string marker = Path.Combine(directory, ".omsi-test-fixture-marker");
        FileInfo markInfo = new(marker);
        if (!markInfo.Exists || markInfo.Length != 32 ||
            (markInfo.Attributes & FileAttributes.ReparsePoint) != 0 ||
            !String.Equals(File.ReadAllText(marker), nonce, StringComparison.Ordinal)) Deny();

        string target = Path.Combine(directory, "native-enum");
        DirectoryInfo targetInfo = new(target);
        if (!targetInfo.Exists ||
            (targetInfo.Attributes & FileAttributes.ReparsePoint) != 0) Deny();
        return target;
    }

    private static int[] Inspect(string directory, Action? pauseForMutation = null)
    {
        int attrs = (int)Marshal.OffsetOf<FileIdBothDirectoryLayout>("FileAttributes");
        int nameSize = (int)Marshal.OffsetOf<FileIdBothDirectoryLayout>("FileNameLength");
        int nameOffset = (int)Marshal.OffsetOf<FileIdBothDirectoryLayout>("FileName");
        if (attrs != 56 || nameSize != 60 || nameOffset != 104) Deny();

        using SafeFileHandle held = OpenDirectory(directory);
        FileIdInfo initial = Identity(held);
        FileBasicInfo initialBasic = Basic(held);
        // A Windows-only test barrier permits a second process to mutate the
        // marker or pathname while these native directory handles stay open.
        // It is never enabled by Electron or the shipped package.
        pauseForMutation?.Invoke();
        int entries = 0, folders = 0, files = 0, links = 0, packages = 0;
        bool exhausted = false;
        IntPtr buffer = Marshal.AllocHGlobal(BufferSize);
        try
        {
            for (int page = 0; page < PageLimit; page++)
            {
                // Do not interpret stale data from a previous native read.
                for (int i = 0; i < BufferSize; i++) Marshal.WriteByte(buffer, i, 0);
                if (!QueryEntries(held, page == 0
                            ? FileIdBothDirectoryRestartInfoClass
                            : FileIdBothDirectoryInfoClass, buffer, BufferSize))
                {
                    if (Marshal.GetLastWin32Error() == NoMoreFiles) { exhausted = true; break; }
                    Deny();
                }

                int offset = 0;
                bool lastFound = false;
                for (int item = 0; item < EntryLimit + 2; item++)
                {
                    if (offset < 0 || offset > BufferSize - nameOffset) Deny();
                    int jump = Marshal.ReadInt32(buffer, offset);
                    int length = Marshal.ReadInt32(buffer, offset + nameSize);
                    int attributes = Marshal.ReadInt32(buffer, offset + attrs);
                    int space = jump == 0 ? BufferSize - offset : jump;
                    if ((length & 1) != 0 || length < 2 || length > 1024 ||
                        nameOffset + length > space ||
                        (jump != 0 && (jump < nameOffset + 2 || (jump & 7) != 0))) Deny();

                    string? name = Marshal.PtrToStringUni(IntPtr.Add(buffer, offset + nameOffset), length / 2);
                    if (String.IsNullOrEmpty(name) || name.Contains('\0')) Deny();

                    if (name != "." && name != "..")
                    {
                        // Conservative fence: 128 is refused, not accepted, because
                        // a filesystem may report only a truncated 128-record view.
                        if (++entries >= EntryLimit) Deny();
                        if ((attributes & 0x400) != 0) links++;
                        else if ((attributes & 0x10) != 0) folders++;
                        else
                        {
                            files++;
                            if (name.EndsWith(".scs", StringComparison.OrdinalIgnoreCase) ||
                                name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                                packages++;
                        }
                    }
                    if (jump == 0) { lastFound = true; break; }
                    offset = checked(offset + jump);
                }
                if (!lastFound) Deny();
            }
        }
        finally { Marshal.FreeHGlobal(buffer); }
        if (!exhausted) Deny();

        FileIdInfo final = Identity(held);
        FileBasicInfo finalBasic = Basic(held);
        if (!Same(initial, final) ||
            initialBasic.ChangeTime != finalBasic.ChangeTime ||
            initialBasic.LastWriteTime != finalBasic.LastWriteTime) Deny();

        using SafeFileHandle reopened = OpenDirectory(directory);
        if (!Same(initial, Identity(reopened))) Deny();
        return [entries, folders, files, links, packages];
    }

    private static void PauseForTestMutation()
    {
        Console.Out.WriteLine("READY");
        Console.Out.Flush();
        // A bounded protocol, not a general command interpreter. The mutator
        // runs in the synthetic fixture, never in a live game directory.
        string? next = Console.In.ReadLineAsync()
            .WaitAsync(TimeSpan.FromSeconds(20))
            .GetAwaiter().GetResult();
        if (!String.Equals(next, "CONTINUE", StringComparison.Ordinal)) Deny();
    }

    private static void VerifyHeldFixtureRoot(
        string root, string nonce, SafeFileHandle heldRoot,
        FileIdInfo initialId, FileBasicInfo initialBasic)
    {
        FileIdInfo currentId = Identity(heldRoot);
        FileBasicInfo currentBasic = Basic(heldRoot);
        if (!Same(initialId, currentId) ||
            initialBasic.ChangeTime != currentBasic.ChangeTime ||
            initialBasic.LastWriteTime != currentBasic.LastWriteTime) Deny();
        // Compare to a separately opened pathname while the first handle is
        // still alive. This catches many rename/swap races, not all ABA.
        using SafeFileHandle reopened = OpenDirectory(root);
        if (!Same(initialId, Identity(reopened))) Deny();
        // Check the nonce again after the enumeration, rather than trusting
        // an early marker read which may have been invalidated in the interim.
        string verified = ValidateFixture(root, nonce);
        if (!String.Equals(verified, Path.Combine(root, "native-enum"),
                StringComparison.OrdinalIgnoreCase)) Deny();
    }

    public static int Main(string[] args)
    {
        try
        {
            bool raceBarrier = args.Length == 5 &&
                String.Equals(args[4], "--race-barrier", StringComparison.Ordinal);
            if (!OperatingSystem.IsWindows() ||
                !(args.Length == 4 || raceBarrier) ||
                args[0] != "--root" || args[2] != "--nonce") Deny();
            // Refuse a reparse component before any marker/content read. The
            // TEMP chain remains pinned throughout the native observation.
            using AncestorPins ancestors = AncestorPins.Pin(Path.GetTempPath());
            string target = ValidateFixture(args[1], args[3]);
            string root = Path.GetDirectoryName(target) ?? throw new IOException(Refusal);
            // Anchor the synthetic root itself in an OS handle for the entire
            // observation, not only the native-enum child directory.
            using SafeFileHandle heldRoot = OpenDirectory(root);
            FileIdInfo rootId = Identity(heldRoot);
            FileBasicInfo rootBasic = Basic(heldRoot);
            string markerPath = Path.Combine(root, ".omsi-test-fixture-marker");
            using SafeFileHandle heldMarker = OpenMarker(markerPath);
            FileIdInfo markerId = Identity(heldMarker);
            FileBasicInfo markerBasic = Basic(heldMarker);
            VerifyMarkerBytes(heldMarker, args[3]);
            if (!String.Equals(ValidateFixture(root, args[3]), target,
                    StringComparison.OrdinalIgnoreCase)) Deny();
            int[] v = Inspect(target, raceBarrier ? (Action)PauseForTestMutation : null);
            VerifyHeldFixtureRoot(root, args[3], heldRoot, rootId, rootBasic);
            VerifyHeldMarker(markerPath, args[3], heldMarker, markerId, markerBasic);
            ancestors.Verify();
            Console.Out.WriteLine(JsonSerializer.Serialize(new Dictionary<string, object>
            {
                ["source"] = "temporary-native-windows-directory-fixture",
                ["outcome"] = "observed-bounded-untrusted",
                ["nativeDirectoryHandleUsed"] = true,
                ["nativeDirectoryEnumerationByHandle"] = true,
                ["nativeFileIdChecked"] = true,
                ["targetIsSynthetic"] = true,
                ["entries"] = v[0],
                ["directories"] = v[1],
                ["files"] = v[2],
                ["linksSkipped"] = v[3],
                ["packageCandidates"] = v[4],
                ["completedWithinBudget"] = true,
                ["nativeIdentityAuthorizedForGameFolders"] = false,
                ["guaranteesNoABA"] = false,
                ["atomicPathContainmentProven"] = false,
                ["supportsRealGameInspection"] = false,
                ["canRecover"] = false,
                ["canInstall"] = false,
                ["canDelete"] = false,
                ["operationsEnabled"] = false,
                ["bytesReadFromMods"] = 0
            }));
            return 0;
        }
        catch
        {
            // Never reveal a real directory, marker, FileID, file name or stack trace.
            Console.Error.WriteLine(Refusal);
            return 3;
        }
    }
}
