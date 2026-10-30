import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateNativeX11Workflow} from './native-x11-workflow-admission.mjs';

const original=readFileSync(new URL('../../.github/workflows/react-prototype.yml',import.meta.url),'utf8');
const verify=value=>validateNativeX11Workflow(value);
test('the live workflow requires both Ubuntu images, SHA guard, X11 proof and strict sandbox',()=>{
 const result=verify(original);
 assert.deepEqual(result.requiredRunners,['ubuntu-24.04','ubuntu-22.04']);
 assert.equal(result.fullNativeX11ProofStillRequired,true);
 assert.equal(result.shaBeforeArchiveExtraction,true);
 assert.equal(result.sandboxBypassAllowed,false);
 assert.equal(result.realWindowProven,false);
 assert.ok(Object.isFrozen(result));
});
test('fails closed on missing runner, bypassed failure, removed verification and broken artifact guards',()=>{
 const variants=[
  ['runner: [ubuntu-24.04, ubuntu-22.04]','runner: [ubuntu-22.04]'],
  ['fail-fast: false','fail-fast: true'],
  ['needs: build','needs: []'],
  ['contents: read','contents: write'],
  ['sha256sum -c OMSI-Manager-Preview-Linux-x64.sha256','echo checksum-skipped'],
  ['python3 -I -S -B ../scripts/controlled_ci_archive_guard.py','echo archive-guard-skipped'],
  ['xvfb-run -a node scripts/auto-real-x11-smoke.mjs','echo real-window-check-skipped'],
  ['node scripts/native-sandbox-preflight-ci.mjs','echo preflight-skipped'],
  ['node scripts/auto-x11-host-capabilities.mjs','echo host-diagnostics-skipped']
 ];
 const start=original.indexOf('  native_auto_x11:');
 const end=original.indexOf('\n  arch_portable_audit:',start);
 assert.ok(start>=0&&end>start,'native job boundaries');
 const prefix=original.slice(0,start),job=original.slice(start,end),suffix=original.slice(end);
 for(const [from,to] of variants){
  assert.ok(job.includes(from),from);
  const modified=prefix+job.replace(from,to)+suffix;
  assert.throws(()=>verify(modified),/^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
 }
});
test('rejects masking, conditional skipping, disabling AppArmor or Chromium sandbox',()=>{
 const marker='  native_auto_x11:';
 const scripts=[
  '    continue-on-error: true',
  "    if: github.event_name == 'push'",
  '    env: ELECTRON_DISABLE_SANDBOX: 1',
  '    env: ELECTRON_NO_SANDBOX: true',
  '    run: sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0',
  '    run: sudo aa-disable /etc/apparmor.d/private',
  '    run: sudo setcap cap_sys_admin+ep some-binary',
  '    run: xvfb-run -a node scripts/auto-real-x11-smoke.mjs --no-sandbox',
  '    run: xvfb-run -a node scripts/auto-real-x11-smoke.mjs --disable-setuid-sandbox',
  '    run: node scripts/auto-real-x11-smoke.mjs || true'
 ];
 for(const injected of scripts){
  const mutant=original.replace(marker,marker+'\n'+injected);
  assert.throws(()=>verify(mutant),/^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/,injected);
 }
});
test('comments do not count as executable sandbox bypass and malformed inputs are refused',()=>{
 assert.equal(verify(original.replace('  native_auto_x11:','  native_auto_x11:\n    # Do not use --no-sandbox, ever.')).sandboxBypassAllowed,false);
 for(const invalid of [null,{},42,'',original+'\r\n',original.repeat(20)])
  assert.throws(()=>verify(invalid),/^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
});
