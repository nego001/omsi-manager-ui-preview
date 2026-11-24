// Test-only fixed self-created NTFS fixture; never used by packaged Electron.
using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.Win32.SafeHandles;

internal static partial class Program
{
    private const int M112Max = 65536, M112Chunk = 4096;
    private const string M112Parent = "selected", M112Name = "fixture.bus";
    private static readonly byte[] M112Original = Enumerable.Repeat((byte)65, 8193).ToArray();
    private static readonly byte[] M112Sentinel = [83, 69, 78, 84, 73, 78, 69, 76];

    [StructLayout(LayoutKind.Sequential)]
    private struct M112StandardInfo
    {
        public long AllocationSize, EndOfFile;
        public uint NumberOfLinks;
        public byte DeletePending, Directory;
    }

    [DllImport("kernel32.dll", EntryPoint = "GetFileInformationByHandleEx", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool M112QueryStandard(SafeFileHandle handle, int infoClass,
        out M112StandardInfo info, uint size);

    [DllImport("kernel32.dll", EntryPoint = "CreateHardLinkW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool M112HardLink(string newName, string existingName, IntPtr reserved);

    [DllImport("kernel32.dll", EntryPoint = "GetFileType", SetLastError = true)]
    private static extern uint M112FileType(SafeFileHandle handle);

    private static M112StandardInfo M112Standard(SafeFileHandle handle)
    {
        if (M112FileType(handle) != 1) Deny();
        if (!M112QueryStandard(handle, 1, out var info,
                (uint)Marshal.SizeOf<M112StandardInfo>()) ||
            info.Directory != 0 || info.DeletePending != 0 || info.NumberOfLinks != 1 ||
            info.EndOfFile < 1 || info.EndOfFile > M112Max) Deny();
        return info;
    }

    private sealed class M112Metrics
    {
        public int Opened, Reads, Bytes;
    }

    private static byte[]? M112Read(AncestorPins pins, SafeFileHandle root,
        Action<string> checkpoint, Func<bool> cancelled, M112Metrics metrics)
    {
        void Active() { if (cancelled()) Deny(); }
        try
        {
            Active();
            using SafeFileHandle parent = OpenChildDirectory(root, M112Parent);
            var parentId = Identity(parent);
            using SafeFileHandle initial = OpenChildFileIdentity(parent, M112Name);
            var initialId = Identity(initial);
            var initialBasic = Basic(initial);
            var size = M112Standard(initial).EndOfFile;
            void VerifyParent()
            {
                Active();
                pins.Verify();
                using SafeFileHandle current = OpenChildDirectory(root, M112Parent);
                if (!Same(parentId, Identity(parent)) || !Same(parentId, Identity(current))) Deny();
            }
            void VerifyFile(SafeFileHandle held)
            {
                VerifyParent();
                using SafeFileHandle current = OpenChildFileIdentity(parent, M112Name);
                if (!Same(initialId, Identity(held)) || !Same(initialId, Identity(current)) ||
                    !SameStableMetadata(initialBasic, Basic(held)) ||
                    !SameStableMetadata(initialBasic, Basic(current)) ||
                    M112Standard(held).EndOfFile != size ||
                    M112Standard(current).EndOfFile != size) Deny();
                Active();
            }
            checkpoint("before-open");
            VerifyFile(initial);
            // Relative native open with FILE_READ_DATA; existing helper rejects
            // reparse points before any content read and shares delete for tests.
            using SafeFileHandle file = OpenRelative(parent, M112Name, false);
            metrics.Opened++;
            checkpoint("after-open");
            VerifyFile(file);
            byte[][] snapshots = [new byte[(int)size], new byte[(int)size]];
            foreach (byte[] snapshot in snapshots)
            {
                int offset = 0;
                while (offset < snapshot.Length)
                {
                    VerifyFile(file);
                    int length = Math.Min(M112Chunk, snapshot.Length-offset);
                    int received = RandomAccess.Read(file, snapshot.AsSpan(offset, length), offset);
                    metrics.Reads++;
                    metrics.Bytes += received;
                    if (received < 1 || received > length) Deny();
                    offset += received;
                    if (metrics.Reads == 1) checkpoint("after-first-read");
                    VerifyFile(file);
                }
            }
            VerifyFile(file);
            if (!snapshots[0].AsSpan().SequenceEqual(snapshots[1])) Deny();
            return snapshots[0];
        }
        catch (IOException) { return null; }
    }

    private static object M112Case(string scenario)
    {
        // Fresh self-created directory; no caller pathname or external target.
        string root = Directory.CreateTempSubdirectory("omsi-m112-").FullName;
        string parent = Path.Combine(root, M112Parent);
        string source = Path.Combine(parent, M112Name);
        string outside = Path.Combine(root, "outside");
        string sentinel = Path.Combine(outside, M112Name);
        try
        {
            Directory.CreateDirectory(parent);
            Directory.CreateDirectory(outside);
            File.WriteAllBytes(sentinel, M112Sentinel);
            File.WriteAllBytes(source, M112Original);
            if (scenario == "maximum") File.WriteAllBytes(source, new byte[M112Max]);
            if (scenario == "oversized") File.WriteAllBytes(source, new byte[M112Max+1]);
            if (scenario == "empty") File.WriteAllBytes(source, []);
            if (scenario == "directory-instead")
            {
                File.Delete(source);
                Directory.CreateDirectory(source);
            }
            if (scenario == "hardlink" &&
                !M112HardLink(Path.Combine(parent,"alias.bus"),source,IntPtr.Zero)) Deny();
            if (scenario == "reparse")
            {
                File.Delete(source);
                // Symlink creation may require a privilege unavailable on a runner.
                // This result is NOT a pass of the reparse refusal scenario.
                try { File.CreateSymbolicLink(source, sentinel); }
                catch (IOException) { return new { scenario, outcome = "fixture-unavailable", opened = 0, readCalls = 0, bytesRead = 0 }; }
                catch (UnauthorizedAccessException) { return new { scenario, outcome = "fixture-unavailable", opened = 0, readCalls = 0, bytesRead = 0 }; }
            }

            bool cancelled = scenario == "cancel-before", changed = false;
            void Checkpoint(string stage)
            {
                if (changed) return;
                // Failure to arrange the intended mutation must fail the lab,
                // never be swallowed as a successful read refusal.
                try
                {
                    if (scenario == "parent-replaced" && stage == "before-open")
                    {
                        Directory.Move(parent, Path.Combine(root,"retired"));
                        Directory.CreateDirectory(parent);
                        File.WriteAllBytes(source, M112Sentinel);
                    }
                    else if (scenario == "file-replaced" && stage == "after-open")
                    {
                        File.Move(source,Path.Combine(parent,"retired.bus"));
                        File.WriteAllBytes(source,M112Sentinel);
                    }
                    else if (scenario == "changed-during-read" && stage == "after-first-read")
                        File.WriteAllBytes(source,new byte[M112Original.Length+1]);
                    else if (scenario == "cancel-during-read" && stage == "after-first-read")
                        cancelled = true;
                    else return;
                    changed = true;
                }
                catch (Exception e) { throw new InvalidOperationException("M112_FIXTURE_SETUP_FAILED", e); }
            }

            var metrics = new M112Metrics();
            byte[]? bytes;
            using (AncestorPins pins = AncestorPins.Pin(root))
            {
                var rootHandle = pins.TemporaryHandle;
                if (!BoundedNativeChangeProbe.HasNtfsVolume(rootHandle)) Deny();
                bytes = M112Read(pins,rootHandle,Checkpoint,()=>cancelled,metrics);
            }
            bool normal = scenario is "normal" or "maximum";
            if (normal)
            {
                byte[] expected = scenario == "maximum" ? new byte[M112Max] : M112Original;
                if (bytes is null || !bytes.AsSpan().SequenceEqual(expected) ||
                    !File.ReadAllBytes(source).AsSpan().SequenceEqual(expected) ||
                    metrics.Opened != 1 || metrics.Bytes != 2*expected.Length) Deny();
            }
            else
            {
                if (bytes is not null) Deny();
                if (scenario is "changed-during-read" or "cancel-during-read")
                {
                    if (!changed || metrics.Opened != 1 || metrics.Reads != 1 || metrics.Bytes > M112Chunk) Deny();
                }
                else
                {
                    if (metrics.Reads != 0 || metrics.Bytes != 0) Deny();
                    if (scenario == "file-replaced")
                    {
                        if (!changed || metrics.Opened != 1 || !File.ReadAllBytes(source).AsSpan().SequenceEqual(M112Sentinel)) Deny();
                    }
                    else if (metrics.Opened != 0 || (scenario == "parent-replaced" && !changed)) Deny();
                }
            }
            if (!File.ReadAllBytes(sentinel).AsSpan().SequenceEqual(M112Sentinel)) Deny();
            return new { scenario, outcome = normal ? "matching-two-snapshots" : "refused",
                opened = metrics.Opened, readCalls = metrics.Reads, bytesRead = metrics.Bytes };
        }
        finally { Directory.Delete(root,true); }
    }

    private static int RunConfigReadFixtureM112()
    {
        string[] scenarios = ["normal","maximum","empty","oversized","directory-instead","hardlink",
            "reparse","parent-replaced","file-replaced","changed-during-read","cancel-before","cancel-during-read"];
        object[] cases = scenarios.Select(M112Case).ToArray();
        Console.WriteLine(JsonSerializer.Serialize(new {
            schema = "omsi-m112-windows-handle-fixture-v1", cases,
            relativeNativeOpenUsed = true, nativeFileIdChecked = true,
            nativeIdentityVerifiedForRealMods = false, atomicContainmentProven = false,
            abaRuledOut = false, osDeadlineProven = false, realModRead = false, operationsEnabled = false
        }));
        return 0;
    }
}
