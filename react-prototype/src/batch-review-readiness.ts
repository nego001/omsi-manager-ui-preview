// Pure explanation of missing verification for a selection of catalog entries.
// Uses the exact specialist IDs and gate order of the synthetic reader contract.
// It NEVER creates evidence, signatures, digests, actual tasks or read privileges.
import {createSyntheticPlan,type SyntheticModuleId} from './distributed-reader-contract';
import type {DeclaredBatchReport} from './batch-declared-analysis';
const labels:Readonly<Record<SyntheticModuleId,string>>=Object.freeze({
 container:'Segurança do pacote',
 structure:'Estrutura de pastas',
 manifest:'Manifesto e autoria',
 definitions:'Definições do jogo',
 resources:'Modelos e texturas',
 audio:'Áudio e eventos',
 media:'Imagens e procedência',
 relations:'Versões, dependências e conflitos'
});
const explanations:Readonly<Record<SyntheticModuleId,string>>=Object.freeze({
 container:'Validar assinatura, tamanho e entradas perigosas antes de qualquer leitura.',
 structure:'Conferir os arquivos e a organização interna, não apenas o nome do mod.',
 manifest:'Confrontar os metadados declarados com evidências do pacote.',
 definitions:'Identificar o simulador e as definições reais sem presumir compatibilidade.',
 resources:'Verificar referências a modelos, texturas e materiais existentes.',
 audio:'Examinar apenas formatos e eventos sonoros suportados.',
 media:'Validar imagens autênticas, origem e permissão de uso.',
 relations:'Verificar versões e conflitos contra instalações e dependências reais.'
});
export type PendingSpecialist=Readonly<{
 id:SyntheticModuleId;label:string;purpose:string;
 phase:'gate'|'specialists';status:'not-run';
}>;
export type BatchReviewReadiness=Readonly<{
 state:'awaiting-real-reader';scope:'declared-catalog-only';
 specialists:readonly PendingSpecialist[];
 declaredBlockers:number;declaredNotices:number;
 selectedCount:number;realPackagesRead:false;
 evidenceVerified:false;compatibilityVerified:false;
 installEnabled:false;
}>;
export function prepareBatchReviewReadiness(report:DeclaredBatchReport):BatchReviewReadiness{
 if(!report||report.mode!=='catalog-metadata-only'||report.canInstall!==false||
  report.compatibilityVerified!==false||report.installationVerified!==false||
  !Number.isSafeInteger(report.selectedCount)||report.selectedCount<1||
  !Number.isSafeInteger(report.blockers)||report.blockers<0||
  !Number.isSafeInteger(report.notices)||report.notices<0)
  throw Error('BATCH_READINESS_REFUSED');
 const plan=createSyntheticPlan();
 if(plan.executionEnabled!==false||plan.phases[0]?.name!=='gate')
  throw Error('BATCH_READINESS_REFUSED');
 const specialists=plan.phases.flatMap(phase=>phase.modules.map(id=>
  Object.freeze({id,label:labels[id],purpose:explanations[id],
   phase:phase.name,status:'not-run' as const})
 ));
 return Object.freeze({
  state:'awaiting-real-reader' as const,scope:'declared-catalog-only' as const,
  specialists:Object.freeze(specialists),
  declaredBlockers:report.blockers,declaredNotices:report.notices,
  selectedCount:report.selectedCount,
  realPackagesRead:false as const,evidenceVerified:false as const,
  compatibilityVerified:false as const,installEnabled:false as const
 });
}
