# M55 — No raw errors or malformed native picker responses through inspection IPC

## Concrete behavior corrected

Prior to M55, the native `dialog.showOpenDialog` call was awaited outside the
existing inner scan error handler. A portal/backend failure could therefore
reject the `ipcMain.handle('preview:inspect-game')` promise without the
application's fixed, sanitized response. Unexpected picker objects could
also trigger uncaught property access errors or be mistaken for cancellation.

The renderer must not receive provider-specific errors, private paths,
credentials, raw stderr or misleading successful cancellation statuses.

## Fail-closed implementation

- A pure `electron/native-directory-choice.cjs` wrapper catches synchronous
  throws and asynchronous rejections from the native chooser.
- A normal canceled picker returns `{status:'cancelled'}` only when it
  explicitly reports `canceled:true, filePaths:[]`.
- A valid selection requires `canceled:false`, exactly one own-data absolute
  pathname, no NUL, and bounded length. Path stays within the main process.
- Invalid/missing objects, accessor properties, unusual path arrays and all
  provider exceptions return `{status:'error', message: <fixed text>}`.
- The main IPC handler **rechecks M54 document epoch and sender authorization
  after awaiting** the picker before processing the sanitized result.
- Existing one-shot inspection grant, authorized folder checks and
  `activeInspections` cleanup remain unchanged.

## Verification

Ten adversarial unit tests in `npm run test:security` check cancellation,
native rejection, malicious objects/getters, path validation, source ordering
and no secret leaks. The real Electron IPC synthetic smoke additionally
injects a picker exception with a fake private path and a malformed picker
reply, checks fixed IPC errors, and proves that a subsequent cancellation
continues working.

These tests do not exercise an actual failed OS portal and do not certify
native compositor behavior, kernel sandboxing or Ubuntu24 compatibility.

## Release boundary

M55 stacks on Draft PR #59 (M54), keeps the production read-only preview,
and does not change the host, turn off the sandbox, install mods, edit game
data or waive the mandatory Ubuntu 24.04 strict X11 gate. Issue #4 and the
administrator-controlled A/B/A requirement remain open.
