// M46 — Offline A/B/A intake protocol. Reuses M45 + existing M29 comparator.
// The CI may NEVER read a human pilot record, change AppArmor, or claim approval.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyM45Handoff} from './auto-x11-admin-pilot-readiness.mjs';
import {compareTwoDesktopUbuntu24ABA} from './ubuntu24-two-desktop-aba-evidence.mjs';

const REFUSE='M46_ABA_INTAKE_REFUSED';
const refuse=()=>{throw Error(REFUSE);};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const PHASES=Object.freeze([
 'GNOME:baseline','GNOME:app-specific-pilot','GNOME:rollback',
 'KDE:baseline','KDE:app-specific-pilot','KDE:rollback'
]);
const CHECKS=Object.freeze([
 'independent-administrator-authorization',
 'disposable-vm-and-independent-host-identity',
 'actual-executed-package-bytes-and-sha256',
 'narrow-single-executable-apparmor-scope-and-change-control',
 'real-gnome-kde-display-process-owned-windows',
 'independent-chromium-renderer-sandbox-confinement',
 'independent-post-pilot-policy-and-host-rollback',
 'mandatory-ubuntu24-strict-native-ci-gate',
 'independent-human-review-of-original-evidence'
]);
const PROVENANCE=Object.freeze({
 externalABAPerformedByCI:false,
 administratorApprovalIndependentlyVerified:false,
 policyAppliedByCI:false,
 hostIdentityIndependentlyVerified:false,
 actualExecutableBytesIndependentlyVerified:false,
 appSpecificPolicyIndependentlyVerified:false,
 apparmorCausedSIGTRAPProven:false,
 rollbackIndependentlyVerified:false,
 rendererSandboxIndependentlyVerified:false,
 nativeUbuntu24StrictCIPassed:false,
 sandboxBypassApplied:false,
 hostPolicyChangedByCI:false,
 realOMSIModsRead:false,
 installationAuthorized:false,
 releaseAuthorized:false,
 mergeAuthorized:false
});
const INPUT_FIELDS=['m45','externalPilot'];
const OUTPUT_FIELDS=[
 'schema','source','status','m45ReviewRequested',
 'externalPilotRecordPresent','humanReportedAbaClassification',
 'reviewTask','requiredPhaseLabels','mandatoryIndependentChecks',
 'evidenceSourceIndependentOfCI','humanPilotAuthenticated',
 ...Object.keys(PROVENANCE)
];
const REPORTED=['not-provided','two-labels-reversible-correlation-reported',
 'two-label-evidence-incomplete-needs-independent-review'];
function status(m45,pilot,classification){
 if(!m45)return 'm45-contrast-incomplete-no-pilot-clearance';
 if(!pilot)return 'awaiting-admin-authorization-and-external-aba-records';
 return classification==='two-labels-reversible-correlation-reported'?
  'untrusted-reversible-aba-claims-need-independent-review':
  'untrusted-aba-incomplete-needs-independent-review';
}
export function createM46ABAIntake(input){
 if(!exact(input,INPUT_FIELDS)||!(input.externalPilot===null||plain(input.externalPilot)))refuse();
 let m45;
 try{m45=verifyM45Handoff(input.m45);}catch{refuse();}
 let classification='not-provided';
 if(input.externalPilot!==null){
  let compared;
  try{compared=compareTwoDesktopUbuntu24ABA(input.externalPilot);}
  catch{refuse();}
  if(compared.pilotActuallyExecutedByComparator!==false||
     compared.independentHostIdentityVerified!==false||
     compared.chromiumRendererSandboxCertified!==false||
     compared.nativeCIGateWaived!==false||
     compared.mergeAuthorized!==false)refuse();
  classification=compared.classification;
  if(!REPORTED.includes(classification)||classification==='not-provided')refuse();
 }
 const m45Review=m45.reviewRequestedOnly===true;
 const pilot=input.externalPilot!==null;
 const report={
  schema:'M46_UBUNTU24_EXTERNAL_ABA_INTAKE_V1',
  source:'m45-sanitized-ci-review-plus-optional-untrusted-human-aba-categories',
  status:status(m45Review,pilot,classification),
  m45ReviewRequested:m45Review,
  externalPilotRecordPresent:pilot,
  humanReportedAbaClassification:classification,
  reviewTask:'request-independent-approved-disposable-vm-aba-review-only',
  requiredPhaseLabels:PHASES,
  mandatoryIndependentChecks:CHECKS,
  evidenceSourceIndependentOfCI:false,
  humanPilotAuthenticated:false,
  ...PROVENANCE
 };
 return verifyM46ABAIntake(Object.freeze(report));
}
export function verifyM46ABAIntake(x){
 if(!exact(x,OUTPUT_FIELDS)||
    x.schema!=='M46_UBUNTU24_EXTERNAL_ABA_INTAKE_V1'||
    x.source!=='m45-sanitized-ci-review-plus-optional-untrusted-human-aba-categories'||
    typeof x.m45ReviewRequested!=='boolean'||
    typeof x.externalPilotRecordPresent!=='boolean'||
    !REPORTED.includes(x.humanReportedAbaClassification)||
    (x.externalPilotRecordPresent===(x.humanReportedAbaClassification==='not-provided'))||
    x.status!==status(x.m45ReviewRequested,x.externalPilotRecordPresent,
      x.humanReportedAbaClassification)||
    x.reviewTask!=='request-independent-approved-disposable-vm-aba-review-only'||
    !Array.isArray(x.requiredPhaseLabels)||
    x.requiredPhaseLabels.length!==PHASES.length||
    PHASES.some((p,i)=>x.requiredPhaseLabels[i]!==p)||
    !Array.isArray(x.mandatoryIndependentChecks)||
    x.mandatoryIndependentChecks.length!==CHECKS.length||
    CHECKS.some((p,i)=>x.mandatoryIndependentChecks[i]!==p)||
    x.evidenceSourceIndependentOfCI!==false||
    x.humanPilotAuthenticated!==false||
    Object.keys(PROVENANCE).some(k=>x[k]!==false))refuse();
 return x;
}
const STATUS_LABELS=Object.freeze({
 'm45-contrast-incomplete-no-pilot-clearance':
  'M45 nao confirmou o contraste necessario. Nenhum piloto foi autorizado.',
 'awaiting-admin-authorization-and-external-aba-records':
  'M45 suporta pedido de revisao humana; nenhuma fase A/B/A externa foi executada por esta CI.',
 'untrusted-reversible-aba-claims-need-independent-review':
  'Relatos humanos indicam padrao A/B/A reversivel, SEM autenticacao ou certificacao independente.',
 'untrusted-aba-incomplete-needs-independent-review':
  'Relatos A/B/A incompletos ou divergentes; requer revisao humana independente.'
});
export function renderM46OperatorRunbook(value){
 const r=verifyM46ABAIntake(value);
 return [
  '# OMSI Manager | M46 — Protocolo A/B/A externo (SOMENTE LEITURA)',
  '',
  '**Situacao:** '+STATUS_LABELS[r.status],
  '',
  '**Atenção:** GitHub Actions nao executou o piloto, nao aplicou AppArmor, nao certificou o sandbox e nao liberou a instalacao.',
  '',
  '## Registro exigido em cada desktop REAL (GNOME e KDE)',
  '',
  '| Etapa | Evidencia minima |',
  '|---|---|',
  '| A1 — baseline | Mesmo executavel identificado por hash REAL; X11 neutro; sinais de ambos os processos; estado de namespace observado sem privilegios |',
  '| B — piloto aprovado | Apenas administrador em VM descartavel; mudanca de perfil limitada ao executavel; duas janelas atribuidas e mapeadas; confinamento do renderer comprovado separadamente |',
  '| A2 — rollback | Perfil de teste removido e estado do host restaurado sob auditoria; mesma identidade de pacote; repetir testemunhas e verificar regresso da falha original, se ocorrer |',
  '',
  '## Fases pendentes: GNOME e KDE',
  '',
  ...r.requiredPhaseLabels.map(p=>'- [ ] '+p),
  '',
  '## Checagens externas obrigatorias (nenhuma foi verificada por esta CI)',
  '',
  ...r.mandatoryIndependentChecks.map(c=>'- [ ] '+c),
  '',
  '**Resultado de relatos A/B/A:** '+r.humanReportedAbaClassification,
  '',
  '**Gate nativo Ubuntu 24.04:** ainda NAO APROVADO.',
  '',
  '**Seguranca:** nao usar --no-sandbox, root Electron, mudanca global de sysctl ou AppArmor, nem executar mods reais. Um perfil especifico nao e prova de isolamento do Chromium.',
  '',
  '**Proxima acao:** solicitar avaliacao administrativa independente em VM descartavel com rollback documentado; nao executar por esta CI.',
  ''
 ].join('\n');
}
function main(){
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.RUNNER_OS!=='Linux')refuse();
 const inDir=resolve('test-results/m45');
 const inputPath=resolve(inDir,'operator-review-handoff.json');
 if(!inputPath.startsWith(inDir+sep))refuse();
 const bytes=readFileSync(inputPath);
 if(bytes.length<3||bytes.length>8192)refuse();
 let m45;
 try{m45=JSON.parse(bytes.toString('utf8'));}catch{refuse();}
 // Deliberately NEVER import an external pilot from CI artifacts.
 const report=createM46ABAIntake({m45,externalPilot:null});
 const md=renderM46OperatorRunbook(report);
 const out=resolve('test-results/m46');
 mkdirSync(out,{recursive:true,mode:0o700});
 for(const [name,contents] of [
  ['operator-aba-intake.json',JSON.stringify(report)+'\n'],
  ['operator-aba-runbook.md',md]
 ]){
  const path=resolve(out,name);
  if(!path.startsWith(out+sep))refuse();
  writeFileSync(path,contents,{mode:0o600,flag:'wx'});
 }
 console.log('M46_ABA_INTAKE_CATEGORY',JSON.stringify(report));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main();}catch{console.error(REFUSE);process.exitCode=1;}
}
