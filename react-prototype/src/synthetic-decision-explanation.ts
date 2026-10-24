// Read-only explanation of what a SYNTHETIC verdict means and cannot prove.
// Issued timeline object identity is required. No real package, files, IPC or hashes.
import {SYNTHETIC_MODULE_IDS,type SyntheticModuleId} from './distributed-reader-contract';
import {isIssuedSyntheticDiagnosticTimeline,type SyntheticDiagnosticTimeline} from './synthetic-diagnostic-timeline';
import type {HistoryModuleStatus,HistoryState} from './synthetic-evidence-history';
import type {GameId} from './catalog';

type Specialist=Exclude<SyntheticModuleId,'container'>;
export type SyntheticDecisionReasonCode='fixture-only'|'real-bytes-unverified'|'digest-unverified'|
 'compatibility-unverified'|'installation-unverified'|'revision-superseded'|
 'reanalysis-pending'|'report-missing'|'report-incomplete'|'report-blocked'|
 'contradictory-claims'|'insufficient-claims'|'candidate-provisional';
export type SyntheticDecisionReason=Readonly<{
 code:SyntheticDecisionReasonCode;title:string;description:string;
 realWorldProof:false;
}>;
export type SyntheticDecisionEvidence=Readonly<{
 moduleId:Specialist;status:HistoryModuleStatus;observations:number;
 declaredImpactHint:boolean;description:string;
 source:'synthetic-fixture';verified:false;
}>;
export type SyntheticDecisionExplanation=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';revision:number;state:HistoryState;
 isHistorical:boolean;candidateGame:GameId|null;
 confirmation:'not-confirmed';headline:string;
 declaredEvidence:readonly SyntheticDecisionEvidence[];
 totalDeclaredObservations:number;receivedReports:number;
 waitingReports:number;blockedReports:number;
 reasons:readonly SyntheticDecisionReason[];
 verified:false;digestVerified:false;realBytesRead:false;
 compatibilityVerified:false;installationVerified:false;
 previousEvidenceReusable:false;operationsEnabled:false;
}>;

const moduleIds=SYNTHETIC_MODULE_IDS.filter((id):id is Specialist=>id!=='container');
const info:Readonly<Record<SyntheticDecisionReasonCode,Readonly<[string,string]>>>={
 'fixture-only':['Somente declarações fictícias','Os resultados foram fornecidos por testes em memória, não por leitura de mods instalados.'],
 'real-bytes-unverified':['Conteúdo não inspecionado','Nenhum byte de arquivo real foi lido para esta conclusão.'],
 'digest-unverified':['Identificador não autenticado','O digest é declarado pelo cenário; não foi calculado sobre o arquivo verdadeiro.'],
 'compatibility-unverified':['Compatibilidade não verificada','Não houve teste de execução, dependências ou compatibilidade com o jogo real.'],
 'installation-unverified':['Instalação não verificada','Nenhuma instalação foi realizada, validada ou autorizada.'],
 'revision-superseded':['Revisão histórica substituída','Esta revisão é apenas registro passado. Seu candidato não pode ser a identificação atual.'],
 'reanalysis-pending':['Reanálise necessária','Os especialistas desta revisão ainda precisam entregar novas declarações.'],
 'report-missing':['Relatório ausente','Há especialista sem relatório; ausência não significa aprovação.'],
 'report-incomplete':['Relatório incompleto','Um especialista informou que ainda não concluiu sua observação fictícia.'],
 'report-blocked':['Relatório bloqueado','Um especialista relatou bloqueio. Nenhuma operação foi liberada.'],
 'contradictory-claims':['Declarações contraditórias','O cenário contém identificações diferentes e não permite selecionar um jogo com segurança.'],
 'insufficient-claims':['Identificação não sustentada','Os indícios do cenário não são suficientes para propor um jogo.'],
 'candidate-provisional':['Candidato apenas fictício','Há consenso nas declarações simuladas, mas isso não confirma jogo, compatibilidade nem integridade reais.']
};
const baseCodes:readonly SyntheticDecisionReasonCode[]=[
 'fixture-only','real-bytes-unverified','digest-unverified',
 'compatibility-unverified','installation-unverified'
];
function headline(state:HistoryState,historical:boolean){
 if(historical)return 'Conclusão histórica, não vigente';
 if(state==='candidate')return 'Candidato sintético, confirmação indisponível';
 if(state==='recheck-required')return 'Conclusão suspensa, aguardando nova análise';
 if(state==='incomplete')return 'Conclusão não confirmada, relatório incompleto';
 if(state==='blocked')return 'Conclusão bloqueada no cenário';
 if(state==='ambiguous')return 'Conclusão não confirmada, indícios contraditórios';
 return 'Conclusão não confirmada, indícios insuficientes';
}
export function explainSyntheticDiagnosticDecision(
 timeline:SyntheticDiagnosticTimeline,revision:number
):SyntheticDecisionExplanation{
 if(!isIssuedSyntheticDiagnosticTimeline(timeline))
  throw Error('Linha do tempo sintética não emitida.');
 if(!Number.isSafeInteger(revision)||revision<1)
  throw Error('Revisão sintética inválida.');
 const current=timeline.revisions.find(r=>r.revision===revision);
 if(!current)throw Error('Revisão sintética não encontrada.');
 const specialists=current.events.filter(e=>e.kind==='specialist');
 if(specialists.length!==moduleIds.length||
    !moduleIds.every((id,index)=>specialists[index]?.moduleId===id))
  throw Error('Relatórios sintéticos incompletos para explicação.');
 const declaredEvidence=Object.freeze(specialists.map(event=>{
  const status=event.status;
  if(status===null)throw Error('Status sintético inválido.');
  return Object.freeze({
   moduleId:event.moduleId as Specialist,status,observations:event.observations,
   declaredImpactHint:event.affectedByDeclaredChange,
   description:status==='ok'?'Relatório fictício recebido; não atesta o conteúdo real.':
    status==='pending'?'Novo relatório ainda não emitido para a revisão.':
    status==='missing'?'Nenhum relatório fictício recebido.':
    status==='incomplete'?'Especialista declarou análise fictícia incompleta.':
    'Especialista declarou bloqueio no cenário fictício.',
   source:'synthetic-fixture' as const,verified:false as const
  });
 }));
 const flags=new Set<SyntheticDecisionReasonCode>(baseCodes);
 if(current.superseded)flags.add('revision-superseded');
 if(current.state==='recheck-required'||declaredEvidence.some(x=>x.status==='pending'))flags.add('reanalysis-pending');
 if(declaredEvidence.some(x=>x.status==='missing'))flags.add('report-missing');
 if(declaredEvidence.some(x=>x.status==='incomplete'))flags.add('report-incomplete');
 if(declaredEvidence.some(x=>x.status==='blocked'))flags.add('report-blocked');
 if(current.state==='ambiguous')flags.add('contradictory-claims');
 if(current.state==='unknown')flags.add('insufficient-claims');
 if(current.state==='candidate')flags.add('candidate-provisional');
 const reasons=Object.freeze([...flags].map(code=>Object.freeze({
  code,title:info[code][0],description:info[code][1],realWorldProof:false as const
 })));
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,
  revision:current.revision,state:current.state,isHistorical:current.superseded,
  candidateGame:current.candidateGame,
  confirmation:'not-confirmed' as const,headline:headline(current.state,current.superseded),
  declaredEvidence,totalDeclaredObservations:declaredEvidence.reduce((sum,r)=>sum+r.observations,0),
  receivedReports:declaredEvidence.filter(e=>e.status==='ok').length,
  waitingReports:declaredEvidence.filter(e=>e.status==='pending'||e.status==='missing'||e.status==='incomplete').length,
  blockedReports:declaredEvidence.filter(e=>e.status==='blocked').length,
  reasons,verified:false as const,digestVerified:false as const,realBytesRead:false as const,
  compatibilityVerified:false as const,installationVerified:false as const,
  previousEvidenceReusable:false as const,operationsEnabled:false as const
 });
}
