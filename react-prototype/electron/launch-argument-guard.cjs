'use strict';

// M52: fail closed on known insecure Chromium/Electron command-line switches
// before OMSI Manager creates any BrowserWindow or registers an IPC handler.
// This only runs after Electron has loaded this main-process script. It cannot
// protect a user who bypasses application JS entirely or change host policy.
const BLOCKED_SWITCHES = Object.freeze([
  'no-sandbox',
  'disable-setuid-sandbox',
  'disable-seccomp-filter-sandbox',
  'disable-gpu-sandbox',
  'disable-web-security',
  'allow-running-insecure-content',
  'ignore-certificate-errors',
  'disable-site-isolation-trials',
  'single-process',
  'no-zygote'
]);

const DENIED = 'OMSI_MANAGER_UNSAFE_ELECTRON_STARTUP';
const blocked = new Set(BLOCKED_SWITCHES);
function refuse() { throw new Error(DENIED); }

function assertSecureMainProcessStartup(argv, electronCommandLine) {
  if (!Array.isArray(argv) || argv.length > 256 ||
      !electronCommandLine || typeof electronCommandLine.hasSwitch !== 'function') {
    refuse();
  }
  // No argument is logged, even on malformed or hostile input. Check every
  // positional argument; unsafe Chromium switches may appear after a path.
  for (const arg of argv) {
    if (typeof arg !== 'string' || arg.length > 8192 ||
        arg.includes('\0') || arg.includes('\r') || arg.includes('\n')) {
      refuse();
    }
    if (!arg.startsWith('--')) continue;
    const separator = arg.indexOf('=');
    const flag = (separator === -1 ? arg.slice(2) : arg.slice(2, separator))
      .toLowerCase();
    if (blocked.has(flag)) refuse();
  }
  // Electron may normalize switches separately from process.argv; reject
  // either representation. Never trust an externally provided hasSwitch
  // implementation to "certify" sandboxing; this is refusal-only.
  for (const name of BLOCKED_SWITCHES) {
    let present;
    try { present = electronCommandLine.hasSwitch(name); }
    catch { refuse(); }
    if (typeof present !== 'boolean' || present) refuse();
  }
  return true;
}

module.exports = {
  BLOCKED_SWITCHES,
  DENIED,
  assertSecureMainProcessStartup
};
