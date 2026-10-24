import {useState} from 'react';
import {ShieldCheck,LockKeyhole} from 'lucide-react';
import type {SyntheticValidationReadiness} from './synthetic-validation-readiness';
import {createSyntheticReadAdmissionSession} from './synthetic-read-admission';
import {createSyntheticContainerReview,advanceSyntheticContainerReview,
 issueSyntheticStreamDeclarationSource} from './synthetic-container-screen';
import {createSyntheticStreamReview} from './synthetic-stream-checkpoints';
import {createSyntheticReaderLifecycle,openSyntheticReaderLifecycle,
 stepSyntheticReaderLifecycle,closeSyntheticReaderLifecycle,
 type SyntheticReaderLifecycle} from './synthetic-reader-lifecycle';
import {acknowledgeSyntheticOrphanRecovery,
 type SyntheticOrphanRecovery} from './synthetic-orphan-recovery';
import {acquireSyntheticStorageLease,snapshotSyntheticStorageFailureMatrix,
 type SyntheticStorageFailureMatrix} from './synthetic-storage-failure-matrix';
import {createSyntheticQuarantineReview,assessSyntheticQuarantineCandidate,
 snapshotSyntheticQuarantineReview} from './synthetic-quarantine-review';

type Action='ack'|'reuse'|'partial'|'fresh'|'race';
function syntheticCandidate(readiness:SyntheticValidationReadiness,complete:boolean):SyntheticReaderLifecycle{
 const admission=createSyntheticReadAdmissionSession(readiness);
 const catalog=createSyntheticContainerReview(admission,{format:'zip-declared',entries:[
  {path:'def/reanalysis.sii',kind:'file',compression:'deflate',encodedBytes:300,expandedBytes:600},
  {path:'sound/reanalysis.ogg',kind:'file',compression:'deflate',encodedBytes:200,expandedBytes:400}
 ]});
 advanceSyntheticContainerReview(catalog);advanceSyntheticContainerReview(catalog);
 const source=issueSyntheticStreamDeclarationSource(catalog);
 const stream=createSyntheticStreamReview(source,source.entries.map(e=>({
  entryOrdinal:e.ordinal,encodedBytes:e.encodedBytes,
  expandedBytes:e.expandedBytes,elapsedMs:10,endOfEntry:true
 })));
 const lifecycle=createSyntheticReaderLifecycle(stream);
 openSyntheticReaderLifecycle(lifecycle);
 if(complete){
  for(const _ of source.entries)stepSyntheticReaderLifecycle(lifecycle);
  closeSyntheticReaderLifecycle(lifecycle);
 }else stepSyntheticReaderLifecycle(lifecycle);
 return lifecycle;
}
const decisions={
 'acknowledgement-required':'O abandono anterior precisa ser reconhecido.',
 'candidate-not-independent':'Sessão antiga, falsificada ou não independente: evidência recusada.',
 'candidate-incomplete':'Nova triagem fictícia incompleta: nenhuma conclusão aceita.',
 'candidate-reused':'A mesma nova sessão fictícia já foi utilizada.',
 'new-fixture-reviewed':'Nova triagem fictícia conferida. Quarentena original não foi removida.',
 'matrix-state-changed':'A matriz mudou após abrir a revisão. Triagem anterior invalidada; inicie nova revisão fictícia.'
} as const;
export default function SyntheticQuarantineReviewPreview({
 record,matrix,readiness
}:{record:SyntheticOrphanRecovery;matrix:SyntheticStorageFailureMatrix;readiness:SyntheticValidationReadiness}){
 const [actions,setActions]=useState<readonly Action[]>([]);
 const review=createSyntheticQuarantineReview(matrix,record);
 for(const action of actions){
  if(action==='ack')acknowledgeSyntheticOrphanRecovery(record);
  else if(action==='reuse')assessSyntheticQuarantineCandidate(review,{} as SyntheticReaderLifecycle);
  else if(action==='race'){
   const epoch=snapshotSyntheticStorageFailureMatrix(matrix).epoch;
   acquireSyntheticStorageLease(matrix,'session-b',epoch);
  }else assessSyntheticQuarantineCandidate(review,syntheticCandidate(readiness,action==='fresh'));
 }
 const state=snapshotSyntheticQuarantineReview(review);
 const done=state.status==='new-fixture-reviewed';
 return <section className="synthetic-quarantine-review" role="region" aria-label="Política fictícia de revisão da quarentena" data-real-unlock="false" data-real-review="false">
  <header>
   <div>
    <span className="eyebrow">REVISÃO DE QUARENTENA · SEM PERMISSÕES REAIS</span>
    <h6><ShieldCheck size={14} aria-hidden="true"/> Como voltar a analisar com segurança?</h6>
    <p>A matriz anterior não é desbloqueada. A demonstração exige reconhecer o abandono e receber outra triagem sintética independente e completa.</p>
   </div><span className="synthetic-quarantine-locked"><LockKeyhole size={13} aria-hidden="true"/> Sem liberação nativa</span>
  </header>
  <div className="synthetic-quarantine-metrics" role="status" aria-live="polite">
   <div><small>Situação da revisão</small><strong data-testid="synthetic-quarantine-phase">{done?'Nova triagem fictícia revista':'Reanálise pendente'}</strong></div>
   <div><small>Falhas anteriores</small><strong data-testid="synthetic-quarantine-failures">{state.priorFailures}</strong></div>
   <div><small>Novas declarações fictícias</small><strong data-testid="synthetic-quarantine-declarations">{state.reviewedNewDeclarations}</strong></div>
   <div><small>Evidências antigas reutilizáveis</small><strong data-testid="synthetic-quarantine-old">0</strong></div>
   <div><small>Revisão ainda atual</small><strong data-testid="synthetic-quarantine-freshness">{state.reviewCurrent?'Sim, apenas no exemplo':'Não, invalidada'}</strong></div>
  </div>
  <div className="synthetic-quarantine-actions">
   <button type="button" disabled={actions.includes('ack')||done} onClick={()=>setActions(a=>[...a,'ack'])}>Reconhecer abandono no exemplo</button>
   <button type="button" disabled={done} onClick={()=>setActions(a=>[...a,'reuse'])}>Tentar reutilizar sessão antiga</button>
   <button type="button" disabled={done} onClick={()=>setActions(a=>[...a,'partial'])}>Enviar reanálise incompleta</button>
   <button type="button" disabled={done} onClick={()=>setActions(a=>[...a,'fresh'])}>Conferir nova triagem fictícia</button>
   <button type="button" disabled={actions.includes('race')} onClick={()=>setActions(a=>[...a,'race'])}>Simular mudança concorrente na matriz</button>
   <button type="button" disabled={!actions.length} onClick={()=>setActions([])}>Reiniciar revisão</button>
  </div>
  {state.decision&&<p className="synthetic-quarantine-result" data-testid="synthetic-quarantine-decision">{decisions[state.decision]}</p>}
  {state.reviewInvalidated&&<p className="synthetic-quarantine-warning" data-testid="synthetic-quarantine-invalidated">A matriz mudou depois da abertura. Uma revisão anterior não pode ser reaproveitada; nenhuma permissão foi liberada.</p>}
  {state.originalMatrixStillQuarantined&&<p className="synthetic-quarantine-warning" data-testid="synthetic-quarantine-still-locked">A matriz anterior permanece em quarentena, inclusive depois da revisão fictícia.</p>}
  <p className="synthetic-quarantine-warning">Esta decisão não reabre o armazenamento antigo, não comprova limpeza de recursos Windows e não habilita instalar, remover ou atualizar mods.</p>
 </section>;
}
