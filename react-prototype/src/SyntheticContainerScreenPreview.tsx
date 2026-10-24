import {useState} from 'react';
import {FileArchive,LockKeyhole} from 'lucide-react';
import SyntheticStreamCheckpointPreview from './SyntheticStreamCheckpointPreview';
import type {SyntheticValidationReadiness} from './synthetic-validation-readiness';
import {createSyntheticReadAdmissionSession} from './synthetic-read-admission';
import {
 createSyntheticContainerReview,advanceSyntheticContainerReview,
 cancelSyntheticContainerReview,snapshotSyntheticContainerReview,
 type ContainerBlockReason,type SyntheticContainerFormat
} from './synthetic-container-screen';
type Entry={path:string;kind:'file'|'directory'|'symlink'|'hardlink';
 compression:'stored'|'deflate'|'unknown';encodedBytes:number;expandedBytes:number};
type Scenario='zip'|'scs'|'traversal'|'symlink'|'bomb'|'duplicate'|'unsupported'|'cancel';
const file=(path:string,expandedBytes=1000,encodedBytes=400):Entry=>({
 path,kind:'file',compression:'deflate',encodedBytes,expandedBytes
});
const scenarios:Readonly<Record<Scenario,{label:string;format:SyntheticContainerFormat;entries:readonly Entry[]}>>={
 zip:{label:'ZIP com declarações comuns',format:'zip-declared',entries:[file('Vehicles/demo.bus'),file('Textures/paint.dds')]},
 scs:{label:'SCS declarado no formato ZIP',format:'scs-zip-declared',entries:[file('def/engine.sii'),file('sound/engine.ogg')]},
 traversal:{label:'Tentativa de atravessar diretórios',format:'zip-declared',entries:[file('Vehicles/demo.bus'),file('../outside.txt')]},
 symlink:{label:'Link simbólico declarado',format:'zip-declared',entries:[file('def/settings.sii'),{...file('def/junction'),kind:'symlink'}]},
 bomb:{label:'Expansão excessiva declarada',format:'scs-zip-declared',entries:[file('def/base.sii'),file('sound/bomb.ogg',200000,1)]},
 duplicate:{label:'Nomes duplicados com letras diferentes',format:'zip-declared',entries:[file('Vehicles/demo.bus'),file('vehicles/DEMO.BUS')]},
 unsupported:{label:'SCS proprietário desconhecido',format:'scs-proprietary-declared',entries:[file('def/engine.sii')]},
 cancel:{label:'Cancelamento entre etapas',format:'zip-declared',entries:[file('Vehicles/demo.bus'),file('Textures/demo.dds'),file('sound/demo.ogg')]}
};
const labels:Readonly<Record<ContainerBlockReason,string>>={
 'invalid-fixture':'Catálogo declarado fora do contrato',
 'resource-limit':'Limite de expansão ou tamanho declarado excedido',
 'unsafe-path':'Caminho declarado potencialmente perigoso',
 'duplicate-entry':'Dois nomes declarados entram em conflito',
 'file-directory-collision':'Arquivo declarado conflita com diretório',
 'unsafe-link':'Links simbólicos ou rígidos não são aceitos',
 'unsupported-compression':'Método de compressão não suportado',
 'unsupported-container':'Formato SCS proprietário exige um parser específico e auditado',
 cancelled:'A simulação foi cancelada'
};
const statusLabel={
 pending:'Pendente de análise declarativa',
 'declarations-reviewed':'Declarações percorridas, sem verificação real',
 blocked:'Bloqueado',
 cancelled:'Cancelado'
} as const;
export default function SyntheticContainerScreenPreview({readiness}:{readiness:SyntheticValidationReadiness}){
 const [scenario,setScenario]=useState<Scenario>('zip');
 const [steps,setSteps]=useState(0);
 const [cancelled,setCancelled]=useState(false);
 // Rebuild only a FAKE in-memory catalogue; no browser file picker or native APIs.
 const sample=scenarios[scenario];
 const session=createSyntheticReadAdmissionSession(readiness);
 const handle=createSyntheticContainerReview(session,{format:sample.format,entries:sample.entries.map(e=>({...e}))});
 for(let i=0;i<steps;i++)advanceSyntheticContainerReview(handle);
 if(cancelled)cancelSyntheticContainerReview(handle);
 const result=snapshotSyntheticContainerReview(handle);
 const done=result.status!=='pending';
 return <section className="synthetic-container" role="region" aria-label="Triagem fictícia de arquivos ZIP e SCS" data-demo-only="true" data-real-read="false">
  <header><div>
   <span className="eyebrow">CATÁLOGO FICTÍCIO · NENHUM ARQUIVO ABERTO</span>
   <h4>Como o leitor trataria entradas ZIP/SCS?</h4>
   <p>Simulação passo a passo de nomes, links, expansão e interrupção. Os metadados são inventados e não representam um pacote ZIP/SCS real.</p>
  </div><span className="synthetic-container-denied"><LockKeyhole size={13} aria-hidden="true"/> Leitura real desativada</span></header>
  <label htmlFor="synthetic-container-scenario">Escolher situação fictícia
   <select id="synthetic-container-scenario" value={scenario} onChange={e=>{
    setScenario(e.target.value as Scenario);setSteps(0);setCancelled(false);
   }}>
    {(Object.keys(scenarios) as Scenario[]).map(id=><option key={id} value={id}>{scenarios[id].label}</option>)}
   </select>
  </label>
  <div className="synthetic-container-counts" role="status" aria-live="polite" aria-atomic="true">
   <div><small>Estado da simulação</small><strong data-testid="synthetic-container-status">{statusLabel[result.status]}</strong></div>
   <div><small>Entradas declaradas percorridas</small><strong data-testid="synthetic-container-progress">{result.processed} de {result.declaredEntries}</strong></div>
   <div><small>Bytes reais acessados</small><strong data-testid="synthetic-container-bytes">{result.bytesRead}</strong></div>
  </div>
  <div className="synthetic-container-controls">
   <button type="button" onClick={()=>setSteps(n=>n+1)} disabled={done}>
    <FileArchive size={14} aria-hidden="true"/> Verificar próxima declaração
   </button>
   <button type="button" onClick={()=>setCancelled(true)} disabled={done}>Cancelar simulação</button>
   <button type="button" onClick={()=>{setSteps(0);setCancelled(false);}}>Reiniciar exemplo</button>
  </div>
  {result.reason&&<p className="synthetic-container-reason" data-testid="synthetic-container-reason">{labels[result.reason]}</p>}
  {result.status==='declarations-reviewed'&&<p className="synthetic-container-explainer">O catálogo inventado passou somente pelos testes declarativos. Não há aprovação de arquivo, jogo ou instalação.</p>}
  {result.status==='declarations-reviewed'&&<SyntheticStreamCheckpointPreview key={scenario} review={handle} readiness={readiness}/>}
  <p className="synthetic-container-guard">Mesmo que o catálogo fictício termine sem alertas, nenhuma entrada real foi lida, nenhum caminho foi resolvido no Windows e nenhum arquivo foi descompactado. Permissões de leitura e operações permanecem bloqueadas.</p>
 </section>;
}
