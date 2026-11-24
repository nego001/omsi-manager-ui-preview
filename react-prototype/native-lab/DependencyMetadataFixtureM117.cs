// Standalone fixed synthetic NTFS fixture. No caller paths or dependency byte reads.
using System.Text.Json;
using Microsoft.Win32.SafeHandles;

internal static partial class Program
{
    private static int RunDependencyMetadataFixtureM117()
    {
        string root = Directory.CreateTempSubdirectory("omsi-m117-deps-").FullName;
        string model = Path.Combine(root, "model");
        string sentinel = Path.Combine(root, "outside.o3d");
        byte[] expected = [83, 69, 78, 84, 73, 78, 69, 76];
        try
        {
            Directory.CreateDirectory(model);
            File.WriteAllBytes(sentinel, expected);
            File.WriteAllBytes(Path.Combine(model, "body.o3d"), expected);
            File.WriteAllBytes(Path.Combine(model, "Ambiguous.o3d"), expected);
            Directory.CreateDirectory(Path.Combine(model, "folder.o3d"));
            string hardlink = Path.Combine(model, "hardlink.o3d");
            if (!M112HardLink(hardlink, Path.Combine(model, "body.o3d"), IntPtr.Zero)) Deny();
            // Keep the exact-name positive case independent of the hardlink fixture.
            File.WriteAllBytes(Path.Combine(model, "exact.o3d"), expected);
            bool collisionAvailable = false, linkAvailable = false;
            string collision = Path.Combine(model, "AMBIGUOUS.o3d");
            try
            {
                using var stream = new FileStream(collision, FileMode.CreateNew, FileAccess.Write);
                stream.Write(expected);
                collisionAvailable = true;
            }
            catch (IOException)
            {
                // Only classify as unavailable if the original spelling still exists.
                if (!File.Exists(Path.Combine(model, "Ambiguous.o3d"))) Deny();
            }
            try
            {
                File.CreateSymbolicLink(Path.Combine(model, "linked.o3d"), sentinel);
                linkAvailable = true;
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }

            var cases = new List<object>();
            using (AncestorPins pins = AncestorPins.Pin(root))
            {
                var rootHandle = pins.TemporaryHandle;
                if (!BoundedNativeChangeProbe.HasNtfsVolume(rootHandle)) Deny();
                using SafeFileHandle held = OpenChildDirectory(rootHandle, "model");
                var heldId = Identity(held);
                var heldBasic = Basic(held);
                var attributes = new Dictionary<string, uint>(StringComparer.Ordinal);
                int[] observed = Inspect(rootHandle, model, syntheticAttributes: attributes);
                if (observed[0] != attributes.Count) Deny();
                void Verify()
                {
                    pins.Verify();
                    using SafeFileHandle current = OpenChildDirectory(rootHandle, "model");
                    if (!Same(heldId, Identity(held)) || !Same(heldId, Identity(current)) ||
                        !SameStableMetadata(heldBasic, Basic(held)) ||
                        !SameStableMetadata(heldBasic, Basic(current))) Deny();
                }

                string Lookup(string name)
                {
                    Verify();
                    string[] matches = attributes.Keys.Where(x =>
                        String.Equals(x, name, StringComparison.OrdinalIgnoreCase)).ToArray();
                    if (matches.Length == 0) return "not-observed-in-directory";
                    if (matches.Length > 1) return "ambiguous-case";
                    string actual = matches[0];
                    uint attrs = attributes[actual];
                    if ((attrs & 0x400U) != 0) return "link-refused";
                    if ((attrs & 0x10U) != 0) return "not-regular-path";
                    using SafeFileHandle child = OpenChildFileIdentity(held, actual);
                    // No FILE_READ_DATA handle for dependencies. Query only standard info.
                    if (!M112QueryStandard(child, 1, out var standard,
                        (uint)System.Runtime.InteropServices.Marshal.SizeOf<M112StandardInfo>())) Deny();
                    if (standard.Directory != 0 || standard.DeletePending != 0 ||
                        standard.NumberOfLinks != 1) return "not-regular-path";
                    Verify();
                    return String.Equals(name, actual, StringComparison.Ordinal)
                        ? "exact-observed" : "case-only-observed";
                }
                void Check(string scenario, string name, string expectedOutcome, bool available = true)
                {
                    string outcome = available ? Lookup(name) : "fixture-unavailable";
                    if (available && outcome != expectedOutcome) Deny();
                    cases.Add(new { scenario, outcome });
                }
                Check("exact", "exact.o3d", "exact-observed");
                Check("case-only", "Exact.o3d", "case-only-observed");
                Check("missing", "missing.o3d", "not-observed-in-directory");
                Check("ambiguous", "ambiguous.o3d", "ambiguous-case", collisionAvailable);
                Check("link", "linked.o3d", "link-refused", linkAvailable);
                Check("directory", "folder.o3d", "not-regular-path");
                Check("hardlink", "hardlink.o3d", "not-regular-path");
                Verify();
            }
            if (!File.ReadAllBytes(sentinel).AsSpan().SequenceEqual(expected)) Deny();
            Console.WriteLine(JsonSerializer.Serialize(new {
                schema = "omsi-m117-windows-dependency-metadata-fixture-v1", cases,
                nativeDirectoryEnumerationByHandle = true, dependencyContentsRead = false,
                realModValidated = false, atomicContainmentProven = false, operationsEnabled = false
            }));
            return 0;
        }
        finally { Directory.Delete(root, true); }
    }
}
