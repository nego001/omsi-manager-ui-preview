# OMSI Manager: Linux desktop preview (experimental)

**Scope:** native Linux x64 Electron **read-only UI preview**, with native folder dialog and structural inspection of user-selected, synthetic or explicitly consented folders. This is **not** a completed OMSI 2/openOMSI mod manager or Proton/Wine adapter. Installation, removal, repair, writes to real mods and automatic discovery of game folders remain disabled.

## Build and test

From `react-prototype/` with Node.js 22 and supported Linux desktop libraries:

```bash
npm install --no-audit --no-fund
npm run build
npm run test:security
npm run test:witness:portable
npm run package:linux
xvfb-run -a npm run test:portable:linux
```

The CI build on Ubuntu runs this same packaged-ELF smoke test after the normal Playwright and Electron checks. The test verifies an actual Linux ELF, loads the app from `app.asar`, verifies Electron/renderer isolation and disabled operations, opens the GUI and reads **only the names/counts** from a generated dummy `Vehicles` and `maps` tree. It also verifies that the dummy .bus file is byte-for-byte unchanged and that the fixture path is not leaked to the renderer.

## Portable archive and future Arch use

When the Linux CI job is green it uploads an **unsigned** portable Linux x64 artifact containing `OMSI-Manager-Preview-Linux-x64.tar.gz` and `OMSI-Manager-Preview-Linux-x64.sha256`. Check the checksum before extracting and never run an untrusted binary with root permissions. This experimental artifact is built on Ubuntu, not Arch Linux; compatibility with Arch graphics drivers, Wayland compositors, Hyprland and Steam/Proton game prefixes has **not** been established.

```bash
sha256sum -c OMSI-Manager-Preview-Linux-x64.sha256
tar -xzf OMSI-Manager-Preview-Linux-x64.tar.gz
./OMSI-Manager-Preview-linux-x64/OMSI-Manager-Preview
```

No `pacman` package, desktop integration, systemd unit, auto-update process or application installer is delivered. Avoid `sudo`, disabling Electron's sandbox, or modifying game folders to make a preview run. If the native preview fails to launch, collect application stderr and system information in a **separate** troubleshooting step rather than bypassing security.

## Cross-platform architecture and remaining work

- UI and Electron security policy are shared between Windows/Linux; the renderer cannot execute shell commands or write mods.
- The existing game-directory inspection only counts structural folder entries and selected file extensions; a successful scan does not establish mod compatibility.
- Win32 handles, NTFS timestamps, C# directory observer and PowerShell fault injectors are **Windows-only laboratory components**, excluded from packaged Electron builds.
- Next candidates: Linux permission isolation and symlink/race hardening for production design, non-mutating discovery of Proton/openOMSI folders only with explicit consent, Hyprland/Wayland smoke tests, and proper package/release provenance.
- Real mod operations remain blocked by `operationsEnabled:false`, `supportsRealGameInspection:false`, `guaranteesNoABA:false`, and `atomicPathContainmentProven:false`.

Keep the pull request in draft; nothing in this document authorizes merging or touching an installed game.
