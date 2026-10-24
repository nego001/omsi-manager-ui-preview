import {useState} from 'react';
import {FileLock2,LockKeyhole} from 'lucide-react';
import type {SyntheticStreamDeclarationSource} from './synthetic-container-screen';
import {createSyntheticStreamReview} from './synthetic-stream-checkpoints';
import {
 createSyntheticReaderLifecycle,openSyntheticReaderLifecycle,stepSyntheticReaderLifecycle,
 cancelSyntheticReaderLifecycle,closeSyntheticReaderLifecycle,
 beginSyntheticReaderLifecycleClose,finishSyntheticReaderLifecycleClose,
 simulateSyntheticReaderLifecycleProcessLoss,acknowledgeSyntheticReaderLifecycleLoss,
 snapshotSyntheticReaderLifecycle
} from './synthetic-reader-lifecycle';
type Scenario='normal'|'cancel'|'early-close'|'error'|'process-loss'|'close-interruption'|'replay';
type Command='open'|'step'|'cancel'|'close'|'begin-close'|'finish-close'|'lose-process'|'acknowledge-loss'|'reopen';
const scenarios:Readonly<Record<Scenario,string>>={
 normal:'Abertura, etapas e fechamento completo',
 cancel:'Cancelar durante a leitura fictícia',
 'early-close':'Fechar antes de conferir todos os blocos',
 error:'Falha declarada e limpeza automática',
 'process-loss':'Perda inesperada do processo no meio do fluxo',
 'close-interruption':'Interrupção durante o fechamento em duas etapas',
 replay:'Tentativa de reutilizar uma sessão encerrada'
};
function data(source:SyntheticStreamDeclarationSource,scenario:Scenario){
 return source.entries.map((e,i)=>({
  entryOrdinal:e.ordinal,encodedBytes:e.encodedBytes,expandedBytes:e.expandedBytes,
  elapsedMs:scenario==='error'&&i===0?251:10,endOfEntry:true
 }));
}
const phaseLabels={
 created:'Ainda não aberto', 'simulated-open':'Aberto somente na simulação',
 'ready-to-close':'Todos os blocos conferidos; fechamento pendente',
 closing:'Fechamento iniciado, resultado ainda não publicado',
 interrupted:'Processo fictício perdido; recuperação pendente',
 closed:'Fechado'
} as const;
const reasonLabels={
 completed:'Encerrado após conferência fictícia completa',
 cancelled:'Cancelamento e descarte dos resultados',
 blocked:'Falha e descarte automático dos resultados',
 'closed-before-open':'Fechado sem abrir',
 'premature-close':'Fechamento antecipado: resultados descartados',
 'external-mutation':'Mudança externa da simulação detectada',
 'process-lost':'Perda simulada do processo; fechamento não confirmado',
 'close-interrupted':'Processo interrompido no meio do fechamento; nenhuma conclusão publicada'
} as const;
export default function SyntheticReaderLifecyclePreview({source}:{source:SyntheticStreamDeclarationSource}){
 const [scenario,setScenario]=useState<Scenario>('normal');
 const [actions,setActions]=useState<readonly Command[]>([]);
 // Replays numeric fixture metadata only. No OS handles are created by "open".
 const stream=createSyntheticStreamReview(source,data(source,scenario));
 const lifecycle=createSyntheticReaderLifecycle(stream);
 for(const cmd of actions){
  if(cmd==='open')openSyntheticReaderLifecycle(lifecycle);
  else if(cmd==='step')stepSyntheticReaderLifecycle(lifecycle);
  else if(cmd==='cancel')cancelSyntheticReaderLifecycle(lifecycle);
  else if(cmd==='begin-close')beginSyntheticReaderLifecycleClose(lifecycle);
  else if(cmd==='finish-close')finishSyntheticReaderLifecycleClose(lifecycle);
  else if(cmd==='lose-process')simulateSyntheticReaderLifecycleProcessLoss(lifecycle);
  else if(cmd==='acknowledge-loss')acknowledgeSyntheticReaderLifecycleLoss(lifecycle);
  else if(cmd==='reopen')openSyntheticReaderLifecycle(lifecycle);
  else closeSyntheticReaderLifecycle(lifecycle);
 }
 const current=snapshotSyntheticReaderLifecycle(lifecycle);
 const append=(action:Command)=>setActions(old=>[...old,action]);
 return <section className="synthetic-lifecycle" role="region" aria-label="Ciclo fictício do futuro leitor nativo" data-native-open="false" data-reader-enabled="false">
  <header><div>
   <span className="eyebrow">CICLO DE VIDA · SOMENTE MODELO EM MEMÓRIA</span>
   <h4>O leitor fecha e limpa tudo após uma falha?</h4>
   <p>Este teste demonstra estados de abertura, avanço, interrupção e fechamento obrigatório sem criar handles de arquivos reais.</p>
  </div><span className="synthetic-lifecycle-locked"><LockKeyhole size={13} aria-hidden="true"/> Sem acesso ao disco</span></header>
  <label htmlFor="synthetic-lifecycle-scenario">Cenário de ciclo fictício
   <select id="synthetic-lifecycle-scenario" value={scenario} onChange={e=>{
    setScenario(e.target.value as Scenario);setActions([]);
   }}>
    {(Object.keys(scenarios) as Scenario[]).map(key=><option value={key} key={key}>{scenarios[key]}</option>)}
   </select>
  </label>
  <div className="synthetic-lifecycle-metrics" role="status" aria-live="polite" aria-atomic="true">
   <div><small>Etapa simulada</small><strong data-testid="synthetic-lifecycle-phase">{phaseLabels[current.phase]}</strong></div>
   <div><small>Blocos conferidos</small><strong data-testid="synthetic-lifecycle-progress">{current.processedChunks} de {current.declaredChunks}</strong></div>
   <div><small>Limpeza do modelo</small><strong data-testid="synthetic-lifecycle-cleanup">{current.cleanupPerformed?'Concluída':'Pendente'}</strong></div>
   <div><small>Arquivos reais abertos</small><strong data-testid="synthetic-lifecycle-native-open">{current.nativeHandlesOpen}</strong></div>
  </div>
  <div className="synthetic-lifecycle-actions">
   <button type="button" onClick={()=>append('open')} disabled={current.phase!=='created'}><FileLock2 size={13} aria-hidden="true"/> Abrir sessão fictícia</button>
   <button type="button" onClick={()=>append('step')} disabled={current.phase!=='simulated-open'}>Avançar etapa de leitura fictícia</button>
   <button type="button" onClick={()=>append('begin-close')} disabled={current.phase!=='ready-to-close'}>Iniciar fechamento em duas etapas</button>
   <button type="button" onClick={()=>append('finish-close')} disabled={current.phase!=='closing'}>Concluir fechamento fictício</button>
   <button type="button" onClick={()=>append('lose-process')} disabled={current.phase==='closed'||current.phase==='interrupted'}>Simular perda do processo</button>
   <button type="button" onClick={()=>append('acknowledge-loss')} disabled={current.phase!=='interrupted'}>Reconhecer sessão abandonada</button>
   <button type="button" onClick={()=>append('reopen')} disabled={current.phase!=='closed'}>Tentar reabrir sessão encerrada</button>
   <button type="button" onClick={()=>append('cancel')} disabled={current.phase==='closed'||current.phase==='interrupted'}>Cancelar e limpar</button>
   <button type="button" onClick={()=>append('close')} disabled={current.phase==='closed'||current.phase==='interrupted'}>Fechar e limpar</button>
   <button type="button" onClick={()=>setActions([])}>Reiniciar ciclo</button>
  </div>
  {current.recoveryRequired&&<p className="synthetic-lifecycle-uncertain" data-testid="synthetic-lifecycle-recovery">A sessão foi interrompida na simulação. Não é possível confirmar que um handle real teria sido fechado. Nenhum resultado pode ser recuperado.</p>}
  {current.abandonedWithoutConfirmedClose&&<p className="synthetic-lifecycle-uncertain" data-testid="synthetic-lifecycle-unverified-cleanup">Fechamento não comprovado: reconhecer o abandono não equivale à limpeza de recursos do Windows.</p>}
  {actions.includes('reopen')&&current.phase==='closed'&&<p className="synthetic-lifecycle-uncertain" data-testid="synthetic-lifecycle-replay-denied">Reabertura recusada: a mesma sessão encerrada não pode ser reutilizada.</p>}
  {current.closeReason&&<p data-testid="synthetic-lifecycle-reason" className="synthetic-lifecycle-reason">{reasonLabels[current.closeReason]}</p>}
  {current.discardedPartialResults&&<p data-testid="synthetic-lifecycle-discarded" className="synthetic-lifecycle-reason">Nenhuma declaração foi publicada depois da interrupção. Totais parciais zerados.</p>}
  <p className="synthetic-lifecycle-guard">A limpeza é de contadores simulados, não de recursos do Windows. A execução real, o acesso ao sistema de arquivos e qualquer operação sobre mods continuam indisponíveis.</p>
 </section>;
}
