import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSanitizedX11Evidence as evidence}
 from './auto-x11-sanitized-evidence.mjs';
import {compareSanitizedX11Records as compare}
 from './auto-x11-evidence-diff.mjs';
import {categorizeEarlyNativeSecurity as early}
 from './auto-x11-early-native-kernel.mjs';
import {createX11AdminHandoff,renderX11AdminHandoffMarkdown}
 from './auto-x11-admin-handoff.mjs';
import {verifyX11HandoffOutputs as verify}
 from './auto-x11-handoff-output-integrity.mjs';

const hash='a'.repeat(64);
const kernel=early('Name:\tOMSI\nState:\tS\nSeccomp:\t0\nNoNewPrivs:\t0\n','unconfined\n');
function buildRecord(runner,mapped){
 return evidence({runner,archiveSha256:hash,baselineMapped:true,
  host:{apparmorModuleState:'enabled',
   apparmorRestriction:mapped?'disabled':'enabled',
   userNamespaceProbe:mapped?'allowed':'permission-denied'},
  outcomes:['GNOME','KDE'].map(desktop=>({
   desktop,mapped,failed:!mapped,windowOwned:mapped,nativeProcess:true,
   triageClassification:mapped?'native-auto-window-mapped':
    'shared-electron-sandbox-startup-suspected',
   earlyNativeKernel:kernel,identityCaptureSource:'polling',
   directControlCategory:mapped?'not-run':'sigtrap-cmdline-spawn'
  }))
 });
}
const comparison=compare(buildRecord('ubuntu-22.04',true),
 buildRecord('ubuntu-24.04',false));
const exact=()=>({
 comparisonJson:JSON.stringify(comparison)+'\n',
 handoffJson:JSON.stringify(createX11AdminHandoff(comparison))+'\n',
 handoffMarkdown:renderX11AdminHandoffMarkdown(comparison)
});
const refused=/^Error: AUTO_X11_HANDOFF_OUTPUT_REFUSED$/;
test('exact same-comparison JSON and Markdown can pass without release claims',()=>{
 const report=verify(comparison,exact());
 assert.equal(report.schema,'AUTO_X11_HANDOFF_OUTPUT_INTEGRITY_V1');
 assert.equal(report.allThreeExactAgainstCurrentComparison,true);
 for(const name of ['rendererSandboxCertified','packageSignatureVerified',
  'nativeWindowRequirementWaived','fullReleaseAuthorized','hostPolicyChanged'])
  assert.equal(report[name],false);
 assert.ok(Object.isFrozen(report));
 assert.equal(JSON.stringify(report).includes(hash),false);
});
test('refuse missing, extra, non-string, oversized and invalid output files',()=>{
 const source=exact();
 for(const changed of [
  null,{},[],false,
  {...source,extra:'secret'},
  {...source,comparisonJson:undefined},
  {...source,handoffJson:null},
  {...source,handoffMarkdown:''},
  {...source,handoffMarkdown:'x'.repeat(8193)}
 ])assert.throws(()=>verify(comparison,changed),refused);
});
test('refuse changed flags, altered pending evidence or changed Markdown bytes',()=>{
 const source=exact();
 for(const changed of [
  {...source,comparisonJson:source.comparisonJson.replace(
   '"electronSandboxCertified":false','"electronSandboxCertified":true')},
  {...source,handoffJson:source.handoffJson.replace(
   '"fullReleaseAuthorized":false','"fullReleaseAuthorized":true')},
  {...source,handoffJson:source.handoffJson.replace(
   '"ubuntu24-window-blocked",','')},
  {...source,handoffMarkdown:source.handoffMarkdown.replace(
   'A janela nativa Ubuntu 24.04 permanece bloqueada.','Aprovado.')},
  {...source,handoffMarkdown:source.handoffMarkdown.replaceAll('\n','\r\n')},
  {...source,handoffMarkdown:source.handoffMarkdown+'\n'}
 ])assert.throws(()=>verify(comparison,changed),refused);
});
test('refuse stale but self-consistent artifacts belonging to a different comparison',()=>{
 const source=exact();
 const alternate={...comparison,archiveSha256:'b'.repeat(64)};
 assert.throws(()=>verify(alternate,source),refused);
 assert.throws(()=>verify({...comparison,fullReleaseAuthorized:true},source),refused);
});
