// Isolated Windows native directory lab. Never installed with Electron.
// Accepts only a marker-bound direct child of the process TEMP folder.
// Observations are not authorizations and no game file contents are opened.
using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
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

    // A one-shot native directory-change event (not a lossless event journal).
    // Only the all-or-nothing signal is observed; no private names are read.
    private sealed class SafeChangeNotificationHandle : SafeHandleZeroOrMinusOneIsInvalid
    {
        private SafeChangeNotificationHandle() : base(true) { }
        protected override bool ReleaseHandle() => FindCloseChangeNotification(handle);
    }

    [DllImport("kernel32.dll", EntryPoint = "FindFirstChangeNotificationW",
        CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeChangeNotificationHandle FindFirstChangeNotification(
        string path, [MarshalAs(UnmanagedType.Bool)] bool subtree, uint notifyFilter);

    [DllImport("kernel32.dll", EntryPoint = "FindCloseChangeNotification", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool FindCloseChangeNotification(IntPtr handle);

    [DllImport("kernel32.dll", EntryPoint = "WaitForSingleObject", SetLastError = true)]
    private static extern uint WaitForSingleObject(
        SafeChangeNotificationHandle handle, uint milliseconds);

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

    [DoesNotReturn]
    private static void Deny() => throw new IOException(Refusal);

    // Test-only attestation: exit code 4 is reachable exclusively after the
    // real Windows kernel reports ERROR_OPERATION_ABORTED (995) for the
    // exact pending directory request. No private data is emitted.
    private sealed class SyntheticCancellationVerified : Exception { }

    // Synthetic diagnostic exits: 5/6 are a single undersized notification;
    // 7/8 are a second read after a completed first read and queued storm.
    // Within each pair: 1022 = loss error, zero bytes = missing details.
    // Neither represents a usable directory view or authorizes operations.
    private sealed class SyntheticNotificationLossWitness(int code) : Exception
    {
        public int Code { get; } = code;
    }

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
        SafeFileHandle parent, string name, bool directory,
        bool attributesOnly = false)
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
            uint access = readAttributes | synchronize |
                (attributesOnly ? 0U : 0x0001U);
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

    // Identity-only: metadata access, never FILE_READ_DATA, never reads bytes.
    // The child is opened relative to the already pinned synthetic directory.
    private static SafeFileHandle OpenChildFileIdentity(
        SafeFileHandle parent, string name) =>
        OpenRelative(parent, name, false, attributesOnly: true);

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

    // A conservative event fence for the *synthetic* root and native-enum.
    // Win32 notification signals are sticky until explicitly rearmed (we
    // NEVER rearm). If anything might have changed, the entire observation
    // is denied. This does not prove event delivery on every filesystem or
    // protect against changes before registration / after final checkpoint.
    private sealed class DirectoryChangeFence : IDisposable
    {
        private const uint FileName = 0x00000001, DirectoryName = 0x00000002;
        private const uint WaitTimeout = 0x00000102;
        private readonly SafeChangeNotificationHandle notification;

        public DirectoryChangeFence(string path, SafeFileHandle heldDirectory)
        {
            // Observe structural changes only. File write/creation/attribute
            // timestamps may flush after the fixture is made but before it
            // is inspected; those delayed notifications are not proof of
            // an active mutation within our observation interval.
            // Marker contents have independent pinned-handle checkpoints.
            notification = FindFirstChangeNotification(path, false,
                FileName | DirectoryName);
            if (notification is null || notification.IsInvalid)
            {
                notification?.Dispose();
                Deny();
            }
            // Check that registration did not visibly switch the watched
            // pathname to another directory. This is a checkpoint, NOT an
            // atomic link between the notification and heldDirectory.
            using SafeFileHandle reopened = OpenDirectory(path);
            if (!Same(Identity(heldDirectory), Identity(reopened))) Deny();
        }

        public void VerifyNotSignaled()
        {
            // Never call FindNextChangeNotification: acknowledging an event
            // would make a transient create/remove operation disappear.
            if (WaitForSingleObject(notification, 0) != WaitTimeout) Deny();
        }

        public void Dispose() => notification.Dispose();
    }

    // Explicit opt-in Win32 proof, exclusively for synthetic fixtures.
    // One pending OVERLAPPED ReadDirectoryChangesW call per directory.
    // The buffer is never parsed: ANY completion (including overflow,
    // cancellation, zero bytes, or an I/O error) means fail closed.
    // Nothing is rearmed and no names or paths are reported.
    private sealed class BoundedNativeChangeProbe : IDisposable
    {
        private const int BufferBytes = 4096;
        private const int TinyBufferBytes = 64;
        private const int ErrorNotifyEnumDir = 1022;
        private const uint WaitTimeout = 0x00000102;
        private const uint ErrorIoPending = 997;
        private const uint ErrorIoIncomplete = 996;
        private const int ErrorOperationAborted = 995;
        private const uint WaitSignaled = 0;
        private const uint StructuralChanges = 0x00000001 | 0x00000002;
        // If the kernel never confirms completion within the bounded wait,
        // keep all handles AND unmanaged allocations alive until process exit.
        // This tiny intentional process-lifetime retention avoids use-after-free.
        private static readonly List<(SafeFileHandle Directory,
            SafeWaitHandle Event, IntPtr Buffer, IntPtr Overlapped)> InFlight = new();
        private SafeFileHandle? directory;
        private SafeWaitHandle? signal;
        private IntPtr buffer;
        private IntPtr overlapped;
        private bool pending;

        [StructLayout(LayoutKind.Sequential)]
        private struct OverlappedHeader
        {
            public IntPtr Internal, InternalHigh;
            public uint Offset, OffsetHigh;
            public IntPtr Event;
        }

        [DllImport("kernel32.dll", EntryPoint = "CreateEventW",
            CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern SafeWaitHandle CreateEvent(
            IntPtr security, [MarshalAs(UnmanagedType.Bool)] bool manualReset,
            [MarshalAs(UnmanagedType.Bool)] bool initialState, string? name);

        // Query filesystem family from the SAME pinned directory handle,
        // not from an unrelated drive letter or path. Never log volume
        // label, serial number, UNC path or exact unknown filesystem names.
        [DllImport("kernel32.dll", EntryPoint = "GetVolumeInformationByHandleW",
            CharSet = CharSet.Unicode, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool GetVolumeClass(
            SafeFileHandle directory, IntPtr volumeName, uint volumeNameLength,
            IntPtr serialNumber, IntPtr maxComponentLength, IntPtr fileSystemFlags,
            [Out] StringBuilder fileSystemName, uint fileSystemNameLength);

        private static string SafeVolumeFamily(SafeFileHandle pinnedDirectory)
        {
            StringBuilder fileSystem = new(64);
            if (!GetVolumeClass(pinnedDirectory, IntPtr.Zero, 0,
                    IntPtr.Zero, IntPtr.Zero, IntPtr.Zero,
                    fileSystem, (uint)fileSystem.Capacity))
                return "Unavailable";
            string family = fileSystem.ToString();
            if (family.Equals("NTFS", StringComparison.OrdinalIgnoreCase))
                return "NTFS";
            if (family.Equals("ReFS", StringComparison.OrdinalIgnoreCase))
                return "ReFS";
            return "Other";
        }

        [DllImport("kernel32.dll", EntryPoint = "ReadDirectoryChangesW", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool ReadChanges(
            SafeFileHandle directory, IntPtr notificationBuffer, uint bufferLength,
            [MarshalAs(UnmanagedType.Bool)] bool subtree, uint filter,
            out uint bytesReturned, IntPtr nativeOverlapped, IntPtr completionRoutine);

        [DllImport("kernel32.dll", EntryPoint = "CancelIoEx", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CancelPending(
            SafeFileHandle directory, IntPtr nativeOverlapped);

        [DllImport("kernel32.dll", EntryPoint = "WaitForSingleObject", SetLastError = true)]
        private static extern uint WaitEvent(SafeWaitHandle signal, uint milliseconds);

        [DllImport("kernel32.dll", EntryPoint = "ResetEvent", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool ResetNotificationEvent(SafeWaitHandle signal);

        [DllImport("kernel32.dll", EntryPoint = "GetOverlappedResult", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool ReadCompletion(
            SafeFileHandle directory, IntPtr nativeOverlapped,
            out uint bytesTransferred, [MarshalAs(UnmanagedType.Bool)] bool wait);

        public BoundedNativeChangeProbe(string path, SafeFileHandle original,
            bool testSmallBuffer = false)
        {
            int watchBufferBytes = testSmallBuffer ? TinyBufferBytes : BufferBytes;
            try
            {
                // New name-based handle is checked against a retained relative
                // directory handle before registration. NOT an atomic binding.
                const uint access = 0x0001 | 0x0080;
                const uint flags = 0x02000000 | 0x00200000 | 0x40000000;
                directory = CreateFile(path, access, 7, IntPtr.Zero, 3, flags, IntPtr.Zero);
                if (directory is null || directory.IsInvalid) Deny();
                if (!Same(Identity(original), Identity(directory))) Deny();
                if (!QueryTag(directory, FileAttributeTagInfoClass,
                        out FileAttributeTagInfo tag,
                        (uint)Marshal.SizeOf<FileAttributeTagInfo>()) ||
                    (tag.FileAttributes & 0x400U) != 0U ||
                    (tag.FileAttributes & 0x10U) == 0U) Deny();

                signal = CreateEvent(IntPtr.Zero, true, false, null);
                if (signal is null || signal.IsInvalid) Deny();
                buffer = Marshal.AllocHGlobal(watchBufferBytes);
                overlapped = Marshal.AllocHGlobal(Marshal.SizeOf<OverlappedHeader>());
                Marshal.StructureToPtr(new OverlappedHeader
                {
                    Event = signal.DangerousGetHandle()
                }, overlapped, false);

                // An accepted overlapped call can return TRUE without any
                // notification yet. Only FALSE + ERROR_IO_PENDING is also
                // a valid asynchronous start. Completion is determined by
                // the event, not by the initial BOOL return.
                bool submitted = ReadChanges(directory, buffer,
                    (uint)watchBufferBytes, false,
                    StructuralChanges, out _, overlapped, IntPtr.Zero);
                if (!submitted && Marshal.GetLastWin32Error() != ErrorIoPending)
                    Deny();
                pending = true;
                VerifyQuiet();
            }
            catch
            {
                Dispose();
                throw;
            }
        }

        public void VerifyQuiet()
        {
            if (!pending || signal is null || signal.IsInvalid ||
                directory is null || directory.IsInvalid) Deny();
            uint state = WaitEvent(signal, 0);
            if (state == WaitTimeout) return;
            // Read the completion status without waiting. ERROR_NOTIFY_ENUM_DIR
            // (1022), ERROR_MORE_DATA (234), ERROR_OPERATION_ABORTED (995),
            // zero bytes and even a nominal success all mean: no trustworthy
            // uninterrupted directory view. Never parse the event buffer.
            _ = ReadCompletion(directory, overlapped, out _, false);
            Deny();
        }

        // Test-only: request a *real Windows I/O cancellation* after arming.
        // The resulting OS completion is never accepted as observation.
        public void CancelForSyntheticTest()
        {
            if (!pending || directory is null || directory.IsInvalid ||
                overlapped == IntPtr.Zero) Deny();
            if (!CancelPending(directory, overlapped)) Deny();
            // Cancellation may finish later. VerifyQuiet refuses it when
            // signaled; regardless, this diagnostic must never produce JSON.
            _ = WaitEvent(signal!, 2000);
            VerifyQuiet();
            Deny();
        }

        // Unlike the generic cancellation test, this verifies exactly what
        // GetOverlappedResult reports for the cancelled native operation.
        // It is NOT evidence of a real directory-event buffer overflow.
        [DoesNotReturn]
        public void AttestRealCancellationForSyntheticTest()
        {
            if (!pending || directory is null || directory.IsInvalid ||
                signal is null || signal.IsInvalid || overlapped == IntPtr.Zero)
                Deny();
            if (!CancelPending(directory, overlapped)) Deny();
            if (WaitEvent(signal, 2000) != WaitSignaled) Deny();
            bool completedSuccessfully = ReadCompletion(directory, overlapped,
                out _, false);
            int error = Marshal.GetLastWin32Error();
            if (completedSuccessfully || error != ErrorOperationAborted) Deny();
            // Main catches this one test-only signal, disposes the pending
            // native handles, and emits the same generic refusal string.
            throw new SyntheticCancellationVerified();
        }

        // A single long synthetic filename is intentionally larger than the
        // 64-byte notification buffer. Only actual GetOverlappedResult status
        // proves a lost-detail condition; no events are parsed or logged.
        [DoesNotReturn]
        public void AttestSmallBufferLossForSyntheticTest()
        {
            if (!pending || directory is null || directory.IsInvalid ||
                signal is null || signal.IsInvalid || overlapped == IntPtr.Zero)
                Deny();
            Console.Out.WriteLine("READY");
            Console.Out.Flush();
            string? reply = Console.In.ReadLineAsync()
                .WaitAsync(TimeSpan.FromSeconds(20))
                .GetAwaiter().GetResult();
            if (reply != "CONTINUE") Deny();
            if (WaitEvent(signal, 2000) != WaitSignaled) Deny();
            bool ok = ReadCompletion(directory, overlapped, out uint bytes, false);
            int error = ok ? 0 : Marshal.GetLastWin32Error();
            if (!ok && error == ErrorNotifyEnumDir)
                throw new SyntheticNotificationLossWitness(5);
            if (ok && bytes == 0)
                throw new SyntheticNotificationLossWitness(6);
            Deny();
        }

        // Two-stage test of *accumulated* directory notifications, as distinct
        // from a too-small single-record 64-byte notification experiment.
        // 1. Complete the original 4096-byte request with a single trigger.
        // 2. Leave this SAME OS directory handle unarmed while another process
        //    performs many rename cycles, then issue the next request.
        // Report only loss signalled by the Windows kernel, never inferred
        // from event count or from the Win32 one-shot change fence.
        [DoesNotReturn]
        public void AttestQueuedOverflowForSyntheticTest(Action<bool> auditSnapshot)
        {
            if (!pending || directory is null || directory.IsInvalid ||
                signal is null || signal.IsInvalid || overlapped == IntPtr.Zero)
                Deny();
            Console.Out.WriteLine("READY");
            Console.Out.Flush();
            if (Console.In.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(20))
                .GetAwaiter().GetResult() != "TRIGGER_DONE") Deny();
            if (WaitEvent(signal, 3000) != WaitSignaled) Deny();
            bool firstOk = ReadCompletion(directory, overlapped, out uint firstBytes, false);
            if (!firstOk || firstBytes == 0) Deny();
            // Snapshot immediately after the first completed event batch.
            // No pending request exists while this baseline is collected.
            auditSnapshot(false);

            Console.Out.WriteLine("VOLUME_KIND=" + SafeVolumeFamily(directory));
            Console.Out.WriteLine("STORM_READY");
            Console.Out.Flush();
            if (Console.In.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(30))
                .GetAwaiter().GetResult() != "STORM_DONE") Deny();

            if (!ResetNotificationEvent(signal)) Deny();
            Marshal.StructureToPtr(new OverlappedHeader
            {
                Event = signal.DangerousGetHandle()
            }, overlapped, false);
            bool submitted = ReadChanges(directory, buffer, BufferBytes, false,
                StructuralChanges, out _, overlapped, IntPtr.Zero);
            if (!submitted && Marshal.GetLastWin32Error() != ErrorIoPending)
                Deny();
            if (WaitEvent(signal, 3000) != WaitSignaled) Deny();
            bool ok = ReadCompletion(directory, overlapped, out uint bytes, false);
            int error = ok ? 0 : Marshal.GetLastWin32Error();
            if ((!ok && error == ErrorNotifyEnumDir) || (ok && bytes == 0))
            {
                // Reconcile a fresh bounded directory snapshot after evidence
                // loss. This CANNOT reconstruct historical event order.
                // It MUST still return refusal: no recovery authorization.
                auditSnapshot(true);
                Console.Out.WriteLine("SCAN_ONLY");
                Console.Out.Flush();
                throw new SyntheticNotificationLossWitness(
                    (!ok && error == ErrorNotifyEnumDir) ? 7 : 8);
            }
            Deny();
        }

        public void Dispose()
        {
            // Unmanaged memory and OS event must outlive OVERLAPPED kernel I/O.
            // CancelIoEx only REQUESTS cancellation; it does not wait for it.
            bool completed = !pending;
            if (pending && directory is not null && !directory.IsInvalid &&
                signal is not null && !signal.IsInvalid)
            {
                try
                {
                    _ = CancelPending(directory, overlapped);
                    if (WaitEvent(signal, 2000) == WaitSignaled)
                    {
                        bool ok = ReadCompletion(directory, overlapped, out _, false);
                        // The event reports completion, but if Win32 says
                        // ERROR_IO_INCOMPLETE we must retain all resources.
                        completed = ok || Marshal.GetLastWin32Error() != ErrorIoIncomplete;
                    }
                }
                catch { completed = false; }
            }
            if (completed)
            {
                if (overlapped != IntPtr.Zero) Marshal.FreeHGlobal(overlapped);
                if (buffer != IntPtr.Zero) Marshal.FreeHGlobal(buffer);
                directory?.Dispose();
                signal?.Dispose();
            }
            else if (directory is not null && signal is not null)
            {
                // No GC/finalizer may close an event still used by the kernel.
                // The process is short-lived and synthetic; this is safer than
                // freeing buffers or event handles before I/O completion.
                lock (InFlight)
                    InFlight.Add((directory, signal, buffer, overlapped));
            }
            overlapped = IntPtr.Zero;
            buffer = IntPtr.Zero;
            directory = null;
            signal = null;
            pending = false;
        }
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
        SafeFileHandle parent, string directory, Action? pauseForMutation = null,
        List<string>? syntheticNames = null,
        Dictionary<string, FileIdInfo>? syntheticIdentity = null)
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
                        // Synthetic-only comparison: never serialize or print
                        // these names. A count-only audit misses an equal-sized
                        // replacement of a fake .scs file.
                        syntheticNames?.Add(name);
                        if (syntheticIdentity is not null)
                        {
                            // Test-only: inspect identity by pinned parent,
                            // refuse directories/reparse entries. No file bytes.
                            if ((attributes & (0x10 | 0x400)) != 0) Deny();
                            using SafeFileHandle child =
                                OpenChildFileIdentity(held, name);
                            if (!syntheticIdentity.TryAdd(name, Identity(child)))
                                Deny();
                        }
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
            // Extra flags only select a safer synthetic diagnostic; they
            // never enable actual game access or any mutation operation.
            bool raceBarrier = args.Length >= 5 &&
                String.Equals(args[4], "--race-barrier", StringComparison.Ordinal);
            bool rdcwProbe = (args.Length == 5 && args[4] == "--rdcw-probe") ||
                (args.Length == 6 && raceBarrier && args[5] == "--rdcw-probe");
            bool injectCancellation = args.Length == 6 &&
                args[4] == "--rdcw-probe" && args[5] == "--test-cancel-pending-io";
            bool attestCancellation = args.Length == 6 &&
                args[4] == "--rdcw-probe" && args[5] == "--test-attest-cancel-995";
            bool smallBufferEvidence = args.Length == 6 &&
                args[4] == "--rdcw-probe" && args[5] == "--test-small-buffer-loss";
            bool queuedOverflowEvidence = args.Length == 6 &&
                args[4] == "--rdcw-probe" && args[5] == "--test-queued-overflow";
            if (!OperatingSystem.IsWindows() ||
                !(args.Length == 4 || (args.Length == 5 && (raceBarrier || rdcwProbe)) ||
                    (args.Length == 6 &&
                        (raceBarrier && rdcwProbe || injectCancellation ||
                         attestCancellation || smallBufferEvidence ||
                         queuedOverflowEvidence))) ||
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
            // Both watches are registered before the test barrier. The
            // relative native handles still own the actual enumeration and
            // marker-byte reads; watchers never grant authorization.
            using SafeFileHandle heldTarget = OpenChildDirectory(heldRoot, "native-enum");
            using DirectoryChangeFence rootChanges = new(root, heldRoot);
            using DirectoryChangeFence targetChanges = new(target, heldTarget);
            using BoundedNativeChangeProbe? rootDetail =
                rdcwProbe || injectCancellation || attestCancellation ||
                smallBufferEvidence || queuedOverflowEvidence
                ? new BoundedNativeChangeProbe(root, heldRoot) : null;
            using BoundedNativeChangeProbe? targetDetail =
                rdcwProbe || injectCancellation || attestCancellation ||
                smallBufferEvidence || queuedOverflowEvidence
                ? new BoundedNativeChangeProbe(target, heldTarget,
                    testSmallBuffer: smallBufferEvidence) : null;
            if (injectCancellation)
            {
                rootDetail!.CancelForSyntheticTest();
                Deny();
            }
            if (attestCancellation)
            {
                rootDetail!.AttestRealCancellationForSyntheticTest();
                Deny();
            }
            if (smallBufferEvidence)
            {
                targetDetail!.AttestSmallBufferLossForSyntheticTest();
                Deny();
            }
            if (queuedOverflowEvidence)
            {
                int[]? baselineCounts = null;
                List<string> baselineNames = new();
                Dictionary<string, FileIdInfo> baselineIds =
                    new(StringComparer.Ordinal);
                targetDetail!.AttestQueuedOverflowForSyntheticTest(afterLoss =>
                {
                    // Both snapshots use bounded native handle enumeration.
                    // Compare names AS WELL as counts; same-size .scs name
                    // substitution must not pass as a recovered snapshot.
                    List<string> currentNames = new();
                    Dictionary<string, FileIdInfo> currentIds =
                        new(StringComparer.Ordinal);
                    int[] current = Inspect(heldRoot, target,
                        syntheticNames: currentNames,
                        syntheticIdentity: currentIds);
                    if (current[0] != 2 || current[1] != 0 ||
                        current[2] != 2 || current[3] != 0 ||
                        current[4] != 1) Deny();
                    currentNames.Sort(StringComparer.Ordinal);
                    if (!afterLoss)
                    {
                        baselineCounts = current;
                        baselineNames.AddRange(currentNames);
                        foreach (var pair in currentIds)
                            baselineIds.Add(pair.Key, pair.Value);
                        return;
                    }
                    if (baselineCounts is null ||
                        baselineCounts.Length != current.Length ||
                        baselineNames.Count != currentNames.Count) Deny();
                    for (int i = 0; i < current.Length; i++)
                        if (current[i] != baselineCounts[i]) Deny();
                    for (int i = 0; i < currentNames.Count; i++)
                    {
                        string name = currentNames[i];
                        if (!String.Equals(name, baselineNames[i],
                                StringComparison.Ordinal)) Deny();
                        if (!baselineIds.TryGetValue(name,
                                out FileIdInfo beforeId) ||
                            !currentIds.TryGetValue(name,
                                out FileIdInfo afterId) ||
                            !Same(beforeId, afterId)) Deny();
                    }
                    VerifyHeldFixtureRoot(root, heldRoot, rootId, rootBasic,
                        ancestors.TemporaryHandle);
                    VerifyHeldMarker(markerPath, args[3], heldMarker,
                        markerId, markerBasic, heldRoot);
                    ancestors.Verify();
                });
                Deny();
            }
            rootChanges.VerifyNotSignaled();
            targetChanges.VerifyNotSignaled();
            rootDetail?.VerifyQuiet();
            targetDetail?.VerifyQuiet();
            int[] v = Inspect(heldRoot, target, raceBarrier ? (Action)PauseForTestMutation : null);
            rootChanges.VerifyNotSignaled();
            targetChanges.VerifyNotSignaled();
            rootDetail?.VerifyQuiet();
            targetDetail?.VerifyQuiet();
            VerifyHeldFixtureRoot(root, heldRoot, rootId, rootBasic,
                ancestors.TemporaryHandle);
            VerifyHeldMarker(markerPath, args[3], heldMarker, markerId, markerBasic,
                heldRoot);
            ancestors.Verify();
            rootChanges.VerifyNotSignaled();
            targetChanges.VerifyNotSignaled();
            rootDetail?.VerifyQuiet();
            targetDetail?.VerifyQuiet();
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
        catch (SyntheticCancellationVerified)
        {
            // Exit 4 witnesses the kernel status 995 in a synthetic test.
            Console.Error.WriteLine(Refusal);
            return 4;
        }
        catch (SyntheticNotificationLossWitness witnessed)
        {
            // Only synthetic diagnostics can emit these exit codes.
            // Any stdout data is solely the literal READY barrier.
            Console.Error.WriteLine(Refusal);
            return witnessed.Code;
        }
        catch
        {
            // Never reveal a real directory, marker, FileID, file name or stack trace.
            Console.Error.WriteLine(Refusal);
            return 3;
        }
    }
}
