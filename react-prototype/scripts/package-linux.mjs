import {resolve,join} from 'node:path';
import {writeFile,chmod,copyFile,constants} from 'node:fs/promises';
import {packager} from '@electron/packager';

// Read-only Linux desktop preview. This is not a service, installer, Wine/
// Proton integration or an authorisation to modify any game installation.
if(process.platform!=='linux')throw new Error('Linux package requires Linux host');
const root=resolve('.');
const bundled=await packager({
 dir:root,
 name:'OMSI-Manager-Preview',
 platform:'linux',
 arch:'x64',
 out:resolve('release'),
 overwrite:true,
 prune:true,
 asar:true,
 ignore:[
  /[/\\](tests|examples|scripts|native-lab|test-results|playwright-report|release)([/\\]|$)/,
  /[/\\](\.git|\.github)([/\\]|$)/
 ]
});
if(bundled.length!==1)throw new Error('Expected exactly one Linux portable package');
// A relocatable, opt-in Wayland launcher. Default follows Electron's runtime
// selection, without disabling its sandbox or requiring root privileges.
// No systemd unit, desktop registration or game-folder discovery is created.
const script=join(bundled[0],'OMSI-Manager-Preview.sh');
const launcher=[
 '#!/bin/sh',
 'set -eu',
 'DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)',
 'if [ "${OMSI_MANAGER_NATIVE_WAYLAND:-0}" = "1" ]; then',
 '  exec "$DIR/OMSI-Manager-Preview" --ozone-platform=wayland "$@"',
 'fi',
 'exec "$DIR/OMSI-Manager-Preview" "$@"',
 ''
].join('\n');
await writeFile(script,launcher,{mode:0o755,flag:'wx'});
await chmod(script,0o755);
// Optional per-user XDG shortcut helper. The helper is copied alongside
// the ELF (not inside app.asar) and is NEVER executed during packaging.
await copyFile(resolve('scripts/linux-desktop-integration.cjs'),
 join(bundled[0],'OMSI-Manager-Desktop-Integration.cjs'),constants.COPYFILE_EXCL);
console.log('Linux read-only preview created at:',bundled[0]);
