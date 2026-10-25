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

    [StructLayout(LayoutKind.Sequential)]
    private struct UnicodeString
    {
        public ushort Length, MaximumLength;
        public IntPtr Buffer;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ObjectAttributes
    {
        public uint Length;
        public IntPtr RootDirectory, ObjectName;
        public uint Attributes;
        public IntPtr SecurityDescriptor, SecurityQualityOfService;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IoStatusBlock
    {
        public IntPtr Status;
        public IntPtr Information;
    }

    [DllImport("ntdll.dll", ExactSpelling = true)]
    private static extern int NtOpenFile(
        out SafeFileHandle handle, uint desiredAccess,
        ref ObjectAttributes objectAttributes, out IoStatusBlock ioStatus,
        uint shareAccess, uint openOptions);

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

    // Open exactly ONE name relative to an already verified directory handle.
    // OPEN_REPARSE_POINT prevents following a junction/symlink at this leaf.
    // NtOpenFile RootDirectory avoids re-resolving intermediary path strings.
    private static SafeFileHandle OpenRelative(
        SafeFileHandle parent, string name, bool directory)
    {
        const uint readAttributes = 0x0080, synchronize = 0x00100000;
        const uint shareAll = 0x0007, directoryFile = 0x00000001;
        const uint nonDirectoryFile = 0x00000040, synchronous = 0x00000020;
        const uint openReparsePoint = 0x00200000, caseInsensitive = 0x00000040;
        if (String.IsNullOrEmpty(name) || name is "." or ".." ||
            name.Length > 255 || name.EndsWith('.') || name.EndsWith(' ') ||
            name.IndexOfAny(['\\', '/', ':', '\0']) >= 0) Deny();

        IntPtr buffer = IntPtr.Zero, unicodePointer = IntPtr.Zero;
        try
        {
            buffer = Marshal.StringToHGlobalUni(name);
            UnicodeString unicode = new()
            {
                Length = checked((ushort)(name.Length * 2)),
                MaximumLength = checked((ushort)((name.Length + 1) * 2)),
                Buffer = buffer
            };
            unicodePointer = Marshal.AllocHGlobal(Marshal.SizeOf<UnicodeString>());
            Marshal.StructureToPtr(unicode, unicodePointer, false);
            ObjectAttributes attributes = new()
            {
                Length = (uint)Marshal.SizeOf<ObjectAttributes>(),
                RootDirectory = parent.DangerousGetHandle(),
                ObjectName = unicodePointer,
                Attributes = caseInsensitive
            };
            // FILE_LIST_DIRECTORY for folders / FILE_READ_DATA for markers.
            // Both access masks share the native value 0x0001.
            uint access = readAttributes | synchronize | 0x0001U;
            uint options = synchronous | openReparsePoint |
                (directory ? directoryFile : nonDirectoryFile);
            int status = NtOpenFile(out SafeFileHandle handle, access,
                ref attributes, out _, shareAll, options);
            if (status < 0 || handle is null || handle.IsInvalid)
            {
                handle?.Dispose();
                Deny();
            }
            FileAttributeTagInfo tag;
            if (!QueryTag(handle!, FileAttributeTagInfoClass, out tag,
                    (uint)Marshal.SizeOf<FileAttributeTagInfo>()) ||
                (tag.FileAttributes & 0x400U) != 0U ||
                ((tag.FileAttributes & 0x10U) != 0U) != directory)
            {
                handle!.Dispose();
                Deny();
            }
            return handle!;
        }
        finally
        {
            if (unicodePointer != IntPtr.Zero) Marshal.FreeHGlobal(unicodePointer);
            if (buffer != IntPtr.Zero) Marshal.FreeHGlobal(buffer);
        }
    }

    private static SafeFileHandle OpenChildDirectory(SafeFileHandle parent, string name) =>
        OpenRelative(parent, name, true);

    private static SafeFileHandle OpenChildMarker(SafeFileHandle parent, string name) =>
        OpenRelative(parent, name, false);

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
        FileIdInfo initialId, FileBasicInfo initialBasic,
        SafeFileHandle parent)
    {
        FileIdInfo currentId = Identity(heldMarker);
        FileBasicInfo currentBasic = Basic(heldMarker);
        if (!Same(initialId, currentId) ||
            initialBasic.ChangeTime != currentBasic.ChangeTime ||
            initialBasic.LastWriteTime != currentBasic.LastWriteTime) Deny();
        VerifyMarkerBytes(heldMarker, nonce);

        // Compare pathname identity *while* the original file handle is held:
        // an identically written replacement must not inherit the old grant.
        using SafeFileHandle reopened = OpenChildMarker(parent, Path.GetFileName(path));
        if (!Same(initialId, Identity(reopened))) Deny();
        VerifyMarkerBytes(reopened, nonce);
        using SafeFileHandle pathReopened = OpenMarker(path);
        if (!Same(initialId, Identity(pathReopened))) Deny();
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

    // RootDirectory is used for every child, keeping the chain anchored to
    // verified parent handles even if pathnames are concurrently redirected.
    // Reopening absolute paths provides a separate fail-closed consistency
    // checkpoint. This still does not prove ABA resistance or atomic traversal.
    private sealed class AncestorPins : IDisposable
    {
        private readonly List<(string Path, string Name,
            SafeFileHandle Handle, FileIdInfo Id)> pins = new();

        public SafeFileHandle TemporaryHandle => pins[^1].Handle;

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
                    string name = result.pins.Count == 0 ? "" : Path.GetFileName(path);
                    SafeFileHandle handle = result.pins.Count == 0
                        ? OpenDirectory(path)
                        : OpenChildDirectory(result.pins[^1].Handle, name);
                    try { result.pins.Add((path, name, handle, Identity(handle))); }
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
            for (int i = 0; i < pins.Count; i++)
            {
                var pin = pins[i];
                if (!Same(pin.Id, Identity(pin.Handle))) Deny();
                if (i > 0)
                {
                    using SafeFileHandle relative =
                        OpenChildDirectory(pins[i - 1].Handle, pin.Name);
                    if (!Same(pin.Id, Identity(relative))) Deny();
                }
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

    private static string ValidateFixturePath(string root, string nonce)
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
        return directory;
    }

    private static int[] Inspect(
        SafeFileHandle parent, string directory, Action? pauseForMutation = null)
    {
        int attrs = (int)Marshal.OffsetOf<FileIdBothDirectoryLayout>("FileAttributes");
        int nameSize = (int)Marshal.OffsetOf<FileIdBothDirectoryLayout>("FileNameLength");
        int nameOffset = (int)Marshal.OffsetOf<FileIdBothDirectoryLayout>("FileName");
        if (attrs != 56 || nameSize != 60 || nameOffset != 104) Deny();

        using SafeFileHandle held = OpenChildDirectory(parent, Path.GetFileName(directory));
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

        using SafeFileHandle reopened = OpenChildDirectory(parent, Path.GetFileName(directory));
        if (!Same(initial, Identity(reopened))) Deny();
        using SafeFileHandle reopenedPath = OpenDirectory(directory);
        if (!Same(initial, Identity(reopenedPath))) Deny();
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
        string root, SafeFileHandle heldRoot,
        FileIdInfo initialId, FileBasicInfo initialBasic,
        SafeFileHandle parent)
    {
        FileIdInfo currentId = Identity(heldRoot);
        FileBasicInfo currentBasic = Basic(heldRoot);
        if (!Same(initialId, currentId) ||
            initialBasic.ChangeTime != currentBasic.ChangeTime ||
            initialBasic.LastWriteTime != currentBasic.LastWriteTime) Deny();
        // Compare to a separately opened pathname while the first handle is
        // still alive. This catches many rename/swap races, not all ABA.
        using SafeFileHandle reopened = OpenChildDirectory(parent, Path.GetFileName(root));
        if (!Same(initialId, Identity(reopened))) Deny();
        using SafeFileHandle reopenedPath = OpenDirectory(root);
        if (!Same(initialId, Identity(reopenedPath))) Deny();
        // The marker and target have their own independently held handles.
        // Never reopen their contents by pathname here; an untrusted path
        // could be redirected by another process during the observation.
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
            string root = ValidateFixturePath(args[1], args[3]);
            string target = Path.Combine(root, "native-enum");
            // Anchor the synthetic root itself in an OS handle for the entire
            // observation, not only the native-enum child directory.
            using SafeFileHandle heldRoot =
                OpenChildDirectory(ancestors.TemporaryHandle, Path.GetFileName(root));
            FileIdInfo rootId = Identity(heldRoot);
            FileBasicInfo rootBasic = Basic(heldRoot);
            string markerPath = Path.Combine(root, ".omsi-test-fixture-marker");
            using SafeFileHandle heldMarker =
                OpenChildMarker(heldRoot, ".omsi-test-fixture-marker");
            FileIdInfo markerId = Identity(heldMarker);
            FileBasicInfo markerBasic = Basic(heldMarker);
            VerifyMarkerBytes(heldMarker, args[3]);
            // Read no bytes from untrusted pathnames. Absolute-name reopen
            // below checks *identity only*; native relative handles own all
            // content reads and the bounded directory enumeration.
            using (SafeFileHandle rootPath = OpenDirectory(root))
                if (!Same(rootId, Identity(rootPath))) Deny();
            using (SafeFileHandle markerPathHandle = OpenMarker(markerPath))
                if (!Same(markerId, Identity(markerPathHandle))) Deny();
            int[] v = Inspect(heldRoot, target, raceBarrier ? (Action)PauseForTestMutation : null);
            VerifyHeldFixtureRoot(root, heldRoot, rootId, rootBasic,
                ancestors.TemporaryHandle);
            VerifyHeldMarker(markerPath, args[3], heldMarker, markerId, markerBasic,
                heldRoot);
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
