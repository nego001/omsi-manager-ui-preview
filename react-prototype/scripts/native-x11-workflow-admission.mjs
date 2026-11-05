// Review only the CI workflow text. This cannot grant release status,
// execute Electron, modify kernel policy or certify a real X11 window.
const refusal=()=>{throw Error('NATIVE_X11_WORKFLOW_GUARD_REFUSED');};
export function validateNativeX11Workflow(source){
 if(typeof source!=='string'||source.length>200000||source.includes('\r'))refusal();
 const lines=source.split('\n');
 const start=lines.indexOf('  native_auto_x11:');
 if(start<0||lines.indexOf('  native_auto_x11:',start+1)!==-1)refusal();
 let stop=lines.findIndex((line,i)=>i>start&&/^  [a-z][a-z0-9_]*:$/.test(line));
 if(stop<0)stop=lines.length;
 const job=lines.slice(start,stop).join('\n');
 const buildStart=lines.indexOf('  build:');
 if(buildStart<0||buildStart>=start)refusal();
 const build=lines.slice(buildStart,start).filter(line=>!line.trimStart().startsWith('#')).join('\n');
 // Ubuntu 22.04 is the known working strict native sandbox baseline.
 // Ubuntu 24.04 must remain in the mandatory X11 matrix and must NOT
 // be dismissed by a successful build on the less restrictive host.
 const buildRunners=build.split('\n').filter(l=>/^    runs-on:/.test(l));
 if(buildRunners.length!==1||buildRunners[0]!=='    runs-on: ubuntu-22.04')
  refusal();
 if(!build.includes('name: Test packaged Linux ELF GUI using synthetic game folder')||
    !build.includes('run: xvfb-run -a npm run test:portable:linux')||
    !build.includes('name: Native Wayland packaged GUI smoke in disposable Weston')||
    !build.includes('run: npm run test:wayland:headless')||
    !build.includes('node --test scripts/weston-9-headless-contract.test.mjs'))refusal();
 // Require the exact synthetic contract in the upstream build and both X11 runners.
 if(!build.includes('name: AppArmor administrator review classification (synthetic data only)')||
    !build.includes('node --test scripts/ubuntu24-app-profile-review.test.mjs')||
    !build.includes('node --test scripts/auto-x11-archive-provenance.test.mjs')||
    !build.includes('node --test scripts/auto-x11-sanitized-evidence.test.mjs')||
    !build.includes('node --test scripts/electron-renderer-kernel-evidence.test.mjs')||
    !build.includes('node --test scripts/auto-x11-evidence-diff.test.mjs')||
    !build.includes('node --test scripts/ubuntu24-controlled-pilot-compare.test.mjs')||
    !build.includes('node --test scripts/ubuntu24-controlled-pilot-aba.test.mjs'))refusal();
 // Only operative workflow lines matter; comments are not executed.
 const active=job.split('\n').filter(line=>!line.trimStart().startsWith('#')).join('\n');
 for(const expected of [
  'needs: build',
  'fail-fast: false',
  'runner: [ubuntu-24.04, ubuntu-22.04]',
  'runs-on: ${{ matrix.runner }}',
  'contents: read',
  'name: OMSI-Manager-Preview-Linux-x64-UNSIGNED',
  'sha256sum -c OMSI-Manager-Preview-Linux-x64.sha256',
  'python3 -I -S -B ../scripts/controlled_ci_archive_guard.py',
  'tar --no-same-owner --no-same-permissions -xzf OMSI-Manager-Preview-Linux-x64.tar.gz',
  'node scripts/native-sandbox-preflight-ci.mjs',
  'node scripts/auto-x11-host-capabilities.mjs',
  'node --test scripts/auto-x11-native-triage.test.mjs',
  'node --test scripts/auto-x11-archive-provenance.test.mjs',
  'node --test scripts/auto-x11-sanitized-evidence.test.mjs',
  'OMSI_NATIVE_X11_RUNNER: ${{ matrix.runner }}',
  'name: native-x11-evidence-${{ matrix.runner }}',
  'path: react-prototype/test-results/native-auto-x11/host-evidence.json',
  'node --test scripts/ubuntu24-app-profile-review.test.mjs',
  'xvfb-run -a node scripts/auto-real-x11-smoke.mjs'
 ])if(!active.includes(expected))refusal();
 const hash=active.indexOf('sha256sum -c OMSI-Manager-Preview-Linux-x64.sha256');
 const guard=active.indexOf('python3 -I -S -B ../scripts/controlled_ci_archive_guard.py');
 const extract=active.indexOf('tar --no-same-owner --no-same-permissions -xzf');
 const smoke=active.indexOf('xvfb-run -a node scripts/auto-real-x11-smoke.mjs');
 const evidenceTest=active.indexOf('node --test scripts/auto-x11-sanitized-evidence.test.mjs');
 const evidenceUpload=active.indexOf('name: native-x11-evidence-${{ matrix.runner }}');
 const policyReview=active.indexOf('node --test scripts/ubuntu24-app-profile-review.test.mjs');
 const policyHints=active.indexOf('node scripts/auto-x11-host-capabilities.mjs');
 if(!(hash<guard&&guard<extract&&extract<evidenceTest&&
   evidenceTest<policyReview&&policyReview<policyHints&&
   policyHints<smoke&&smoke<evidenceUpload))refusal();
 // The sole allowed conditional is an unconditional forensic upload after
 // the blocking native test. Any added or moved conditional is refused.
 const evidenceStep=[
  '      - name: Upload sanitized native X11 evidence, even on strict-sandbox failure',
  '        if: always()',
  '        uses: actions/upload-artifact@v4',
  '        with:',
  '          name: native-x11-evidence-${{ matrix.runner }}',
  '          path: react-prototype/test-results/native-auto-x11/host-evidence.json',
  '          if-no-files-found: warn',
  '          retention-days: 14'
 ].join('\n');
 if(active.split(evidenceStep).length!==2)refusal();
 const withoutApprovedUpload=active.replace(evidenceStep,'');
 // A separate post-matrix report may run after a red native job, but it may
 // not replace the native test or change its conclusion.
 const compareStart=lines.indexOf('  native_x11_evidence_compare:');
 const compareEnd=lines.findIndex((line,i)=>i>compareStart&&/^  [a-z][a-z0-9_]*:$/.test(line));
 if(compareStart<=start||compareEnd<=compareStart||
    lines.indexOf('  native_x11_evidence_compare:',compareStart+1)!==-1)refusal();
 const compareActive=lines.slice(compareStart,compareEnd)
  .filter(line=>!line.trimStart().startsWith('#')).join('\n');
 for(const required of [
  'needs: [build, native_auto_x11]',
  'if: ${{ always() }}',
  'runs-on: ubuntu-24.04',
  'contents: read',
  'node --test react-prototype/scripts/auto-x11-evidence-diff.test.mjs',
  'name: native-x11-evidence-ubuntu-22.04',
  'name: native-x11-evidence-ubuntu-24.04',
  'node react-prototype/scripts/auto-x11-evidence-diff-ci.mjs',
  'name: native-x11-cross-runner-comparison',
  'path: x11-diff-output/host-comparison.json',
  'if-no-files-found: error'
 ])if(!compareActive.includes(required))refusal();
 if(compareActive.split('if: ${{ always() }}').length!==2||
    /\bcontinue-on-error\s*:/i.test(compareActive)||
    /--no-sandbox|ELECTRON_DISABLE_SANDBOX/i.test(compareActive)||
    compareActive.split(/\n\s+if\s*:/).length!==2)refusal();
 for(const forbidden of [
  /\bcontinue-on-error\s*:/i,
  /^\s+if\s*:/m,
  /\|\|\s*true\b/,
  /--no-sandbox\b/i,
  /--disable-setuid-sandbox\b/i,
  /\bELECTRON_(?:DISABLE|NO)_SANDBOX\b/i,
  /\bsysctl\s+(?:-w|--write)\b/i,
  /\b(?:aa-complain|aa-disable|apparmor_parser|setcap)\b/i,
  /\b(?:chmod\s+(?:4755|u\+s)|chown\s+root)\b/i
 ])if(forbidden.test(withoutApprovedUpload))refusal();
 return Object.freeze({
  source:'source-text-admission-only',
  requiredRunners:['ubuntu-24.04','ubuntu-22.04'],
  strictSandboxBuildRunner:'ubuntu-22.04',
  separateUbuntu24NativeGateRequired:true,
  shaBeforeArchiveExtraction:true,
  fullNativeX11ProofStillRequired:true,
  apparmorReviewContractRequired:true,
  sanitizedEvidenceRequired:true,
  crossRunnerComparisonRequired:true,
  archiveSha256ProvenanceContractRequired:true,
  realPackagedRendererKernelContractRequired:true,
  adminPilotComparisonContractRequired:true,
  abaRollbackComparisonContractRequired:true,
  sandboxBypassAllowed:false,
  realWindowProven:false,
  hostPolicyChanged:false
 });
}
