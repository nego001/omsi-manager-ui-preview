'use strict';
// M54: in-memory, main-process-only document continuity for native folder IPC.
// An opaque proof belongs to one specific navigation epoch, not to a pathname,
// renderer-controlled token, URL or process ID.
function createDocumentEpochGate() {
  let current = Object.freeze({});
  let revoked = false;
  function snapshot() { return revoked ? null : current; }
  function isCurrent(proof) { return !revoked && proof !== null && proof === current; }
  function invalidate() {
    if (revoked) return false;
    current = Object.freeze({});
    return true;
  }
  function revoke() {
    revoked = true;
    current = null;
  }
  return Object.freeze({snapshot,isCurrent,invalidate,revoke});
}
// Electron 38 provides a navigation details Event with these two booleans.
// Missing/malformed evidence is treated as a document change, never as consent.
function shouldInvalidateOnNavigation(details) {
  if (!details || typeof details.isMainFrame !== 'boolean' ||
      typeof details.isSameDocument !== 'boolean') return true;
  return details.isMainFrame && !details.isSameDocument;
}
module.exports = {createDocumentEpochGate,shouldInvalidateOnNavigation};
