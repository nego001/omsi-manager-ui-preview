# F4.02c.2 — native Linux CPU time limits

F4.02b.8 combined CI 45738485370: 319/319 both OS, all six bindings against checkout 1cb16903bf4b19f1c480c0fbbc06abd6a453ff3e. Independent Core 45738485460: Linux 125/125 with matching two bindings; Windows 124/125 with three matching bindings, descendant observation missing due to unexpected-active-count:0 diagnostic (the trailing zero is Win32 last-error, not actual active count). Do not close experimental memory qualification. Linux CPU accounting passed 130/130 at 45738662338; Windows pending at inspection.

Windows descendant experiment now requires exact count one, allowing at most two seconds of convergence from count two only after owned child exit, not before admission or during live-child controls. Phase and actual count are included in failure diagnostics. This addresses a possible accounting lag, not a confirmed root cause. No relaxation of count, membership or refusal controls. CI pending.

Linux disposable RLIMIT_CPU experiment creates fixed subprocesses for positive controls and separate soft/hard limit observations. Sets and reads back soft 1 s / hard 2 s CPU time. Soft case must signal SIGXCPU and exit with sentinel 77; hard case ignores soft signal and must terminate with SIGKILL. Independent 12 s wall timeout per child and 3 CPU-second fallback bound in busy loop; no global limits changed. Positive controls before and after. This is CPU time, not percentage throttling, process-tree accounting or native Reader integration. One new wrapper; expected 325 combined / 131 Core per OS. CI pending.

Next verify Windows regression correction and Linux native CPU result, then native Windows CPU time experiment. cgroup delegation, operational isolation, F1 and real read permission remain blocked. No merge/release.
