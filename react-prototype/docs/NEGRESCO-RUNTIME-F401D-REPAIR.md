# F4.01d — native Windows repair candidate

CI 45735184102: Linux 92/92 and 13/13 native cases; Windows 91/92, native fixture returned exit 3 with generic refusal. Root cause not yet established.

Repair adds fixed-stage/check diagnostics (including numeric NTSTATUS on native relative open) without emitting raw exception messages, paths, content or file IDs. Directory opens explicitly request traverse access. Mutation cases now require successful execution of the mutation barrier, so an earlier open refusal cannot be counted as detection. Mutation exceptions remain failures. All original 13 expected cases and fail-closed outcome retained; no security reductions.

Added separate F4 combined Reader/Core workflow for PR #171 targeting the F3 checkpoint, Windows and Ubuntu matrix, fail-fast false, read-only contents permission. Existing Core and general workflows unchanged. Expected 286 combined and 92 Core-only contracts per OS, plus 13 native observations on each corresponding host. CI pending. Do not qualify Windows or F4.01 until evidence is confirmed. No real mod reads, production changes, F1 waiver, merge or release.
