import type {GameId} from './catalog';
import type {FolderInspection} from './inspection-types';
import type {RelationAnalysis} from './relation-analysis';

export type DiagnosticFinding={
 origin:'catalog'|'directory'|'scope';
 severity:'blocking'|'attention'|'info';
 code:string;
 description:string;
};
export type ConsolidatedDiagnostic={
 game:GameId;
 modId:string;
 catalogOrigin:string;
 hypotheticalVersion:string|null;
 title:'Inconsistências no catálogo'|'Revisão manual obrigatória';
 blockers:number;
 warnings:number;
 declaredSequenceCount:number;
 directoryStatus:'not-run'|'inspected'|'error';
 inspectedEntries:number|null;
 hasPartialCounts:boolean;
 findings:DiagnosticFinding[];
 limitations:readonly string[];
 actionsAllowed:false;
 compatibilityVerified:false;
};

const LIMITATIONS=[
 'A leitura da pasta conta nomes e tipos de entradas, nunca abre o conteúdo dos mods.',
 'A versão do jogo, os mods instalados e a ativação não foram detectados automaticamente.',
 'Verificações de integridade, conflitos reais, segurança e compatibilidade continuam pendentes.',
 'Instalação e remoção permanecem bloqueadas.'
] as const;

export function consolidateDiagnostic(
 game:GameId,
 modId:string,
 catalogOrigin:string,
 analysis:RelationAnalysis,
 inspection:FolderInspection|undefined,
 hypotheticalVersion:string
):ConsolidatedDiagnostic{
 const findings:DiagnosticFinding[]=analysis.issues.map(issue=>({
  origin:'catalog',
  severity:issue.severity==='blocking'?'blocking':'attention',
  code:issue.code,
  description:issue.message
 }));
 let directoryStatus:ConsolidatedDiagnostic['directoryStatus']='not-run';
 let inspectedEntries:number|null=null;
 let hasPartialCounts=false;
 if(!inspection){
  findings.push({origin:'directory',severity:'info',code:'directory-not-inspected',
   description:'Nenhuma inspeção manual de pasta foi realizada neste jogo nesta sessão.'});
 }else if(inspection.status==='ok'&&inspection.game===game){
  directoryStatus='inspected';
  inspectedEntries=inspection.groups.reduce((n,group)=>n+group.count,0);
  hasPartialCounts=inspection.limited;
  findings.push({origin:'directory',severity:'info',code:'directory-count-only',
   description:'Foram contabilizadas '+inspectedEntries+' entradas em diretórios conhecidos. Isto não equivale a mods instalados.'});
  for(const notice of inspection.notices){
   findings.push({
    origin:'directory',severity:notice.level==='attention'?'attention':'info',
    code:notice.code,description:notice.message
   });
  }
 }else if(inspection.status==='error'){
  directoryStatus='error';
  findings.push({origin:'directory',severity:'attention',code:'directory-error',
   description:'A inspeção da pasta não foi concluída. Nenhuma conclusão sobre os arquivos pode ser tirada.'});
 }else{
  findings.push({origin:'directory',severity:'info',code:'directory-unavailable',
   description:'Nenhum diagnóstico de pasta correspondente a este jogo está disponível.'});
 }
 const blockers=findings.filter(f=>f.severity==='blocking').length;
 const warnings=findings.filter(f=>f.severity==='attention').length;
 const assumed=hypotheticalVersion.trim();
 return {
  game,modId,catalogOrigin,
  hypotheticalVersion:assumed||null,
  title:blockers>0?'Inconsistências no catálogo':'Revisão manual obrigatória',
  blockers,warnings,
  declaredSequenceCount:analysis.sequence.length,
  directoryStatus,inspectedEntries,hasPartialCounts,
  findings,limitations:LIMITATIONS,
  actionsAllowed:false,compatibilityVerified:false
 };
}
