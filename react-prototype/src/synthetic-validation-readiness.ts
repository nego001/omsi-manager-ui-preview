// Design checklist for FUTURE real mod validation; every item is NOT EVALUATED.
// Pure read-only projection of an issued synthetic timeline. No I/O, privileges or approvals.
import {isIssuedSyntheticDiagnosticTimeline,type SyntheticDiagnosticTimeline} from './synthetic-diagnostic-timeline';
import {explainSyntheticDiagnosticDecision,type SyntheticDecisionReasonCode} from './synthetic-decision-explanation';
import type {HistoryState} from './synthetic-evidence-history';

export type ValidationPhase='origin'|'integrity'|'compatibility'|'execution';
export type ValidationRequirementId=
 'explicit-file-consent'|'bounded-path-isolation'|'archive-resource-limits'|
 'real-cryptographic-digest'|'safe-container-parser'|'independent-module-evidence'|
 'dependency-resolution'|'real-game-compatibility'|'physical-windows-validation'|
 'backup-and-rollback'|'prewrite-recheck'|'separate-user-approval';
export type ValidationRequirement=Readonly<{
 id:ValidationRequirementId;phase:ValidationPhase;
 title:string;proofNeeded:string;reason:string;
 status:'not-evaluated';source:'design-requirement';completed:false;
 realWorldVerified:false;operationsEnabled:false;
}>;
export type SyntheticValidationReadiness=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';revision:number;
 currentState:HistoryState;isHistorical:boolean;
 requirements:readonly ValidationRequirement[];
 totalRequirements:12;notEvaluated:12;completed:0;
 declaredObservations:number;receivedSyntheticReports:number;
 unresolvedSyntheticReasons:readonly SyntheticDecisionReasonCode[];
 readyForRealValidation:false;approvedForOperations:false;
 operationPermissionGranted:false;previousEvidenceReusable:false;
 realFilesRead:false;realHashesCalculated:false;operationsEnabled:false;
 notice:string;
}>;
export type ValidationReadinessFilter='all'|ValidationPhase;
export type FilteredValidationReadiness=Readonly<{
 filter:ValidationReadinessFilter;shown:number;totalRequirements:12;
 requirements:readonly ValidationRequirement[];
 completed:0;notEvaluated:12;approvedForOperations:false;operationsEnabled:false;
}>;
type RequirementSpec=Readonly<{
 id:ValidationRequirementId;phase:ValidationPhase;title:string;
 proofNeeded:string;reason:string;
}>;
const definitions:readonly RequirementSpec[]=Object.freeze([
 {id:'explicit-file-consent',phase:'origin',title:'Consentimento para arquivo específico',
  proofNeeded:'Seleção explícita, revogável e limitada ao arquivo autorizado pelo usuário.',
  reason:'Uma declaração fictícia não concede acesso a arquivos pessoais.'},
 {id:'bounded-path-isolation',phase:'origin',title:'Isolamento de caminhos e vínculos',
  proofNeeded:'Raiz permitida, caminhos canônicos, symlinks/junctions e limites de escopo verificados no sistema de arquivos real.',
  reason:'Caminhos de fixtures não demonstram proteção contra escape ou links reais.'},
 {id:'archive-resource-limits',phase:'origin',title:'Limites contra pacotes hostis',
  proofNeeded:'Limites efetivos de tamanho, expansão, número de entradas, profundidade, tempo e cancelamento.',
  reason:'Tamanhos declarados não substituem inspeção de pacotes malformados.'},
 {id:'real-cryptographic-digest',phase:'integrity',title:'Digest calculado sobre os bytes reais',
  proofNeeded:'SHA-256 dos bytes lidos em contexto autorizado, com vínculo à revisão e nova validação antes de usar.',
  reason:'O digest atual é texto informado pelo cenário de teste, nunca calculado.'},
 {id:'safe-container-parser',phase:'integrity',title:'Parser seguro e somente leitura',
  proofNeeded:'Reconhecimento e limites de contêineres ZIP/SCS/OMSI, sem extração, execução ou escrita implícita.',
  reason:'O catálogo sintético não abre ou valida contêineres verdadeiros.'},
 {id:'independent-module-evidence',phase:'integrity',title:'Evidências independentes dos especialistas',
  proofNeeded:'Relatórios reais, vinculados à mesma revisão verificada, sem reaproveitamento de handles ou tickets antigos.',
  reason:'Consenso entre relatos fictícios não comprova observação real dos módulos.'},
 {id:'dependency-resolution',phase:'compatibility',title:'Dependências e conflitos efetivos',
  proofNeeded:'Relações reais de dependência e conflito analisadas com tratamento de dados ausentes e ambiguidades.',
  reason:'Metadados declarados não demonstram que dependências existem ou funcionam.'},
 {id:'real-game-compatibility',phase:'compatibility',title:'Compatibilidade com jogo e versão reais',
  proofNeeded:'Jogo, versão, formato, recursos e comportamentos conferidos contra critérios específicos da instalação autorizada.',
  reason:'Identificação candidata não equivale a compatibilidade confirmada.'},
 {id:'physical-windows-validation',phase:'compatibility',title:'Homologação em Windows físico',
  proofNeeded:'Validação manual supervisionada em ambiente Windows real, separada do smoke em CI.',
  reason:'Máquina virtual de CI não substitui a homologação no computador de destino.'},
 {id:'backup-and-rollback',phase:'execution',title:'Backup verificável e recuperação',
  proofNeeded:'Cópias verificadas, plano de restauração testado e proteção contra perda de dados antes de qualquer escrita.',
  reason:'A prévia nunca executou instalação ou restauração real.'},
 {id:'prewrite-recheck',phase:'execution',title:'Rechecagem contra troca de arquivos',
  proofNeeded:'Confirmação de identidade, revisão e integridade imediatamente antes de cada operação autorizada, mitigando TOCTOU.',
  reason:'O intervalo entre análise e operação pode invalidar provas antigas.'},
 {id:'separate-user-approval',phase:'execution',title:'Autorização separada por operação',
  proofNeeded:'Fluxo explícito de confirmação da ação exata, destino e consequências, com permissões mínimas e bloqueio por padrão.',
  reason:'Uma lista de requisitos não é permissão para instalar, editar, remover ou atualizar.'}
] satisfies readonly RequirementSpec[]);
const issued=new WeakSet<object>();
const requirementOrder:readonly ValidationPhase[]=['origin','integrity','compatibility','execution'];
export function createSyntheticValidationReadiness(timeline:SyntheticDiagnosticTimeline):SyntheticValidationReadiness{
 if(!isIssuedSyntheticDiagnosticTimeline(timeline))throw Error('Timeline sintética não emitida.');
 const current=explainSyntheticDiagnosticDecision(timeline,timeline.activeRevision);
 const requirements=Object.freeze(definitions.map(spec=>Object.freeze({
  ...spec,status:'not-evaluated' as const,source:'design-requirement' as const,
  completed:false as const,realWorldVerified:false as const,operationsEnabled:false as const
 })));
 const result:SyntheticValidationReadiness=Object.freeze({
  schemaVersion:1,source:'synthetic-fixture',revision:current.revision,
  currentState:current.state,isHistorical:current.isHistorical,
  requirements,totalRequirements:12,notEvaluated:12,completed:0,
  declaredObservations:current.totalDeclaredObservations,
  receivedSyntheticReports:current.receivedReports,
  unresolvedSyntheticReasons:Object.freeze(current.reasons.map(r=>r.code)),
  readyForRealValidation:false,approvedForOperations:false,
  operationPermissionGranted:false,previousEvidenceReusable:false,
  realFilesRead:false,realHashesCalculated:false,operationsEnabled:false,
  notice:'Planejamento de requisitos, não auditoria real. Nenhum item foi verificado e nenhuma operação está autorizada.'
 });
 issued.add(result);
 return result;
}
// Identity-only contract: does not attest any real checks, consent or file access.
export function isIssuedSyntheticValidationReadiness(value:unknown):value is SyntheticValidationReadiness{
 return !!value&&typeof value==='object'&&issued.has(value);
}
export function filterSyntheticValidationReadiness(
 plan:SyntheticValidationReadiness,phase:ValidationReadinessFilter
):FilteredValidationReadiness{
 if(!plan||typeof plan!=='object'||!issued.has(plan))throw Error('Plano sintético não emitido.');
 if(phase!=='all'&&!requirementOrder.includes(phase))throw Error('Filtro de requisitos inválido.');
 const requirements=Object.freeze(plan.requirements.filter(r=>phase==='all'||r.phase===phase));
 return Object.freeze({
  filter:phase,shown:requirements.length,totalRequirements:12,requirements,
  completed:0,notEvaluated:12,approvedForOperations:false,operationsEnabled:false
 });
}
