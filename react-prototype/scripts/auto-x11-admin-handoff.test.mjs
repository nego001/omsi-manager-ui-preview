import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createX11AdminHandoff as handoff,
 renderX11AdminHandoffMarkdown as markdown}
 from './auto-x11-admin-handoff.mjs';
import {createSanitizedX11Evidence as create}
 from './auto-x11-sanitized-evidence.mjs';
import {compareSanitizedX11Records as compare}
 from './auto-x11-evidence-diff.mjs';
import {categorizeEarlyNativeSecurity as early}
 from './auto-x11-early-native-kernel.mjs';
const sha='a'.repeat(64);
const snapshot=early('Name:\tOMSI\nState:\tS\nSeccomp:\t0\nNoNewPrivs:\t0\n','unconfined\n');
const runner=(runner,success,options={})=>create({
 runner,archiveSha256:sha,baselineMapped:true,
 host:{apparmorModuleState:'enabled',
  apparmorRestriction:runner==='ubuntu-22.04'?'disabled':'enabled',
  userNamespaceProbe:runner==='ubuntu-22.04'?'allowed':'permission-denied'},
 outcomes:['GNOME','KDE'].map((desktop,index)=>{
  const missing=options.missingAll===true||
   (options.missingKde===true&&index===1);
  return {desktop,mapped:success,failed:!success,
   windowOwned:success,nativeProcess:!missing,
   triageClassification:success?'native-auto-window-mapped':
    missing?'shared-native-electron-startup-undetermined':
     'shared-electron-sandbox-startup-suspected',
   earlyNativeKernel:missing?early(null,null):snapshot,
   identityCaptureSource:missing?'unobserved':'polling',
   directControlCategory:success?'not-run':'sigtrap-cmdline-spawn'
  };
 })
});
const older=runner('ubuntu-22.04',true);
const newer=runner('ubuntu-24.04',false);
const comparison=()=>compare(older,newer);
test('handoff preserves blocked status and no sandbox claim despite correlated evidence',()=>{
 const hand=handoff(comparison());
 assert.equal(hand.schema,'AUTO_X11_ADMIN_HANDOFF_V1');
 assert.equal(hand.status,'ubuntu24-native-window-blocked');
 assert.equal(hand.startupCorrelationObserved,true);
 assert.deepEqual(hand.pendingEvidence,[
  'ubuntu24-window-blocked',
  'renderer-sandbox-proof-required',
  'real-desktop-proof-required',
  'package-authenticity-proof-required'
 ]);
 assert.ok(Object.isFrozen(hand.pendingEvidence));
 assert.equal(hand.autoIdentityCoverage,'complete');
 assert.equal(hand.directElectronSigtrapWitnessComplete,true);
 assert.equal(hand.recommendedNextStep,
  'request-independent-app-specific-policy-review-on-approved-disposable-host');
 assert.deepEqual(hand.byDesktop,[
  {desktop:'GNOME',earlyMainKernelComparison:'matched-observed',
   ubuntu24AutoIdentitySource:'polling',
   ubuntu24DirectElectronControl:'sigtrap-cmdline-spawn'},
  {desktop:'KDE',earlyMainKernelComparison:'matched-observed',
   ubuntu24AutoIdentitySource:'polling',
   ubuntu24DirectElectronControl:'sigtrap-cmdline-spawn'}
 ]);
 for(const key of ['fullReleaseAuthorized','nativeCIWaived',
  'apparmorCausalityProven','rendererSandboxCertified',
  'genuineGnomeKdeCertified','policyChangeRequestedByThisReport'])
   assert.equal(hand[key],false);
 assert.ok(Object.isFrozen(hand));
 assert.ok(Object.isFrozen(hand.byDesktop));
 assert.ok(Object.isFrozen(hand.byDesktop[0]));
});
test('missing native process and unobserved capture remain diagnostic, not inferred',()=>{
 const partial=compare(older,runner('ubuntu-24.04',false,{missingKde:true}));
 const hand=handoff(partial);
 assert.equal(hand.status,'ubuntu24-native-window-blocked');
 assert.equal(hand.byDesktop[1].earlyMainKernelComparison,'insufficient-data');
 assert.equal(hand.byDesktop[1].ubuntu24AutoIdentitySource,'unobserved');
 assert.equal(hand.autoIdentityCoverage,'partial');
 assert.equal(hand.directElectronSigtrapWitnessComplete,true);
 assert.equal(hand.startupCorrelationObserved,false);
 assert.equal(hand.recommendedNextStep,
  'collect-missing-evidence-and-review-startup-before-policy-experiment');
 assert.equal(hand.apparmorCausalityProven,false);
});
test('two missing Auto identities cannot be inferred from two verified direct SIGTRAP controls',()=>{
 const partial=compare(older,runner('ubuntu-24.04',false,{missingAll:true}));
 const hand=handoff(partial);
 assert.equal(hand.autoIdentityCoverage,'none');
 assert.equal(hand.directElectronSigtrapWitnessComplete,true);
 assert.equal(hand.startupCorrelationObserved,false);
 assert.equal(hand.status,'ubuntu24-native-window-blocked');
 assert.equal(hand.recommendedNextStep,
  'collect-missing-evidence-and-review-startup-before-policy-experiment');
 assert.equal(hand.apparmorCausalityProven,false);
 assert.equal(hand.fullReleaseAuthorized,false);
});
test('direct control missing or an intact window cannot authorize release',()=>{
 const unavailable=create({runner:'ubuntu-24.04',
  archiveSha256:sha,baselineMapped:true,
  host:{apparmorModuleState:'enabled',apparmorRestriction:'enabled',
   userNamespaceProbe:'permission-denied'},
  outcomes:['GNOME','KDE'].map(desktop=>({
   desktop,mapped:false,failed:true,windowOwned:false,nativeProcess:true,
   triageClassification:'shared-electron-sandbox-startup-suspected',
   earlyNativeKernel:snapshot,identityCaptureSource:'polling',
   directControlCategory:'unavailable'
  }))
 });
 const noDirect=handoff(compare(older,unavailable));
 assert.equal(noDirect.startupCorrelationObserved,false);
 assert.equal(noDirect.recommendedNextStep,
  'collect-missing-evidence-and-review-startup-before-policy-experiment');
 const fullyMapped=handoff(compare(older,runner('ubuntu-24.04',true)));
 assert.equal(fullyMapped.status,'further-security-validation-required');
 assert.equal(fullyMapped.fullReleaseAuthorized,false);
 assert.equal(fullyMapped.rendererSandboxCertified,false);
});
test('forged comparisons, contradictory schemas, secret paths and positive flags are refused',()=>{
 const valid=comparison();
 for(const corrupt of [
  null,false,'private',{},[],
  {...valid,schema:'OLD'},
  {...valid,archiveSha256:'/home/private/secret'},
  {...valid,packageSignatureVerified:true},
  {...valid,electronSandboxCertified:true},
  {...valid,apparmorCausalityProven:true},
  {...valid,sandboxBypassApplied:true},
  {...valid,readOnlyComparison:false},
  {...valid,earlyMainKernelComparison:'matched-observed',
   earlyMainKernelByDesktop:[
    valid.earlyMainKernelByDesktop[0],
    {desktop:'KDE',comparison:'insufficient-data'}]},
  {...valid,ubuntu24DirectControlByDesktop:[{desktop:'GNOME',
   category:'/tmp/secret'},valid.ubuntu24DirectControlByDesktop[1]]},
  {...valid,identityCaptureByDesktop:[
   {desktop:'GNOME',ubuntu22CaptureSource:'polling',
    ubuntu24CaptureSource:'anonymous-private-path'},
   valid.identityCaptureByDesktop[1]]},
  {...valid,ubuntu24NativeWindowsVerified:true},
  {...valid,classification:'both-x11-window-probes-mapped'},
  {...valid,identityCaptureByDesktop:[
   valid.identityCaptureByDesktop[0],
   {...valid.identityCaptureByDesktop[1],ubuntu24CaptureSource:'unobserved'}]}
 ]){
  assert.throws(()=>handoff(corrupt),/^Error: AUTO_X11_ADMIN_HANDOFF_REFUSED$/);
 }
 const withSecrets={...valid,rawStderr:'/home/private/user/token',
  linuxProfile:'/home/private/profile'};
 const s=JSON.stringify(handoff(withSecrets));
 assert.equal(s.includes('/home/private'),false);
 assert.equal(s.includes('rawStderr'),false);
 assert.equal(s.includes('linuxProfile'),false);
});


test('human handoff is readable but does not upgrade blocked Ubuntu24',()=>{
 const out=markdown(comparison());
 assert.match(out,/Estado de homologação:\*\* BLOQUEADO no Ubuntu 24.04/);
 assert.match(out,/Etiqueta Xvfb/);
 assert.match(out,/SIGTRAP, identidade confirmada na inicialização/);
 assert.match(out,/Solicitar revisão independente com administrador/);
 assert.match(out,/sem prova causal do AppArmor/);
 assert.match(out,/sem autorização de release/);
 assert.match(out,/Namespace não privilegiado no Ubuntu 24\.04:\*\* permissão negada/);
 assert.match(out,/Restrição AppArmor de user namespaces no Ubuntu 24\.04:\*\* restrição ativa/);
 assert.match(out,/Controle Electron direto SIGTRAP observado nas duas etiquetas:\*\* sim/);
 assert.match(out,/Condições obrigatórias para revisão humana/);
 assert.match(out,/Evidências ainda pendentes ou insuficientes/);
 assert.match(out,/janela nativa Ubuntu 24\.04 permanece bloqueada/);
 assert.match(out,/sandbox do renderizador ainda não foi certificada/);
 assert.match(out,/autenticidade\/assinatura do artefato/);
 assert.doesNotMatch(out,/identidade do launcher Auto não foi confirmada/);
 assert.match(out,/A\/B\/A do mesmo artefato/);
 assert.match(out,/nova CI obrigatória completa/);
 assert.doesNotMatch(out,/sudo |sysctl -w|echo 0 \||chmod 4755/);
 assert.doesNotMatch(out,/\/home\/|\/proc\/|--no-sandbox|habilitar globalmente/i);
 assert.equal(out.endsWith('\n'),true);
 assert.equal(out.length<4096,true);
});
test('partial Auto identity demands collection before any policy pilot',()=>{
 const x=compare(older,runner('ubuntu-24.04',false,{missingKde:true}));
 const out=markdown(x);
 assert.match(out,/dados insuficientes/);
 assert.match(out,/não confirmada/);
 assert.match(out,/Coletar evidências ausentes do launcher Auto/);
 assert.match(out,/identidade do launcher Auto não foi confirmada/);
 assert.match(out,/Controle Electron direto SIGTRAP observado nas duas etiquetas:\*\* sim/);
 assert.doesNotMatch(out,/Solicitar revisão independente com administrador/);
});
test('mapped windows cannot imply release approval or renderer certification',()=>{
 const out=markdown(compare(older,runner('ubuntu-24.04',true)));
 assert.match(out,/PENDENTE de validação de segurança independente/);
 assert.match(out,/sem certificação de sandbox/);
 assert.match(out,/sem autorização de release/);
 assert.match(out,/validar janelas reais/i);
 assert.doesNotMatch(out,/janela nativa Ubuntu 24\.04 permanece bloqueada/);
 assert.match(out,/sandbox do renderizador ainda não foi certificada/);
 assert.match(out,/autenticidade\/assinatura do artefato/);
});
test('Markdown refuses forged schema and excludes arbitrary source properties',()=>{
 const good=comparison();
 assert.throws(()=>markdown({...good,electronSandboxCertified:true}),
  /^Error: AUTO_X11_ADMIN_HANDOFF_REFUSED$/);
 assert.throws(()=>markdown({...good,archiveSha256:'/home/private/key'}),
  /^Error: AUTO_X11_ADMIN_HANDOFF_REFUSED$/);
 const out=markdown({...good,privateStderr:'credential /home/private',rawPid:54321});
 assert.equal(out.includes('/home/private'),false);
 assert.equal(out.includes('privateStderr'),false);
 assert.equal(out.includes('54321'),false);
});


test('unavailable independent Electron witness is shown as missing instead of silently approved',()=>{
 const unavailable=create({runner:'ubuntu-24.04',archiveSha256:sha,baselineMapped:true,
  host:{apparmorModuleState:'enabled',apparmorRestriction:'enabled',
   userNamespaceProbe:'permission-denied'},
  outcomes:['GNOME','KDE'].map(desktop=>({
   desktop,mapped:false,failed:true,windowOwned:false,nativeProcess:true,
   triageClassification:'shared-electron-sandbox-startup-suspected',
   earlyNativeKernel:snapshot,identityCaptureSource:'polling',
   directControlCategory:'unavailable'
  }))
 });
 const out=markdown(compare(older,unavailable));
 assert.match(out,/controle Electron direto não tem testemunha SIGTRAP completa/);
 assert.match(out,/A janela nativa Ubuntu 24\.04 permanece bloqueada/);
 assert.doesNotMatch(out,/Solicitar revisão independente com administrador/);
 assert.match(out,/Coletar evidências ausentes do launcher Auto/);
 assert.doesNotMatch(out,/--no-sandbox|habilitar globalmente/);
});
test('missing Auto identities and unavailable namespace facts appear as unresolved',()=>{
 const unobserved=runner('ubuntu-24.04',false,{missingAll:true});
 const ambiguous=create({runner:'ubuntu-24.04',archiveSha256:sha,baselineMapped:true,
  host:{apparmorModuleState:'enabled',apparmorRestriction:'unknown',
   userNamespaceProbe:'unavailable'},
  outcomes:unobserved.windows.map(w=>({
   desktop:w.desktop,mapped:false,failed:true,windowOwned:false,
   nativeProcess:false,triageClassification:'shared-native-electron-startup-undetermined',
   earlyNativeKernel:early(null,null),identityCaptureSource:'unobserved',
   directControlCategory:'unavailable'
  }))
 });
 const out=markdown(compare(older,ambiguous));
 assert.match(out,/identidade do launcher Auto não foi confirmada/);
 assert.match(out,/A sonda independente de user namespace permanece indeterminada/);
 assert.match(out,/restrição AppArmor de user namespace permanece indeterminado/);
 assert.match(out,/controle Electron direto não tem testemunha SIGTRAP completa/);
 assert.match(out,/sem prova causal do AppArmor/);
 assert.match(out,/sem autorização de release/);
});

test('a categorical V6 inconclusive result cannot suggest AppArmor review from host flags alone',()=>{
 // Same source labels, probes, process identity and direct SIGTRAP categories,
 // but one native startup has a different diagnosis. The V6 comparator must
 // own the overall classification, not the handoff guessing from host fields.
 const conflicting=create({runner:'ubuntu-24.04',
  archiveSha256:sha,baselineMapped:true,
  host:{apparmorModuleState:'enabled',apparmorRestriction:'enabled',
   userNamespaceProbe:'permission-denied'},
  outcomes:['GNOME','KDE'].map((desktop,i)=>({
   desktop,mapped:false,failed:true,windowOwned:false,nativeProcess:true,
   triageClassification:i===0?'shared-electron-sandbox-startup-suspected':
    'auto-launcher-specific-suspected',
   earlyNativeKernel:snapshot,identityCaptureSource:'polling',
   directControlCategory:'sigtrap-cmdline-spawn'
  }))
 });
 const diff=compare(older,conflicting);
 assert.equal(diff.classification,'inconclusive');
 const h=handoff(diff);
 assert.equal(h.autoIdentityCoverage,'complete');
 assert.equal(h.directElectronSigtrapWitnessComplete,true);
 assert.equal(h.startupCorrelationObserved,false);
 assert.equal(h.recommendedNextStep,
  'collect-missing-evidence-and-review-startup-before-policy-experiment');
 const out=markdown(diff);
 assert.match(out,/classificação conjunta da inicialização ainda não sustenta revisão/);
 assert.doesNotMatch(out,/Solicitar revisão independente com administrador/);
 assert.match(out,/Coletar evidências ausentes do launcher Auto/);
 assert.match(out,/sem prova causal do AppArmor/);
 assert.match(out,/sem autorização de release/);
});
test('positive V6 classification remains only a request for independent review',()=>{
 const h=handoff(comparison());
 assert.equal(h.startupCorrelationObserved,true);
 assert.equal(h.administratorApprovalForHostChangesRequired,true);
 assert.equal(h.policyChangeRequestedByThisReport,false);
 assert.equal(h.apparmorCausalityProven,false);
 assert.equal(h.nativeCIWaived,false);
 assert.equal(h.fullReleaseAuthorized,false);
 const out=markdown(comparison());
 assert.doesNotMatch(out,/classificação conjunta da inicialização ainda não sustenta revisão/);
});

test('structured JSON evidence and human Markdown list share each pending category',()=>{
 const x=comparison(),h=handoff(x),out=markdown(x);
 const labels={
  'ubuntu22-window-unverified':'A referência nativa Ubuntu 22.04 não verificou',
  'ubuntu24-window-blocked':'A janela nativa Ubuntu 24.04 permanece bloqueada.',
  'auto-identity-incomplete':'A identidade do launcher Auto não foi confirmada',
  'electron-direct-witness-incomplete':'O controle Electron direto não tem testemunha',
  'startup-classification-insufficient':'A classificação conjunta da inicialização ainda não sustenta',
  'namespace-probe-indeterminate':'A sonda independente de user namespace permanece indeterminada.',
  'apparmor-userns-state-indeterminate':'O estado da restrição AppArmor de user namespace permanece indeterminado.',
  'renderer-sandbox-proof-required':'A proteção do sandbox do renderizador ainda não foi certificada',
  'real-desktop-proof-required':'As etiquetas Xvfb não substituem janelas verificadas',
  'package-authenticity-proof-required':'A autenticidade/assinatura do artefato distribuível não foi comprovada.'
 };
 for(const code of h.pendingEvidence){
  assert.ok(Object.hasOwn(labels,code),code);
  assert.ok(out.includes(labels[code]),code);
 }
 assert.ok(Object.isFrozen(h.pendingEvidence));
 assert.equal(h.fullReleaseAuthorized,false);
 assert.equal(h.nativeCIWaived,false);
 assert.equal(h.readOnly,true);
});
test('unknown host categories are pending in JSON and cannot be omitted by Markdown',()=>{
 const unavailable=create({runner:'ubuntu-24.04',archiveSha256:sha,
  baselineMapped:true,host:{apparmorModuleState:'enabled',
   apparmorRestriction:'unknown',userNamespaceProbe:'unavailable'},
  outcomes:['GNOME','KDE'].map(desktop=>({
   desktop,mapped:false,failed:true,windowOwned:false,nativeProcess:false,
   triageClassification:'shared-native-electron-startup-undetermined',
   earlyNativeKernel:early(null,null),identityCaptureSource:'unobserved',
   directControlCategory:'unavailable'
  }))
 });
 const diff=compare(older,unavailable),h=handoff(diff),out=markdown(diff);
 for(const code of [
  'auto-identity-incomplete','electron-direct-witness-incomplete',
  'startup-classification-insufficient','namespace-probe-indeterminate',
  'apparmor-userns-state-indeterminate'
 ])assert.ok(h.pendingEvidence.includes(code),code);
 assert.match(out,/A sonda independente de user namespace permanece indeterminada/);
 assert.match(out,/O estado da restrição AppArmor de user namespace permanece indeterminado/);
 assert.equal(h.startupCorrelationObserved,false);
 assert.equal(h.fullReleaseAuthorized,false);
});

test('stderr-edge Auto and direct witnesses support only a categorical administrator review',()=>{
 const from24=create({
  runner:'ubuntu-24.04',archiveSha256:sha,baselineMapped:true,
  host:{apparmorModuleState:'enabled',apparmorRestriction:'enabled',
   userNamespaceProbe:'permission-denied'},
  outcomes:['GNOME','KDE'].map(desktop=>({
   desktop,mapped:false,failed:true,windowOwned:false,nativeProcess:true,
   triageClassification:'shared-electron-sandbox-startup-suspected',
   earlyNativeKernel:snapshot,identityCaptureSource:'stderr-callback',
   directControlCategory:'sigtrap-cmdline-stderr'
  }))
 });
 const compared=compare(older,from24);
 const report=handoff(compared);
 assert.deepEqual(report.byDesktop.map(x=>x.ubuntu24AutoIdentitySource),
  ['stderr-callback','stderr-callback']);
 assert.deepEqual(report.byDesktop.map(x=>x.ubuntu24DirectElectronControl),
  ['sigtrap-cmdline-stderr','sigtrap-cmdline-stderr']);
 assert.equal(report.startupCorrelationObserved,true);
 assert.equal(report.directElectronSigtrapWitnessComplete,true);
 assert.equal(report.recommendedNextStep,
  'request-independent-app-specific-policy-review-on-approved-disposable-host');
 assert.equal(report.fullReleaseAuthorized,false);
 assert.equal(report.nativeCIWaived,false);
 assert.equal(report.rendererSandboxCertified,false);
 assert.equal(report.apparmorCausalityProven,false);
 assert.match(markdown(compared),/identidade confirmada/);
});
