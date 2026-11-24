// Fixed native lifecycle fixture: no caller paths or production deadline promise.
using System.Diagnostics;
using System.Text.Json;
using Microsoft.Win32.SafeHandles;

internal static partial class Program
{
    private static int RunLifecycleFixtureM124()
    {
        var rows = new List<object>();
        foreach (string scenario in new[]{"normal","expired-before","expired-between","expired-during","cancel-during"})
        {
            string root = Directory.CreateTempSubdirectory("omsi-m124-lifecycle-").FullName;
            var metrics = new M122Metrics();
            var tracked = new List<SafeFileHandle>();
            try
            {
                string model = Path.Combine(root,"model");
                Directory.CreateDirectory(model);
                string config = Path.Combine(model,M122Config);
                File.WriteAllBytes(config,M122Fixed);
                File.WriteAllBytes(Path.Combine(model,"body.o3d"),M112Sentinel);
                long start = Stopwatch.GetTimestamp();
                long budget = checked(60L*Stopwatch.Frequency);
                long offset = scenario=="expired-before"?budget:0;
                bool cancelled=false, reached=scenario is "normal" or "expired-before";
                bool Stop()
                {
                    long now = Stopwatch.GetTimestamp();
                    return cancelled || now<start || now-start+offset>=budget;
                }
                void Checkpoint(string stage)
                {
                    if (scenario=="expired-between" && stage=="between-content-and-metadata")
                    { offset=budget;reached=true; }
                    else if (scenario=="expired-during" && stage=="after-first-dependency")
                    { offset=budget;reached=true; }
                    else if (scenario=="cancel-during" && stage=="after-first-dependency")
                    { cancelled=true;reached=true; }
                }
                string[]? result;
                using (var pins = AncestorPins.Pin(root))
                {
                    if (!BoundedNativeChangeProbe.HasNtfsVolume(pins.TemporaryHandle)) Deny();
                    tracked.Add(pins.TemporaryHandle);
                    result=M122Observe(pins,model,Checkpoint,Stop,metrics,tracked.Add);
                }
                if (!reached || tracked.Count!=(scenario=="expired-before"?1:4) ||
                    tracked.Any(handle=>!handle.IsClosed)) Deny();
                if (scenario=="normal")
                {
                    if (result is null || !result.SequenceEqual(new[]{"exact-observed","not-observed-in-directory"}) ||
                        metrics.Reads!=3 || metrics.References!=2) Deny();
                }
                else if (result is not null || !Stop() ||
                    metrics.Reads!=(scenario=="expired-before"?0:2) ||
                    metrics.References!=(scenario is "expired-during" or "cancel-during"?1:0)) Deny();
                if (!File.ReadAllBytes(config).AsSpan().SequenceEqual(M122Fixed)) Deny();
            }
            finally { Directory.Delete(root,true); }
            if (Directory.Exists(root)) Deny();
            rows.Add(new {scenario,outcome=scenario=="normal"?"completed":scenario=="cancel-during"?"cancelled":"deadline-refused",
                configReadCalls=metrics.Reads,referencesObserved=metrics.References,
                trackedHandlesClosed=true,trackedHandleCount=tracked.Count,temporaryRootRemoved=true});
        }
        Console.WriteLine(JsonSerializer.Serialize(new {
            schema="omsi-m124-windows-lifecycle-fixture-v1",cases=rows,
            monotonicCheckpointDeadline=true,testClockOffsetUsed=true,partialReportPublished=false,
            osDeadlineProven=false,memoryErasureProven=false,realModValidated=false,operationsEnabled=false
        }));
        return 0;
    }
}
