# M78 — local candidate inventory

Draft, stacked on M77; no merge or release. Strict Ubuntu 24.04 sandbox remains mandatory.

After native folder confirmation, the existing one-shot main-owned scan includes at most 100 display-only candidate basenames per group. OMSI: immediate child folders in Vehicles, maps, Sceneryobjects, Splines. ETS2/ATS: immediate folders and regular .scs/.zip file candidates in mod. No recursion, content reads, activation checks, installation, deletion, persistence or network transmission added. Existing 2,000-entry count and cancellation / identity checks remain; no atomic containment or ABA guarantee. Links are skipped. Unsafe labels are omitted; projection rejects forged fields or invalid counts and keeps only kind/label. UI shows observed vs listed counts, partial scan and explicit unverified compatibility. Demo catalog remains distinct; no ownership or mod/base-game classification inferred.

Validation: synthetic unit tests and existing disposable Electron IPC/UI test expanded. Real user installation not accessed by CI. No release until strict gate passes.
