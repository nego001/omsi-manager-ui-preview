import {useState} from 'react';
import {LockKeyhole,PackageSearch} from 'lucide-react';
import SyntheticReaderLifecyclePreview from './SyntheticReaderLifecyclePreview';
import {
 issueSyntheticStreamDeclarationSource,type SyntheticContainerReview,
 type SyntheticStreamDeclarationSource
} from './synthetic-container-screen';
import {
 createSyntheticStreamReview,advanceSyntheticStreamReview,cancelSyntheticStreamReview,
 snapshotSyntheticStreamReview,type SyntheticStreamFailure
} from './synthetic-stream-checkpoints';

type StreamScenario='normal'|'inflation'|'truncated'|'reordered'|'slow'|'cancel';
const labels:Readonly<Record<StreamScenario,string>>={
 normal:'Blocos declarados consistentes',
 inflation:'Expansão exagerada em um bloco',
 truncated:'Fluxo interrompido antes da última entrada',
 reordered:'Blocos fora da ordem declarada',
 slow:'Tempo declarado acima do limite',
 cancel:'Cancelar no meio de uma entrada'
};
const failureLabels:Readonly<Record<SyntheticStreamFailure,string>>={
 'invalid-chunk':'Bloco declarado fora do contrato',
 'chunk-limit':'Quantidade de blocos declarados excedida',
 'size-mismatch':'Tamanho do bloco não corresponde à declaração',
 'entry-order':'Blocos fora da ordem do catálogo',
 'resource-limit':'Orçamento de tamanho ou expansão excedido',
 'time-limit':'Limite de tempo declarado excedido',
 'truncated-stream':'Fluxo incompleto: resultados parciais descartados',
 cancelled:'Fluxo cancelado: resultados parciais descartados'
};
type Chunk={entryOrdinal:number;encodedBytes:number;expandedBytes:number;
 elapsedMs:number;endOfEntry:boolean};
function fixture(source:SyntheticStreamDeclarationSource,scenario:StreamScenario):Chunk[]{
 const all=source.entries.map(entry=>({
  entryOrdinal:entry.ordinal,encodedBytes:entry.encodedBytes,
  expandedBytes:entry.expandedBytes,elapsedMs:15,endOfEntry:true
 }));
 if(!all.length)return [];
 const first=all[0];
 if(scenario==='inflation')return [{...first,encodedBytes:1,expandedBytes:65_536}];
 if(scenario==='truncated')return [first];
 if(scenario==='reordered')return [{...first,entryOrdinal:source.entries[source.entries.length-1].ordinal+1}];
 if(scenario==='slow')return [{...first,elapsedMs:251}];
 if(scenario==='cancel'){
  const halfEncoded=Math.floor(first.encodedBytes/2);
  const halfExpanded=Math.floor(first.expandedBytes/2);
  return [
   {...first,encodedBytes:halfEncoded,expandedBytes:halfExpanded,endOfEntry:false},
   {...first,encodedBytes:first.encodedBytes-halfEncoded,
    expandedBytes:first.expandedBytes-halfExpanded},
   ...all.slice(1)
  ];
 }
 return all;
}
export default function SyntheticStreamCheckpointPreview({review}:{review:SyntheticContainerReview}){
 const [scenario,setScenario]=useState<StreamScenario>('normal');
 const [steps,setSteps]=useState(0);
 const [cancelled,setCancelled]=useState(false);
 // Issued only after a legitimate COMPLETE, synthetic container screen.
 const source=issueSyntheticStreamDeclarationSource(review);
 const handle=createSyntheticStreamReview(source,fixture(source,scenario));
 for(let i=0;i<steps;i++)advanceSyntheticStreamReview(handle);
 if(cancelled)cancelSyntheticStreamReview(handle);
 const result=snapshotSyntheticStreamReview(handle);
 const terminal=result.status!=='pending';
 return <section className="synthetic-stream" role="region" aria-label="Simulação de blocos em fluxo" data-synthetic-only="true" data-reader-enabled="false">
  <header><div>
   <span className="eyebrow">BLOCOS FICTÍCIOS · RESULTADOS PARCIAIS ISOLADOS</span>
   <h4>O que acontece se o fluxo parar no meio?</h4>
   <p>Os blocos contêm apenas números inventados de bytes e duração. Cada avanço confere um bloco, seus limites acumulados e a ordem das entradas declaradas.</p>
  </div><span className="synthetic-stream-lock"><LockKeyhole size={13} aria-hidden="true"/> Sem leitura real</span></header>
  <label htmlFor="synthetic-stream-scenario">Situação dos blocos fictícios
   <select id="synthetic-stream-scenario" value={scenario} onChange={e=>{
    setScenario(e.target.value as StreamScenario);setSteps(0);setCancelled(false);
   }}>
    {(Object.keys(labels) as StreamScenario[]).map(id=><option key={id} value={id}>{labels[id]}</option>)}
   </select>
  </label>
  <div className="synthetic-stream-metrics" role="status" aria-live="polite" aria-atomic="true">
   <div><small>Situação declarativa</small><strong data-testid="synthetic-stream-status">
    {result.status==='pending'?'Pendente':result.status==='declarations-reviewed'?'Metadados conferidos':
     result.status==='cancelled'?'Cancelado':'Bloqueado'}
   </strong></div>
   <div><small>Blocos simulados</small><strong data-testid="synthetic-stream-progress">{result.processedChunks} de {result.totalDeclaredChunks}</strong></div>
   <div><small>Resultados completos liberados</small><strong data-testid="synthetic-stream-released">{result.releasedEntries}</strong></div>
   <div><small>Bytes reais lidos</small><strong data-testid="synthetic-stream-real-bytes">{result.realBytesRead}</strong></div>
  </div>
  <div className="synthetic-stream-actions">
   <button type="button" disabled={terminal} onClick={()=>setSteps(n=>n+1)}><PackageSearch size={13} aria-hidden="true"/> Conferir próximo bloco</button>
   <button type="button" disabled={terminal} onClick={()=>setCancelled(true)}>Interromper fluxo</button>
   <button type="button" onClick={()=>{setSteps(0);setCancelled(false);}}>Reiniciar fluxo fictício</button>
  </div>
  {result.failure&&<p className="synthetic-stream-warning" data-testid="synthetic-stream-failure">{failureLabels[result.failure]}</p>}
  {result.discardedPartialResults&&<p className="synthetic-stream-warning" data-testid="synthetic-stream-discarded">Todos os resultados parciais foram descartados; nenhuma entrada foi publicada.</p>}
  {result.status==='declarations-reviewed'&&<p className="synthetic-stream-success">Somente as contagens fictícias fecharam. Integridade, conteúdo e formato reais continuam sem verificação.</p>}
  <SyntheticReaderLifecyclePreview source={source}/>
  <p className="synthetic-stream-guard">Nenhum bloco contém bytes de um arquivo real, nenhum descompressor foi executado e nenhuma ação sobre mods foi autorizada. O tempo mostrado é declarado, não um limite aplicado a CPU ou disco.</p>
 </section>;
}
