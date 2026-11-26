# F3.08c — repair, not a gate waiver

Reader CI 45724671884 failed both Ubuntu 22.04 and Windows: 225 tests per OS, two failures (OMSI sound directive test and dependent sound graph test). Both originate from the fixture's legitimate [3d] directive being refused by a letter-leading tag regex. Inspection also found the loopsound path is on line 9, not 10.

Fix: explicitly recognize [3d] as opaque metadata; do not interpret its spatial values or broaden arbitrary numeric-leading tags. Preserve existing path validation and synthetic-only authorization. Correct the expected physical source line and add one regression that asserts spatial values are not treated as audio references and malformed numeric tags remain refused.

Expected matrix after repair: 226 tests per OS. New CI evidence is required before closing F3.08 or implementing F3.09. General application CI failed independently; packaged Linux F1 gate remains open. No real inputs, merge, release or authorization changes.
