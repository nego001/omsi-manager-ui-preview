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
  'xvfb-run -a node scripts/auto-real-x11-smoke.mjs'
 ])if(!active.includes(expected))refusal();
 const hash=active.indexOf('sha256sum -c OMSI-Manager-Preview-Linux-x64.sha256');
 const guard=active.indexOf('python3 -I -S -B ../scripts/controlled_ci_archive_guard.py');
 const extract=active.indexOf('tar --no-same-owner --no-same-permissions -xzf');
 const smoke=active.indexOf('xvfb-run -a node scripts/auto-real-x11-smoke.mjs');
 if(!(hash<guard&&guard<extract&&extract<smoke))refusal();
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
 ])if(forbidden.test(active))refusal();
 return Object.freeze({
  source:'source-text-admission-only',
  requiredRunners:['ubuntu-24.04','ubuntu-22.04'],
  shaBeforeArchiveExtraction:true,
  fullNativeX11ProofStillRequired:true,
  sandboxBypassAllowed:false,
  realWindowProven:false,
  hostPolicyChanged:false
 });
}
