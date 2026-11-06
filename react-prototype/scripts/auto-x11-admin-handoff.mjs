// Pure, categorical operator handoff for existing CI-owned X11 comparisons.
// No system operations, no raw stderr/PIDs/paths, no compatibility certification.
// Input from compareSanitizedX11Records has been canonicalized; validate again
// before presenting to reviewers so forged comparisons cannot generate approval.
const fail=()=>{throw Error('AUTO_X11_ADMIN_HANDOFF_REFUSED');};
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const enumSet=values=>new Set(values);
const comparisonModes=enumSet(['matched-observed','different-observed','insufficient-data']);
const captureSources=enumSet(['spawn-callback','polling','unobserved']);
const directModes=enumSet(['not-run','unavailable','sigtrap-cmdline-spawn',
 'sigtrap-cmdline-polling','sigtrap-no-cmdline','other-result']);
const probeModes=enumSet(['allowed','permission-denied','unavailable','unknown']);
const apparmorModes=enumSet(['enabled','disabled','unknown','unavailable']);
const classifications=enumSet([
 'inconclusive','namespace-restriction-correlated-with-startup-failure',
 'both-x11-window-probes-mapped'
]);
const desktops=['GNOME','KDE'];
function labelOrder(array){
 return Array.isArray(array)&&array.length===2&&
  array.every((x,i)=>isObj(x)&&x.desktop===desktops[i]);
}
function requiredFlags(x){
 return x.sameArchiveSha256ReportedByBothRunners===true&&
 x.packageSignatureVerified===false&&x.identityCaptureSourceProvesSandbox===false&&
 x.directControlProvesSandbox===false&&x.earlyMainKernelIsRendererProof===false&&
 x.apparmorCausalityProven===false&&x.electronSandboxCertified===false&&
 x.realDesktopCertified===false&&x.hostPolicyChanged===false&&
 x.sandboxBypassApplied===false&&x.readOnlyComparison===true;
}
export function createX11AdminHandoff(value){
 const x=value;
 if(!isObj(x)||x.schema!=='AUTO_X11_CROSS_RUNNER_COMPARISON_V6'||
  typeof x.archiveSha256!=='string'||!/^[a-f0-9]{64}$/.test(x.archiveSha256)||
  !requiredFlags(x)||
  typeof x.ubuntu22NativeWindowsVerified!=='boolean'||
  typeof x.ubuntu24NativeWindowsVerified!=='boolean'||
  !probeModes.has(x.ubuntu22NamespaceProbe)||
  !probeModes.has(x.ubuntu24NamespaceProbe)||
  !apparmorModes.has(x.ubuntu24ApparmorRestriction)||
  !classifications.has(x.classification)||
  !comparisonModes.has(x.earlyMainKernelComparison)||
  !labelOrder(x.earlyMainKernelByDesktop)||
  !labelOrder(x.identityCaptureByDesktop)||
  !labelOrder(x.ubuntu24DirectControlByDesktop))fail();
 const byDesktop=desktops.map((desktop,i)=>{
  const kernel=x.earlyMainKernelByDesktop[i],identity=x.identityCaptureByDesktop[i],
   control=x.ubuntu24DirectControlByDesktop[i];
  if(!comparisonModes.has(kernel.comparison)||
   !captureSources.has(identity.ubuntu22CaptureSource)||
   !captureSources.has(identity.ubuntu24CaptureSource)||
   !directModes.has(control.category))fail();
  return Object.freeze({
   desktop,
   earlyMainKernelComparison:kernel.comparison,
   ubuntu24AutoIdentitySource:identity.ubuntu24CaptureSource,
   ubuntu24DirectElectronControl:control.category
  });
 });
 // Capture source is itself a bound on observable kernel evidence. If no
 // exact native process command line was verified, a cross-runner kernel
 // equality/difference cannot legitimately exist for that label.
 if(byDesktop.some(d=>d.ubuntu24AutoIdentitySource==='unobserved'&&
    d.earlyMainKernelComparison!=='insufficient-data'))fail();
 const observedAutoCount=byDesktop.filter(d=>
  d.ubuntu24AutoIdentitySource!=='unobserved').length;
 const autoIdentityCoverage=observedAutoCount===2?'complete':
  observedAutoCount===1?'partial':'none';
 const kinds=byDesktop.map(x=>x.earlyMainKernelComparison);
 const calculated=kinds.includes('insufficient-data')?'insufficient-data':
  kinds.includes('different-observed')?'different-observed':'matched-observed';
 if(calculated!==x.earlyMainKernelComparison)fail();
 if(x.classification==='both-x11-window-probes-mapped'&&
  !(x.ubuntu22NativeWindowsVerified&&x.ubuntu24NativeWindowsVerified))fail();
 if(x.classification==='namespace-restriction-correlated-with-startup-failure'&&
  (!x.ubuntu22NativeWindowsVerified||x.ubuntu24NativeWindowsVerified||
   x.ubuntu24NamespaceProbe!=='permission-denied'||
   x.ubuntu24ApparmorRestriction!=='enabled'))fail();
 // A successful X11 window test alone cannot certify the renderer sandbox.
 const blocked=!x.ubuntu24NativeWindowsVerified;
 const directSigtraps=byDesktop.every(d=>
  ['sigtrap-cmdline-spawn','sigtrap-cmdline-polling'].includes(
   d.ubuntu24DirectElectronControl));
 // Never suggest a host-policy experiment while the Auto process itself
 // is still unobserved in either Xvfb label. Direct Electron witnesses
 // are a separate control and cannot fill missing Auto identity.
 const correlated=blocked&&autoIdentityCoverage==='complete'&&
  x.ubuntu22NativeWindowsVerified&&
  x.ubuntu22NamespaceProbe==='allowed'&&
  x.ubuntu24NamespaceProbe==='permission-denied'&&
  x.ubuntu24ApparmorRestriction==='enabled'&&directSigtraps;
 const recommendedNextStep=correlated?
  'request-independent-app-specific-policy-review-on-approved-disposable-host':
  blocked?'collect-missing-evidence-and-review-startup-before-policy-experiment':
  'verify-independent-renderer-sandbox-and-real-desktop-before-release';
 return Object.freeze({
  schema:'AUTO_X11_ADMIN_HANDOFF_V1',
  archiveSha256:x.archiveSha256,
  status:blocked?'ubuntu24-native-window-blocked':'further-security-validation-required',
  ubuntu22NativeWindowsVerified:x.ubuntu22NativeWindowsVerified,
  ubuntu24NativeWindowsVerified:x.ubuntu24NativeWindowsVerified,
  ubuntu24UserNamespaceProbe:x.ubuntu24NamespaceProbe,
  ubuntu24ApparmorRestriction:x.ubuntu24ApparmorRestriction,
  byDesktop:Object.freeze(byDesktop),
  autoIdentityCoverage,
  directElectronSigtrapWitnessComplete:directSigtraps,
  startupCorrelationObserved:correlated,
  recommendedNextStep,
  source:'sanitized-same-workflow-ubuntu-comparison',
  administratorApprovalForHostChangesRequired:true,
  policyChangeRequestedByThisReport:false,
  apparmorCausalityProven:false,
  rendererSandboxCertified:false,
  genuineGnomeKdeCertified:false,
  fullReleaseAuthorized:false,
  nativeCIWaived:false,
  readOnly:true
 });
}


// Human-readable companion for CI reviewers. All interpolated strings are
// restricted to the validated handoff enums and a fixed-format SHA-256.
// It cannot claim release approval even if both simulated X11 windows map.
export function renderX11AdminHandoffMarkdown(comparison){
 const h=createX11AdminHandoff(comparison);
 const labels={
  'spawn-callback':'confirmada na inicialização',
  'polling':'confirmada na verificação posterior',
  'unobserved':'não confirmada',
  'matched-observed':'iguais nos estados observados',
  'different-observed':'diferentes nos estados observados',
  'insufficient-data':'dados insuficientes',
  'not-run':'não executado',
  'unavailable':'indisponível',
  'sigtrap-cmdline-spawn':'SIGTRAP, identidade confirmada na inicialização',
  'sigtrap-cmdline-polling':'SIGTRAP, identidade confirmada posteriormente',
  'sigtrap-no-cmdline':'SIGTRAP, identidade não confirmada',
  'other-result':'outro resultado; não é aprovação'
 };
 const next={
  'request-independent-app-specific-policy-review-on-approved-disposable-host':
   'Solicitar revisão independente com administrador em host descartável autorizado, sem aplicar política automaticamente.',
  'collect-missing-evidence-and-review-startup-before-policy-experiment':
   'Coletar evidências ausentes do launcher Auto antes de considerar qualquer teste de política.',
  'verify-independent-renderer-sandbox-and-real-desktop-before-release':
   'Comprovar separadamente sandbox do renderizador e sessões gráficas reais antes de cogitar lançamento.'
 };
 const rows=h.byDesktop.map(d=>
  '| '+d.desktop+' | '+labels[d.ubuntu24AutoIdentitySource]+
  ' | '+labels[d.earlyMainKernelComparison]+
  ' | '+labels[d.ubuntu24DirectElectronControl]+' |');
 return [
  '# OMSI Manager | Revisão X11 automatizada',
  '',
  '**Estado de homologação:** '+(h.status==='ubuntu24-native-window-blocked'?
   'BLOQUEADO no Ubuntu 24.04':'PENDENTE de validação de segurança independente'),
  '',
  '**SHA-256 reportado do pacote de CI:** '+h.archiveSha256,
  '',
  '| Etiqueta Xvfb | Identidade do Auto (24.04) | Kernel inicial (22.04 × 24.04) | Controle Electron direto (24.04) |',
  '|---|---|---|---|',
  ...rows,
  '',
  '**Ubuntu 22.04, janela Auto verificada:** '+(h.ubuntu22NativeWindowsVerified?'sim':'não'),
  '',
  '**Ubuntu 24.04, janela Auto verificada:** '+(h.ubuntu24NativeWindowsVerified?'sim':'não'),
  '',
  '**Cobertura de identidade Auto:** '+h.autoIdentityCoverage,
  '',
  '**Evidência correlacionada, sem prova de causalidade:** '+
   (h.startupCorrelationObserved?'observada':'não estabelecida'),
  '',
  '**Próximo passo:** '+next[h.recommendedNextStep],
  '',
  '> GNOME e KDE são etiquetas simuladas no Xvfb, não sessões reais. O estado inicial do processo principal não atesta o sandbox do renderizador.',
  '',
  '**Limites obrigatórios:** sem prova causal do AppArmor, sem certificação de sandbox, sem autorização de release, sem dispensa da CI X11. Nenhuma política do host foi alterada.',
  ''
 ].join('\n');
}
