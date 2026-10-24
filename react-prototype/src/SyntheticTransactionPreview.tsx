import {useState} from 'react';
import {DatabaseZap,LockKeyhole} from 'lucide-react';
import type {SyntheticOrphanRecovery} from './synthetic-orphan-recovery';
import {createSyntheticRestartDraft,type SyntheticRestartDraft} from './synthetic-restart-handoff';
import {
 createSyntheticTransactionStore,prepareSyntheticTransaction,
 markSyntheticTransactionCommitIntent,confirmSyntheticTransaction,
 simulateSyntheticTransactionPowerLoss,reconcileSyntheticTransactionAfterLoss,
 snapshotSyntheticTransactionStore,type SyntheticTransactionToken
} from './synthetic-transaction-store';

type Case='complete'|'before-intent'|'during-intent'|'after-commit'|'replay'|'fake'|'stale';
type Action='prepare'|'intent'|'commit'|'crash'|'recover'|'replay'|'fake'|'stale';
const cases:Readonly<Record<Case,{label:string;actions:readonly Action[]}>>={
 complete:{label:'Preparar e confirmar registro fictício',actions:['prepare','intent','commit']},
 'before-intent':{label:'Queda antes da intenção de gravação',actions:['prepare','crash','recover']},
 'during-intent':{label:'Queda durante confirmação',actions:['prepare','intent','crash','recover']},
 'after-commit':{label:'Queda após registro confirmado',actions:['prepare','intent','commit','crash','recover']},
 replay:{label:'Repetir confirmação usando token encerrado',actions:['prepare','intent','commit','replay']},
 fake:{label:'Tentar gravar uma cópia falsificada',actions:['fake']},
 stale:{label:'Exigir geração antiga após confirmação',actions:['prepare','intent','commit','stale']}
};
const phaseLabels={
 empty:'Sem registro confirmado',prepared:'Rascunho preparado',
 'commit-intent':'Confirmação pendente',recorded:'Registro fictício anotado',
 interrupted:'Interrupção detectada'
} as const;
const recoveryLabels={
 none:'Nenhuma conciliação', 'discarded-prepared':'Preparação descartada',
 'discarded-intent':'Intenção incompleta descartada',
 'retained-untrusted':'Registro anterior retido, sem confiança',
 'empty-untrusted':'Nenhuma conclusão recuperável'
} as const;
export default function SyntheticTransactionPreview({record}:{record:SyntheticOrphanRecovery}){
 const [scenario,setScenario]=useState<Case>('complete');
 const [steps,setSteps]=useState(0);
 const store=createSyntheticTransactionStore();
 const draft=createSyntheticRestartDraft(record);
 let token:SyntheticTransactionToken|null=null;
 let rejection:string|null=null;
 const scenarioSteps=cases[scenario].actions;
 for(const action of scenarioSteps.slice(0,steps)){
  try{
   if(action==='prepare')token=prepareSyntheticTransaction(store,draft,0);
   else if(action==='intent'&&token)markSyntheticTransactionCommitIntent(store,token);
   else if(action==='commit'&&token)confirmSyntheticTransaction(store,token);
   else if(action==='crash')simulateSyntheticTransactionPowerLoss(store);
   else if(action==='recover')reconcileSyntheticTransactionAfterLoss(store);
   else if(action==='replay'&&token)confirmSyntheticTransaction(store,token);
   else if(action==='fake')prepareSyntheticTransaction(store,{...draft} as SyntheticRestartDraft,0);
   else if(action==='stale')prepareSyntheticTransaction(store,createSyntheticRestartDraft(record),0);
  }catch(error){
   rejection=error instanceof Error?error.message:'Transição não reconhecida';
  }
 }
 const state=snapshotSyntheticTransactionStore(store);
 return <section className="synthetic-transaction" role="region" aria-label="Simulação de registro transacional" data-disk-access="false" data-transactions-real="false">
  <header>
   <div>
    <span className="eyebrow">JOURNAL FICTÍCIO · SOMENTE MEMÓRIA</span>
    <h6><DatabaseZap size={14} aria-hidden="true"/> E se uma gravação parasse pela metade?</h6>
    <p>O modelo separa preparar, solicitar confirmação e registrar uma conclusão declarativa. Nenhum dado é salvo no Windows.</p>
   </div>
   <span className="synthetic-transaction-locked"><LockKeyhole size={13} aria-hidden="true"/> Gravação real bloqueada</span>
  </header>
  <label htmlFor="synthetic-transaction-case">Falha a simular
   <select id="synthetic-transaction-case" value={scenario} onChange={v=>{setScenario(v.target.value as Case);setSteps(0);}}>
    {(Object.keys(cases) as Case[]).map(k=><option value={k} key={k}>{cases[k].label}</option>)}
   </select>
  </label>
  <div className="synthetic-transaction-metrics" role="status" aria-live="polite">
   <div><small>Estado do registro</small><strong data-testid="synthetic-transaction-phase">{phaseLabels[state.phase]}</strong></div>
   <div><small>Geração anotada</small><strong data-testid="synthetic-transaction-generation">{state.generation}</strong></div>
   <div><small>Conciliação da queda</small><strong data-testid="synthetic-transaction-recovery">{recoveryLabels[state.lastRecovery]}</strong></div>
   <div><small>Resultados antigos confiáveis</small><strong data-testid="synthetic-transaction-trusted">0</strong></div>
  </div>
  <div className="synthetic-transaction-actions">
   <button type="button" disabled={steps>=scenarioSteps.length} onClick={()=>setSteps(n=>n+1)}>Executar próxima etapa</button>
   <button type="button" disabled={steps===0} onClick={()=>setSteps(0)}>Reiniciar teste transacional</button>
  </div>
  <p className="synthetic-transaction-progress" data-testid="synthetic-transaction-progress">Etapas simuladas: {steps} de {scenarioSteps.length}</p>
  {rejection&&<p className="synthetic-transaction-warning" data-testid="synthetic-transaction-rejected">Transação recusada: {rejection}</p>}
  {state.discardedPending&&<p className="synthetic-transaction-warning" data-testid="synthetic-transaction-discarded">Gravação pendente descartada. Nenhuma confirmação parcial foi recuperada.</p>}
  {state.phase==='recorded'&&<p className="synthetic-transaction-warning" data-testid="synthetic-transaction-untrusted">Registro anotado apenas no modelo. Sua origem e integridade real não estão comprovadas e uma reanálise continua obrigatória.</p>}
  <p className="synthetic-transaction-guard">Sem journal persistente, sincronização em disco, assinatura criptográfica, reinicialização real ou acesso a mods. Um registro fictício nunca habilita instalação, remoção ou edição.</p>
 </section>;
}
