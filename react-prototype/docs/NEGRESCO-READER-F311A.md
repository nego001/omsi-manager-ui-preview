# F3.11a — controlled Core/Reader fixture adapter

F3.10 Reader CI 45731388635: 259/259 per OS, no failures, skips or cancellations. F3.10 closes as a synthetic subset milestone. F1 packaged Linux gate remains open.

The bridge accepts explicit synthetic byte buffers, copies before asynchronous queue dispatch, enforces bounded input and report sizes, single-flight and lifetime job count, and uses actual F2 Core budget, queue, snapshot and projection contracts. Logical preflight reserves declared maximum reference/finding work and charges input bytes, entries and depth. Cooperative checkpoints before and after fusion are not CPU/memory isolation or preemptive cancellation. Cancellation before worker dispatch, failure or budget refusal suppresses the report. Reader fusion is recomputed internally, never accepted as caller evidence.

Core source digest binds the graph input. All seven Core modules are conservatively incomplete and no game identity is fabricated; fixture-incomplete gate prevents probable/publishable status. Four sector projections share the exact snapshot identity and deny operations. The bridge returns source-bound diagnostic evidence only, with report digest, no cache eligibility, database persistence, production IPC, security authorization or real reads. Existing F2 publication pipeline is unchanged; integration is a separate fixture adapter, not application runtime wiring.

Seven new tests; expected 266 per OS, CI pending. Next F3.11b: tighten boundary and diagnostic projection contracts, cancellation and resource regression cases; retain prohibition on real operations and publishing incomplete evidence. No merge or release.
