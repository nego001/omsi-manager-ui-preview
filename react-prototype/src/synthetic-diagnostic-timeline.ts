// Read-only synthetic diagnostic timeline. No real package reads or writes.
import {projectSyntheticEvidenceHistory,type SyntheticEvidenceHistory,type HistoryReason,type HistoryModuleStatus,type HistoryState} from './synthetic-evidence-history';
import type {SyntheticModuleId} from './distributed-reader-contract';
import type {GameId} from './catalog';
type Specialist=Exclude<SyntheticModuleId,'container'>;
export type TimelineCode='new-analysis'|'revision-opened'|'reanalysis-finished'|'reanalysis-unfinished'|'reanalysis-blocked'|'module-pending'|'module-pending-affected'|'module-missing'|'module-incomplete'|'module-blocked'|'module-reported';
export type TimelineEvent=Readonly<{
 revision:number;kind:'revision'|'specialist';moduleId:Specialist|null;
 code:TimelineCode;title:string;description:string;superseded:boolean;current:boolean;
 status:HistoryModuleStatus|null;observations:number;affectedByDeclaredChange:boolean;
 verified:false;operationsEnabled:false;
}>;
export type TimelineRevision=Readonly<{
 revision:number;state:HistoryState;reason:HistoryReason;candidateGame:GameId|null;
 candidateIsHistorical:boolean;current:boolean;superseded:boolean;
 events:readonly TimelineEvent[];completedSpecialists:number;pendingSpecialists:number;blockedSpecialists:number;
 verified:false;operationsEnabled:false;
}>;
export type SyntheticDiagnosticTimeline=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';activeRevision:number;revisionCount:number;
 state:HistoryState;currentGameCandidate:GameId|null;revisions:readonly TimelineRevision[];
 previousEvidenceReusable:false;digestVerified:false;operationsEnabled:false;
}>;
function revisionMessage(reason:HistoryReason,state:HistoryState):Readonly<[TimelineCode,string,string]>{
 if(reason==='initial-analysis')return ['new-analysis','Primeira análise fictícia','Resultado de observações simuladas; nenhuma compatibilidade foi verificada.'];
 if(reason==='source-revision-changed')return ['revision-opened','Pacote declarado alterado','Nova revisão iniciada. A identificação anterior é histórica; todos os especialistas precisam de novos relatórios.'];
 if(reason==='declared-digest-changed')return ['revision-opened','Identificador declarado mudou','O digest declarado mudou. Não é hash verificado; todas as observações anteriores foram invalidadas.'];
 if(reason==='declarations-same-unverified')return ['revision-opened','Nova revisão sem diferenças declaradas','Caminhos e tamanhos declarados parecem iguais, mas isso não comprova bytes iguais. A análise antiga foi invalidada.'];
 if(reason==='reanalysis-blocked'||state==='blocked')return ['reanalysis-blocked','Reanálise bloqueada','O resultado sintético contém bloqueio. A identificação anterior não foi restaurada.'];
 if(reason==='reanalysis-incomplete'||state==='incomplete')return ['reanalysis-unfinished','Reanálise incompleta','Nem todos os especialistas concluíram. A identificação anterior não foi reutilizada.'];
 return ['reanalysis-finished','Reanálise fictícia registrada','Relatórios da revisão atual consolidados. Identificação e compatibilidade reais continuam não verificadas.'];
}
function moduleMessage(status:HistoryModuleStatus,affected:boolean):Readonly<[TimelineCode,string,string]>{
 if(status==='pending'&&affected)return ['module-pending-affected','Reanálise prioritária','Mudanças declaradas podem afetar este especialista. Ele ainda não forneceu observações nesta revisão.'];
 if(status==='pending')return ['module-pending','Aguardando nova análise','Este especialista precisa entregar novo relatório, mesmo que as declarações pareçam iguais.'];
 if(status==='missing')return ['module-missing','Relatório não recebido','O especialista não entregou relatório nesta revisão. Ausência não significa aprovação.'];
 if(status==='incomplete')return ['module-incomplete','Análise incompleta','O especialista informou resultado fictício incompleto. A conclusão geral não pode ser confirmada.'];
 if(status==='blocked')return ['module-blocked','Especialista bloqueado','O especialista relatou bloqueio fictício. Não foram liberadas operações.'];
 return ['module-reported','Relatório fictício recebido','O especialista informou OK no teste. Isso não comprova leitura, integridade ou compatibilidade de mods reais.'];
}
export function projectSyntheticDiagnosticTimeline(history:SyntheticEvidenceHistory):SyntheticDiagnosticTimeline{
 projectSyntheticEvidenceHistory(history); // Reject copied or forged histories.
 const revisions=Object.freeze(history.revisions.map(r=>{
  const current=r.revision===history.activeRevision&&!r.superseded;
  const [code,title,description]=revisionMessage(r.reason,r.state);
  const event:TimelineEvent=Object.freeze({
   revision:r.revision,kind:'revision',moduleId:null,code,title,description,
   current,superseded:r.superseded,status:null,observations:0,
   affectedByDeclaredChange:false,verified:false,operationsEnabled:false
  });
  const workers=Object.freeze(r.moduleResults.map(m=>{
   const [moduleCode,moduleTitle,moduleDescription]=moduleMessage(m.status,m.affectedByDeclaredChange);
   return Object.freeze({
    revision:r.revision,kind:'specialist' as const,moduleId:m.moduleId,
    code:moduleCode,title:moduleTitle,description:moduleDescription,
    current,superseded:r.superseded,status:m.status,observations:m.observations,
    affectedByDeclaredChange:m.affectedByDeclaredChange,verified:false as const,operationsEnabled:false as const
   });
  }));
  return Object.freeze({
   revision:r.revision,state:r.state,reason:r.reason,candidateGame:r.candidateGame,
   candidateIsHistorical:r.superseded,current,superseded:r.superseded,
   events:Object.freeze([event,...workers]),
   completedSpecialists:r.moduleResults.filter(m=>m.status==='ok').length,
   pendingSpecialists:r.moduleResults.filter(m=>['pending','missing','incomplete'].includes(m.status)).length,
   blockedSpecialists:r.moduleResults.filter(m=>m.status==='blocked').length,
   verified:false as const,operationsEnabled:false as const
  });
 }));
 return Object.freeze({
  schemaVersion:1,source:'synthetic-fixture',activeRevision:history.activeRevision,
  revisionCount:history.revisionCount,state:history.state,
  currentGameCandidate:history.currentGameCandidate,
  revisions,previousEvidenceReusable:false,digestVerified:false,operationsEnabled:false
 });
}
