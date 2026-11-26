# F4.01c — Linux descriptor-read laboratory

F4.01a/b Core CI 45733916085 verified 90/90 per OS, no failures, skips or cancellations. Combined Reader/Core matrix not observed on F4 draft PR #171. F1 remains blocked. No merge.

Added fixed Python Linux x86_64/aarch64 openat2 fixture, with no caller-supplied paths. Creates a private temporary tree and sibling sentinel, opens an O_PATH directory descriptor, performs handle-relative openat2 with NO_XDEV, NO_MAGICLINKS, NO_SYMLINKS and BENEATH, no fallback. Nonblocking read handle, regular-file/single-link/same-device/size checks, bounded same-handle reads, pre/post metadata and second relative lookup. Returns only case names and safety flags, no file content or paths. Removes owned temporary fixture tree after closing descriptors. Test harness enforces subprocess timeout and exact result shape.

13 expected Linux cases: nested regular file, leaf symlink, parent symlink, traversal, absolute path, hardlink, FIFO, directory, size cap, in-place mutation, replacement, parent substitution, sibling unchanged. Windows wrapper explicitly records native test not executed; does not qualify Windows. Expected Core matrix 91 tests per OS (Linux one wrapper includes 13 native observations). Combined expected 285 per OS if matrix is enabled. CI pending.

This is a controlled laboratory, not a production native helper. No proof of atomic containment across all races, ABA exclusion, mount-crossing test, device safety, root consent binding, OS principal isolation, memory/CPU enforcement, or Windows native read safety. No arbitrary real mod paths, no production wiring, no actual permissions, no merge or release. Next: Windows native fixture, and restore combined Reader matrix coverage on F4 without changing F3 or general gates.
