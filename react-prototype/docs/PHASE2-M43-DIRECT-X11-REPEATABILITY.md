# Phase 2 / M43 — Three independent X11 launch observations

M41 observed a mapped, process-owned window on Ubuntu 22.04, but the following M42 run did not reproduce the window. M42 also established a difference between read-only user namespace categories: Ubuntu 22.04 allows unshare; Ubuntu 24.04 rejects it while AppArmor userns restriction is active. Ubuntu 24.04's direct launch produced SIGTRAP without a verified window. These facts do not prove a causal explanation.

M43 launches the unchanged CI packaged Electron three additional times per image in the existing disposable GitHub Actions runner. Each run gets a fresh home directory and a 7.5 second timeout, with an owned X11 window witness checking title, _NET_WM_PID and mapping. No strace, root Electron, --no-sandbox, policy writes, sysctl modifications, screenshot or game folders.

Reports contain exactly three categorical attempts per host. The independent comparator validates fixed schemas and refuses absent or tampered evidence. A 1/3 or 2/3 mapped window count is limited evidence of intermittent observation, not a success rate estimate. Three SIGTRAP exits on Ubuntu 24.04 would indicate repetition, not AppArmor causality.

The native_auto_x11 strict Ubuntu 24.04 gate is unchanged, still blocking merges. Neither a mapped window nor a host namespace probe certifies the Chromium renderer sandbox. Issue #4 continues to require administrator-approved VM policy testing and independent confinement evidence. No mods or releases are authorized.