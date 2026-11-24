// Fixed self-created NTFS fixture. No user path, dependency content read or production grant.
using System.Text;
using System.Text.Json;
using Microsoft.Win32.SafeHandles;

internal static partial class Program
{
    private static readonly byte[] M122Fixed = Encoding.ASCII.GetBytes("[mesh]\r\nbody.o3d\r\n[mesh]\r\nmissing.o3d\r\n");
    private const string M122Config = "vehicle.cfg";
    private sealed class M122Metrics { public int Reads, Bytes, Entries, References; }

    private static string[]? M122Observe(AncestorPins pins, string model,
        Action<string> checkpoint, Func<bool> cancelled, M122Metrics metrics)
    {
        var root = pins.TemporaryHandle;
        void Active() { if (cancelled()) Deny(); }
        try
        {
            Active();
            using var directory = OpenChildDirectory(root, "model");
            var directoryId = Identity(directory);
            var directoryBasic = Basic(directory);
            using var initial = OpenChildFileIdentity(directory, M122Config);
            var sourceId = Identity(initial);
            var sourceBasic = Basic(initial);
            var size = M112Standard(initial).EndOfFile;
            using var config = OpenRelative(directory, M122Config, false);
            void Verify()
            {
                Active();
                pins.Verify();
                using var currentDir = OpenChildDirectory(root, "model");
                if (!Same(directoryId, Identity(directory)) || !Same(directoryId, Identity(currentDir)) ||
                    !SameStableMetadata(directoryBasic, Basic(directory)) ||
                    !SameStableMetadata(directoryBasic, Basic(currentDir))) Deny();
                using var current = OpenChildFileIdentity(directory, M122Config);
                if (!Same(sourceId, Identity(config)) || !Same(sourceId, Identity(current)) ||
                    !SameStableMetadata(sourceBasic, Basic(config)) ||
                    !SameStableMetadata(sourceBasic, Basic(current)) ||
                    M112Standard(config).EndOfFile != size || M112Standard(current).EndOfFile != size) Deny();
                Active();
            }
            byte[] Read()
            {
                var bytes = new byte[checked((int)size)];
                int offset = 0;
                while (offset < bytes.Length)
                {
                    Verify();
                    int requested = Math.Min(4096, bytes.Length-offset);
                    int n = RandomAccess.Read(config, bytes.AsSpan(offset, requested), offset);
                    metrics.Reads++; metrics.Bytes += n;
                    if (n < 1 || n > requested) Deny();
                    offset += n;
                    Verify();
                }
                return bytes;
            }
            Dictionary<string,uint> Inventory()
            {
                Verify();
                var map = new Dictionary<string,uint>(StringComparer.Ordinal);
                int[] observed = Inspect(root, model, syntheticAttributes: map, pinnedDirectory: directory);
                if (map.Count != observed[0] || metrics.Entries + map.Count > 64) Deny();
                metrics.Entries += map.Count;
                Verify();
                return map;
            }
            byte[] first = Read();
            if (!first.AsSpan().SequenceEqual(M122Fixed) || !Read().AsSpan().SequenceEqual(first)) Deny();
            string[] lines = Encoding.ASCII.GetString(first).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
            if (!lines.SequenceEqual(new[]{"[mesh]","body.o3d","[mesh]","missing.o3d"})) Deny();
            checkpoint("between-content-and-metadata");
            Verify();
            var baseline = Inventory();
            var outcomes = new List<string>();
            foreach (string name in new[]{lines[1],lines[3]})
            {
                Verify();
                string[] matches = baseline.Keys.Where(x=>String.Equals(x,name,StringComparison.OrdinalIgnoreCase)).ToArray();
                string outcome;
                if (matches.Length == 0) outcome = "not-observed-in-directory";
                else if (matches.Length > 1) outcome = "ambiguous-case";
                else
                {
                    string actual = matches[0];
                    uint attrs = baseline[actual];
                    if ((attrs & 0x400U) != 0) outcome = "link-refused";
                    else if ((attrs & 0x10U) != 0) outcome = "not-regular-path";
                    else
                    {
                        using var child = OpenChildFileIdentity(directory,actual);
                        if (!M112QueryStandard(child,1,out var info,
                            (uint)System.Runtime.InteropServices.Marshal.SizeOf<M112StandardInfo>())) Deny();
                        outcome = info.Directory != 0 || info.DeletePending != 0 || info.NumberOfLinks != 1
                            ? "not-regular-path" : String.Equals(name,actual,StringComparison.Ordinal)
                                ? "exact-observed" : "case-only-observed";
                    }
                }
                outcomes.Add(outcome); metrics.References++;
                checkpoint(outcomes.Count == 1 ? "after-first-dependency" : "after-second-dependency");
                Verify();
                // Re-enumerate using the same held handle; compare names and
                // attributes, so coarse directory timestamps alone are not trusted.
                var current = Inventory();
                if (current.Count != baseline.Count ||
                    baseline.Any(pair=>!current.TryGetValue(pair.Key,out uint v)||v!=pair.Value)) Deny();
            }
            if (!Read().AsSpan().SequenceEqual(first)) Deny();
            Verify();
            return outcomes.ToArray();
        }
        catch (IOException) { return null; }
    }

    private static object M122Case(string scenario)
    {
        string root = Directory.CreateTempSubdirectory("omsi-m122-linked-").FullName;
        string model = Path.Combine(root,"model"), cfg = Path.Combine(model,M122Config),
            body = Path.Combine(model,"body.o3d"), sentinel = Path.Combine(root,"outside.o3d");
        var m = new M122Metrics();
        try
        {
            Directory.CreateDirectory(model);
            File.WriteAllBytes(cfg,M122Fixed);
            File.WriteAllBytes(sentinel,M112Sentinel);
            if (scenario == "link")
            {
                try { File.CreateSymbolicLink(body,sentinel); }
                catch (IOException) { return Row("fixture-unavailable",[]); }
                catch (UnauthorizedAccessException) { return Row("fixture-unavailable",[]); }
            }
            else File.WriteAllBytes(scenario == "case-only" ? Path.Combine(model,"Body.o3d") : body,M112Sentinel);
            bool cancelled=false, changed=false, unavailable=false;
            void Checkpoint(string stage)
            {
                if (changed || unavailable) return;
                try
                {
                    if (stage == "between-content-and-metadata")
                    {
                        if (scenario == "parent-replaced")
                        {
                            try { Directory.Move(model,Path.Combine(root,"retired")); }
                            catch (Exception e) when ((e is IOException || e is UnauthorizedAccessException) &&
                                (unchecked((uint)e.HResult) is 0x80070005U or 0x80070020U or 0x80070021U))
                            { unavailable=true;cancelled=true;return; }
                            Directory.CreateDirectory(model);File.WriteAllBytes(cfg,M122Fixed);
                        }
                        else if (scenario == "config-replaced")
                        { File.Move(cfg,Path.Combine(model,"retired.cfg"));File.WriteAllBytes(cfg,M122Fixed); }
                        else if (scenario == "cancel-between") cancelled=true;
                        else return;
                    }
                    else if (stage == "after-first-dependency" && scenario == "directory-changed")
                        File.WriteAllBytes(Path.Combine(model,"new.o3d"),M112Sentinel);
                    else if (stage == "after-first-dependency" && scenario == "cancel-during-metadata") cancelled=true;
                    else return;
                    changed=true;
                }
                catch(Exception e){throw new InvalidOperationException("M122_FIXTURE_SETUP_FAILED",e);}
            }
            string[]? result;
            using (var pins = AncestorPins.Pin(root))
            {
                if (!BoundedNativeChangeProbe.HasNtfsVolume(pins.TemporaryHandle)) Deny();
                result = M122Observe(pins,model,Checkpoint,()=>cancelled,m);
            }
            if (!File.ReadAllBytes(sentinel).AsSpan().SequenceEqual(M112Sentinel) ||
                !File.ReadAllBytes(cfg).AsSpan().SequenceEqual(M122Fixed)) Deny();
            if (unavailable)
            {
                if (changed || result is not null || m.References != 0 || m.Entries != 0 ||
                    m.Bytes != 2*M122Fixed.Length || Directory.Exists(Path.Combine(root,"retired"))) Deny();
                return Row("fixture-unavailable",[]);
            }
            if (scenario is "normal" or "case-only" or "link")
            {
                string expected = scenario == "normal" ? "exact-observed" : scenario == "case-only" ? "case-only-observed" : "link-refused";
                if (result is null || !result.SequenceEqual(new[]{expected,"not-observed-in-directory"}) ||
                    m.Bytes != 3*M122Fixed.Length || m.References != 2) Deny();
                return Row("linked-fixture-observed",result!);
            }
            if (result is not null || !changed || m.Bytes != 2*M122Fixed.Length ||
                m.References != (scenario is "directory-changed" or "cancel-during-metadata" ? 1 : 0)) Deny();
            return Row("linked-fixture-refused",[]);
        }
        finally { Directory.Delete(root,true); }
        object Row(string status,string[] outcomes)=>new {scenario,status,outcomes,
            configReadCalls=m.Reads,configBytesRead=m.Bytes,entriesScanned=m.Entries,referencesObserved=m.References};
    }

    private static int RunLinkedDiagnosticFixtureM122()
    {
        var rows = new List<object>();
        foreach (string scenario in new[]{"normal","case-only","link","parent-replaced","config-replaced","cancel-between","directory-changed","cancel-during-metadata"})
        {
            try { rows.Add(M122Case(scenario)); }
            catch { Console.Error.WriteLine("M122_FIXED_SCENARIO_FAILED:"+scenario);throw; }
        }
        Console.WriteLine(JsonSerializer.Serialize(new {
            schema="omsi-m122-linked-windows-diagnostic-fixture-v1",scope="fixed-synthetic-tree-only",cases=rows,
            sameRetainedHandlesUsed=true,dependencyContentsRead=false,realModValidated=false,
            atomicContainmentProven=false,nativeConsentVerified=false,operationsEnabled=false
        }));
        return 0;
    }
}
