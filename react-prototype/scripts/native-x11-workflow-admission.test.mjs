import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateNativeX11Workflow} from './native-x11-workflow-admission.mjs';

const original=readFileSync(new URL('../../.github/workflows/react-prototype.yml',import.meta.url),'utf8');
const verify=value=>validateNativeX11Workflow(value);
test('the live workflow requires both Ubuntu images, SHA guard, X11 proof and strict sandbox',()=>{
 const result=verify(original);
 assert.deepEqual(result.requiredRunners,['ubuntu-24.04','ubuntu-22.04']);
 assert.equal(result.strictSandboxBuildRunner,'ubuntu-22.04');
 assert.equal(result.separateUbuntu24NativeGateRequired,true);
 assert.equal(result.fullNativeX11ProofStillRequired,true);
 assert.equal(result.apparmorReviewContractRequired,true);
 assert.equal(result.sanitizedEvidenceRequired,true);
 assert.equal(result.crossRunnerComparisonRequired,true);
 assert.equal(result.archiveSha256ProvenanceContractRequired,true);
 assert.equal(result.realPackagedRendererKernelContractRequired,true);
 assert.equal(result.adminPilotComparisonContractRequired,true);
 assert.equal(result.abaRollbackComparisonContractRequired,true);
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
  ['node scripts/auto-x11-host-capabilities.mjs','echo host-diagnostics-skipped'],
  ['node --test scripts/ubuntu24-app-profile-review.test.mjs','echo policy-review-skipped'],
  ['node --test scripts/auto-x11-archive-provenance.test.mjs','echo sha-contract-skipped'],
  ['node --test scripts/auto-x11-sanitized-evidence.test.mjs','echo evidence-validation-skipped']
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

test('requires the policy review contract in build and rejects late or missing X11 review',()=>{
 const buildStep='      - name: AppArmor administrator review classification (synthetic data only)\n        run: node --test scripts/ubuntu24-app-profile-review.test.mjs';
 assert.ok(original.includes(buildStep));
 assert.throws(()=>verify(original.replace(buildStep,'      - name: policy-review-removed\n        run: echo omitted')),
  /^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
 const pilotStep='      - name: Controlled Ubuntu 24.04 administrator pilot comparison (synthetic only)\n        run: node --test scripts/ubuntu24-controlled-pilot-compare.test.mjs';
 assert.ok(original.includes(pilotStep));
 assert.throws(()=>verify(original.replace(pilotStep,
  '      - name: pilot-contract-skipped\n        run: echo skipped')),
  /^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
 const abaStep='      - name: Controlled Ubuntu 24.04 A-B-A rollback comparison (synthetic only)\n        run: node --test scripts/ubuntu24-controlled-pilot-aba.test.mjs';
 assert.ok(original.includes(abaStep));
 assert.throws(()=>verify(original.replace(abaStep,'      - name: skipped-rollback\n        run: echo skipped')),
  /^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
 const kernelContract='      - name: Packaged renderer kernel evidence parser contracts (synthetic only)\n        run: node --test scripts/electron-renderer-kernel-evidence.test.mjs';
 assert.ok(original.includes(kernelContract));
 assert.throws(()=>verify(original.replace(kernelContract,
  '      - name: removed kernel test\n        run: echo skipped')),
  /^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
 const reviewLine='          node --test scripts/ubuntu24-app-profile-review.test.mjs';
 const hostLine='          node scripts/auto-x11-host-capabilities.mjs';
 assert.ok(original.includes(reviewLine+'\n'+hostLine));
 assert.throws(()=>verify(original.replace(reviewLine+'\n'+hostLine,hostLine+'\n'+reviewLine)),
  /^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
});

test('refuses missing or repointed sanitized evidence upload after a failed native run',()=>{
 const edits=[
  ['name: native-x11-evidence-${{ matrix.runner }}','name: evidence-hidden'],
  ['path: react-prototype/test-results/native-auto-x11/host-evidence.json',
   'path: react-prototype/test-results/screenshots/'],
  ['OMSI_NATIVE_X11_RUNNER: ${{ matrix.runner }}','OMSI_NATIVE_X11_RUNNER: arbitrary']
 ];
 for(const [oldText,newText] of edits){
  assert.ok(original.includes(oldText));
  assert.throws(()=>verify(original.replace(oldText,newText)),
   /^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
 }
});

test('only the exact post-failure evidence upload may use if: always()',()=>{
 const marker='      - name: Upload sanitized native X11 evidence, even on strict-sandbox failure';
 assert.ok(original.includes(marker));
 for(const modification of [
  original.replace(marker+'\n        if: always()',marker+'\n        if: success()'),
  original.replace(marker+'\n        if: always()',marker+'\n        if: failure()'),
  original.replace(marker+'\n        if: always()\n        uses: actions/upload-artifact@v4\n        with:\n          name: native-x11-evidence-${{ matrix.runner }}\n          path: react-prototype/test-results/native-auto-x11/host-evidence.json\n          if-no-files-found: warn',
   marker+'\n        if: always()\n        uses: actions/upload-artifact@v4\n        with:\n          name: native-x11-evidence-${{ matrix.runner }}\n          path: react-prototype/test-results/native-auto-x11/host-evidence.json\n          if-no-files-found: ignore'),
  original.replace('          name: native-x11-evidence-${{ matrix.runner }}\n          path: react-prototype/test-results/native-auto-x11/host-evidence.json\n          if-no-files-found: warn\n          retention-days: 14',
   '          name: native-x11-evidence-${{ matrix.runner }}\n          path: react-prototype/test-results/native-auto-x11/host-evidence.json\n          if-no-files-found: warn\n          retention-days: 365'),
  original.replace('  native_auto_x11:','  native_auto_x11:\n    if: always()'),
  original.replace('  native_auto_x11:','  native_auto_x11:\n    continue-on-error: true')
 ])assert.throws(()=>verify(modification),/^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
});

test('cross-runner comparison stays required without suppressing failing X11 job',()=>{
 const replacements=[
  ['  native_x11_evidence_compare:','  optional_x11_compare:'],
  ['needs: [build, native_auto_x11]','needs: [build]'],
  ['if: ${{ always() }}','if: ${{ success() }}'],
  ['name: native-x11-evidence-ubuntu-24.04','name: skipped-ubuntu24'],
  ['name: native-x11-evidence-ubuntu-22.04','name: skipped-ubuntu22'],
  ['node react-prototype/scripts/auto-x11-evidence-diff-ci.mjs','echo diff-skipped'],
  ['name: native-x11-cross-runner-comparison','name: report-suppressed']
 ];
 for(const [from,to] of replacements){
  assert.ok(original.includes(from),from);
  assert.throws(()=>verify(original.replace(from,to)),
   /^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
 }
 assert.throws(()=>verify(original.replace(
  '  native_x11_evidence_compare:',
  '  native_x11_evidence_compare:\n    continue-on-error: true')),
  /^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
});


test('Weston 9 CLI compatibility test stays mandatory before Wayland smoke',()=>{
 const contract='      - name: Weston 9 headless CLI compatibility and injection contracts\n        run: node --test scripts/weston-9-headless-contract.test.mjs';
 const wayland='      - name: Native Wayland packaged GUI smoke in disposable Weston';
 assert.ok(original.includes(contract));
 assert.ok(original.indexOf(contract)<original.indexOf(wayland));
 assert.throws(()=>verify(original.replace(contract,'      - name: CLI-test-removed\n        run: echo omitted')),
  /^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
});

test('build and strict packaged X11/Wayland smoke stay on Ubuntu 22.04',()=>{
 const variations=[
  original.replace('  build:\n    runs-on: ubuntu-22.04',
   '  build:\n    runs-on: ubuntu-latest'),
  original.replace('  build:\n    runs-on: ubuntu-22.04',
   '  build:\n    runs-on: ubuntu-24.04'),
  original.replace('  build:\n    runs-on: ubuntu-22.04',
   '  build:\n    runs-on: ubuntu-22.04\n    runs-on: ubuntu-24.04'),
  original.replace('run: xvfb-run -a npm run test:portable:linux','run: echo skipped'),
  original.replace('run: npm run test:wayland:headless','run: echo skipped')
 ];
 for(const changed of variations){
  assert.notEqual(changed,original);
  assert.throws(()=>verify(changed),/^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
 }
});

test('early native kernel witness remains mandatory on build and strict matrix',()=>{
 const cmd='node --test scripts/auto-x11-early-native-kernel.test.mjs';
 const matches=original.split(cmd).length-1;
 assert.equal(matches,2);
 const replacedFirst=original.replace(cmd,'echo early-kernel-contract-removed');
 assert.throws(()=>verify(replacedFirst),/^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
 const split=original.split(cmd);
 const replacedSecond=split[0]+cmd+split[1]+'echo early-kernel-contract-removed'+split[2];
 assert.throws(()=>verify(replacedSecond),/^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
});

test('spawn-edge witness tests stay mandatory for both build and native matrix',()=>{
 const cmd='node --test scripts/auto-x11-spawn-witness.test.mjs';
 assert.equal(original.split(cmd).length-1,2);
 const variants=[
  original.replace(cmd,'echo spawn-witness-contract-omitted'),
  original.replace('          '+cmd,
   '          echo spawn-witness-contract-omitted')
 ];
 for(const changed of variants){
  assert.notEqual(changed,original);
  assert.throws(()=>verify(changed),
   /^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
 }
});

test('operator handoff tests and artifact upload stay mandatory in guarded workflow',()=>{
 const snippets=[
  'node --test scripts/auto-x11-admin-handoff.test.mjs',
  'node --test react-prototype/scripts/auto-x11-admin-handoff.test.mjs',
  'name: native-x11-administrator-handoff',
  'x11-diff-output/admin-handoff.json',
  'x11-diff-output/admin-handoff.md'
 ];
 for(const snippet of snippets){
  assert.ok(original.includes(snippet));
  assert.throws(()=>verify(original.replace(snippet,'echo omitted')),
   /^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
 }
});

test('cross-runner output parity tests must remain in build and comparison jobs',()=>{
 const build='node --test scripts/auto-x11-handoff-output-integrity.test.mjs';
 const compare='node --test react-prototype/scripts/auto-x11-handoff-output-integrity.test.mjs';
 assert.ok(original.includes(build));
 assert.ok(original.includes(compare));
 for(const cmd of [build,compare]){
  assert.throws(()=>verify(original.replace(cmd,'echo parity-check-skipped')),
   /^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
 }
});

test('fresh exclusive output directory contracts cannot be skipped in build or compare',()=>{
 const commands=[
  'node --test scripts/auto-x11-output-directory.test.mjs',
  'node --test react-prototype/scripts/auto-x11-output-directory.test.mjs'
 ];
 for(const command of commands){
  assert.ok(original.includes(command));
  assert.throws(()=>verify(original.replace(command,'echo output-safety-omitted')),
   /^Error: NATIVE_X11_WORKFLOW_GUARD_REFUSED$/);
 }
});
