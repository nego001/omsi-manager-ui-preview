// Isolated Windows native directory lab. Never installed with Electron.
// Accepts only a marker-bound direct child of the process TEMP folder.
// Observations are not authorizations and no game file contents are opened.
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
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

    private static int[] Inspect(string directory)
    {
        int attrs = (int)Marshal.OffsetOf<FileIdBothDirectoryLayout>("FileAttributes");
        int nameSize = (int)Marshal.OffsetOf<FileIdBothDirectoryLayout>("FileNameLength");
        int nameOffset = (int)Marshal.OffsetOf<FileIdBothDirectoryLayout>("FileName");
        if (attrs != 56 || nameSize != 60 || nameOffset != 104) Deny();

        using SafeFileHandle held = OpenDirectory(directory);
        FileIdInfo initial = Identity(held);
        FileBasicInfo initialBasic = Basic(held);
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

    public static int Main(string[] args)
    {
        try
        {
            if (!OperatingSystem.IsWindows() || args.Length != 4 ||
                args[0] != "--root" || args[2] != "--nonce") Deny();
            string target = ValidateFixture(args[1], args[3]);
            int[] v = Inspect(target);
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
