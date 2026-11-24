// Fixed NTFS test only. A processing budget is not a kernel buffer limit.
using System.Text.Json;
using Microsoft.Win32.SafeHandles;

internal static partial class Program
{
    private sealed class M123EntryBudgetReached(int count) : Exception
    {
        public int Count { get; } = count;
    }

    private static int RunEntryBudgetFixtureM123()
    {
        string root = Directory.CreateTempSubdirectory("omsi-m123-budget-").FullName;
        string model = Path.Combine(root,"model");
        try
        {
            Directory.CreateDirectory(model);
            foreach (string name in new[]{"one.o3d","two.o3d","three.o3d"})
                File.WriteAllBytes(Path.Combine(model,name),M112Sentinel);
            int processed = 0;
            bool limited = false;
            using (var pins = AncestorPins.Pin(root))
            {
                var parent = pins.TemporaryHandle;
                if (!BoundedNativeChangeProbe.HasNtfsVolume(parent)) Deny();
                using SafeFileHandle held = OpenChildDirectory(parent,"model");
                var id = Identity(held);
                var basic = Basic(held);
                var partial = new Dictionary<string,uint>(StringComparer.Ordinal);
                try
                {
                    Inspect(parent,model,syntheticAttributes:partial,pinnedDirectory:held,syntheticEntryBudget:2);
                }
                catch (M123EntryBudgetReached stop)
                {
                    processed = stop.Count;
                    limited = true;
                }
                if (!limited || processed != 2 || partial.Count != 2) Deny();
                // Partial names/attributes are discarded, never a missing-file claim.
                partial.Clear();
                pins.Verify();
                using var reopened = OpenChildDirectory(parent,"model");
                if (!Same(id,Identity(held)) || !Same(id,Identity(reopened)) ||
                    !SameStableMetadata(basic,Basic(held)) || !SameStableMetadata(basic,Basic(reopened))) Deny();
                // Positive control: complete observation of the same fixed tree.
                int[] complete = Inspect(parent,model,pinnedDirectory:held,syntheticEntryBudget:4);
                if (complete[0] != 3 || complete[2] != 3) Deny();
                pins.Verify();
                if (!SameStableMetadata(basic,Basic(held))) Deny();
            }
            Console.WriteLine(JsonSerializer.Serialize(new {
                schema="omsi-m123-windows-entry-budget-fixture-v1",status="budget-limited",
                processedEntries=processed,entryBudget=2,controlCompleteEntries=3,
                partialResultsPublished=false,missingClaimMade=false,kernelBufferBoundProven=false,
                dependencyContentsRead=false,realModValidated=false,operationsEnabled=false
            }));
            return 0;
        }
        finally { Directory.Delete(root,true); }
    }
}
