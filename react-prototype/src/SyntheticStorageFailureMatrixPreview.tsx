import {useState} from 'react';
import {LockKeyhole,ShieldAlert} from 'lucide-react';
import type {SyntheticOrphanRecovery} from './synthetic-orphan-recovery';
import type {SyntheticValidationReadiness} from './synthetic-validation-readiness';
import SyntheticQuarantineReviewPreview from './SyntheticQuarantineReviewPreview';
import {createSyntheticRestartDraft} from './synthetic-restart-handoff';
import {
 createSyntheticStorageFailureMatrix,acquireSyntheticStorageLease,
 inspectSyntheticStorageRecord,releaseSyntheticStorageLease,
 interruptSyntheticStorageRecovery,snapshotSyntheticStorageFailureMatrix,
 type SyntheticStorageLease
} from './synthetic-storage-failure-matrix';

type Fault='corrupt'|'conflict'|'exhaustion'|'repeated'|'stale';
type Step='acquire-a'|'acquire-b'|'acquire-b-stale'|'inspect-corrupt'|
 'inspect-valid'|'release-a'|'release-b'|'fail-a'|'fail-b';
const cases:Readonly<Record<Fault,{label:string;steps:readonly Step[]}>>={
 corrupt:{label:'Registro adulterado na recuperação',
  steps:['acquire-a','inspect-corrupt','release-a']},
 conflict:{label:'Duas sessões disputam o mesmo registro',
  steps:['acquire-a','acquire-b','release-a','acquire-b','inspect-valid','release-b']},
 exhaustion:{label:'Histórico ultrapassa oito tentativas',
  steps:['acquire-a',...Array.from({length:10},()=> 'inspect-valid' as const),'release-a']},
 repeated:{label:'Três falhas seguidas colocam registro em quarentena',
  steps:['acquire-a','fail-a','acquire-b','fail-b','acquire-a','fail-a','acquire-b']},
 stale:{label:'Sessão usa geração antiga',
  steps:['acquire-a','release-a','acquire-b-stale']}
};
const labels={
 none:'Nenhuma verificação','structural-copy-untrusted':'Cópia não confiável',
 'corrupt-record-rejected':'Registro corrompido recusado',
 'lease-conflict':'Conflito entre sessões',
 'stale-epoch':'Geração desatualizada',
 'recovery-interrupted':'Recuperação interrompida',
 quarantined:'Quarentena obrigatória','history-limit-reached':'Histórico no limite'
} as const;
export default function SyntheticStorageFailureMatrixPreview({record,readiness}:{record:SyntheticOrphanRecovery;readiness:SyntheticValidationReadiness}){
 const [scenario,setScenario]=useState<Fault>('corrupt');
 const [steps,setSteps]=useState(0);
 const draft=createSyntheticRestartDraft(record);
 const matrix=createSyntheticStorageFailureMatrix(draft);
 let a:SyntheticStorageLease|null=null,b:SyntheticStorageLease|null=null;
 let error='';
 const operations=cases[scenario].steps;
 for(const command of operations.slice(0,steps)){
  try{
   if(command==='acquire-a')a=acquireSyntheticStorageLease(matrix,'session-a',
    snapshotSyntheticStorageFailureMatrix(matrix).epoch);
   else if(command==='acquire-b')b=acquireSyntheticStorageLease(matrix,'session-b',
    snapshotSyntheticStorageFailureMatrix(matrix).epoch);
   else if(command==='acquire-b-stale')b=acquireSyntheticStorageLease(matrix,'session-b',0);
   else if(command==='inspect-valid'&&a)
    inspectSyntheticStorageRecord(matrix,a,JSON.parse(JSON.stringify(draft)));
   else if(command==='inspect-corrupt'&&a)
    inspectSyntheticStorageRecord(matrix,a,{...JSON.parse(JSON.stringify(draft)),operationsEnabled:true});
   else if(command==='release-a'&&a)releaseSyntheticStorageLease(matrix,a);
   else if(command==='release-b'&&b)releaseSyntheticStorageLease(matrix,b);
   else if(command==='fail-a'&&a)interruptSyntheticStorageRecovery(matrix,a);
   else if(command==='fail-b'&&b)interruptSyntheticStorageRecovery(matrix,b);
  }catch(e){error=e instanceof Error?e.message:'Transição fictícia inválida';}
 }
 const state=snapshotSyntheticStorageFailureMatrix(matrix);
 return <section className="synthetic-storage-matrix" role="region" aria-label="Matriz fictícia de falhas de armazenamento" data-native-lock="false" data-real-storage="false">
  <header>
   <div>
    <span className="eyebrow">MATRIZ DE FALHAS · SEM DISCO</span>
    <h6><ShieldAlert size={14} aria-hidden="true"/> E se o armazenamento falhar várias vezes?</h6>
    <p>Teste disputas, corrupção, histórico limitado e recuperação interrompida. Todos os registros são inventados e ficam apenas em memória.</p>
   </div><span className="synthetic-storage-matrix-locked"><LockKeyhole size={13} aria-hidden="true"/> Operações reais bloqueadas</span>
  </header>
  <label htmlFor="synthetic-storage-matrix-case">Cenário fictício
   <select id="synthetic-storage-matrix-case" value={scenario} onChange={e=>{setScenario(e.target.value as Fault);setSteps(0);}}>
    {(Object.keys(cases) as Fault[]).map(k=><option key={k} value={k}>{cases[k].label}</option>)}
   </select>
  </label>
  <div className="synthetic-storage-matrix-metrics" role="status" aria-live="polite">
   <div><small>Estado da matriz</small><strong data-testid="synthetic-matrix-phase">{state.quarantined?'Quarentena':state.leaseOwner?'Sessão em andamento':'Disponível'}</strong></div>
   <div><small>Falhas de recuperação</small><strong data-testid="synthetic-matrix-failures">{state.recoveryFailures}</strong></div>
   <div><small>Tentativas retidas</small><strong data-testid="synthetic-matrix-retained">{state.retainedAttempts.length}</strong></div>
   <div><small>Tentativas omitidas</small><strong data-testid="synthetic-matrix-dropped">{state.droppedAttempts}</strong></div>
  </div>
  <div className="synthetic-storage-matrix-actions">
   <button type="button" disabled={steps>=operations.length} onClick={()=>setSteps(n=>n+1)}>Executar falha ou etapa seguinte</button>
   <button type="button" disabled={steps===0} onClick={()=>setSteps(0)}>Reiniciar matriz fictícia</button>
  </div>
  <p className="synthetic-storage-matrix-progress" data-testid="synthetic-matrix-progress">Etapa {steps} de {operations.length} · Geração {state.epoch}</p>
  <p className="synthetic-storage-matrix-outcome" data-testid="synthetic-matrix-outcome">Último resultado: {labels[state.lastOutcome]}</p>
  {state.corruptionDetected&&<p className="synthetic-storage-matrix-warning" data-testid="synthetic-matrix-corrupt">A cópia corrompida foi rejeitada e não concedeu nenhuma permissão.</p>}
  {state.historyWindowExceeded&&<p className="synthetic-storage-matrix-warning" data-testid="synthetic-matrix-history">A janela de histórico excedeu oito entradas. Eventos antigos foram omitidos, sem se tornarem reutilizáveis.</p>}
  {state.quarantined&&<p className="synthetic-storage-matrix-warning" data-testid="synthetic-matrix-quarantined">Após três interrupções, novas sessões são recusadas neste modelo fictício.</p>}
  {error&&<p className="synthetic-storage-matrix-warning" data-testid="synthetic-matrix-error">{error}</p>}
  {(state.quarantined||state.corruptionDetected||state.historyWindowExceeded)&&state.leaseOwner===null&&<SyntheticQuarantineReviewPreview record={record} matrix={matrix} readiness={readiness}/>}
  <p className="synthetic-storage-matrix-guard">Nem o bloqueio, nem a corrupção, nem as falhas foram aplicados ao Windows. Não há journal persistente, proteção criptográfica ou validação real de arquivos. A reanálise permanece obrigatória.</p>
 </section>;
}
