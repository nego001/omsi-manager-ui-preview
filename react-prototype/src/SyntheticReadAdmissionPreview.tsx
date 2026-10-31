import {useState} from 'react';
import SyntheticContainerScreenPreview from './SyntheticContainerScreenPreview';
import {LockKeyhole,ShieldAlert} from 'lucide-react';
import {
 assessSyntheticReadClaim,createSyntheticReadAdmissionSession,
 type AdmissionReason,type SyntheticReadClaim
} from './synthetic-read-admission';
import type {SyntheticValidationReadiness} from './synthetic-validation-readiness';
type Scenario='conservative'|'missing-consent'|'broader-scope'|'unsafe-path'|'exceeds-limits'|'cancelled'|'stale';
const reasonLabels:Readonly<Record<AdmissionReason,string>>={
 'invalid-contract':'Declaração fora do contrato',
 'foreign-session':'Sessão fictícia não emitida',
 'stale-revision':'Revisão anterior não pode ser reutilizada',
 'no-consent':'Consentimento declarado ausente',
 'revoked-consent':'Consentimento declarado revogado',
 'broad-scope':'Escopo mais amplo que um arquivo',
 'write-or-execute':'Execução ou escrita não são leitura',
 'unverified-containment':'Isolamento do caminho não demonstrado',
 'traversal-indicated':'Tentativa declarada de atravessar limites',
 'unsafe-links':'Links simbólicos ou junctions não rejeitados',
 'resource-limit':'Orçamento de recursos excedido',
 'cancelled':'Pedido cancelado',
 'missing-native-consent':'Consentimento nativo real não existe nesta prévia',
 'missing-native-confinement':'Confinamento do sistema de arquivos real não existe',
 'no-reader-backend':'Nenhum leitor de arquivos reais está conectado'
};
const labels:Readonly<Record<Scenario,string>>={
 conservative:'Declarações aparentemente adequadas',
 'missing-consent':'Sem consentimento',
 'broader-scope':'Escopo excessivo',
 'unsafe-path':'Caminho e links inseguros',
 'exceeds-limits':'Limites excedidos',
 cancelled:'Pedido cancelado',
 stale:'Revisão antiga'
};
function claim(revision:number,scenario:Scenario):SyntheticReadClaim{
 const base:SyntheticReadClaim={
  kind:'synthetic-read-proposal',revision,
  consent:'explicit-claim',selectedScope:'single-entry',requestedAction:'read-only',
  containment:'contained-claim',links:'reject-all-links',
  encodedBytes:1_000,expandedBytes:1_200,entries:1,depth:1,timeMs:50,cancelled:false
 };
 if(scenario==='missing-consent')return {...base,consent:'missing'};
 if(scenario==='broader-scope')return {...base,selectedScope:'unbounded',requestedAction:'write'};
 if(scenario==='unsafe-path')return {...base,containment:'traversal',links:'follow-links'};
 if(scenario==='exceeds-limits')return {...base,encodedBytes:2_000_001,expandedBytes:4_000_001,entries:129,depth:13,timeMs:5_001};
 if(scenario==='cancelled')return {...base,cancelled:true,consent:'revoked'};
 if(scenario==='stale')return {...base,revision:revision+1};
 return base;
}
export default function SyntheticReadAdmissionPreview({readiness}:{readiness:SyntheticValidationReadiness}){
 const [scenario,setScenario]=useState<Scenario>('conservative');
 const session=createSyntheticReadAdmissionSession(readiness);
 const result=assessSyntheticReadClaim(session,claim(readiness.revision,scenario));
 return <section className="synthetic-admission" role="region" aria-label="Simulação de bloqueio de leitura" data-access="denied" data-demo-only="true">
  <header>
   <div>
    <span className="eyebrow">CONTRATO DE LEITURA · NÃO CONECTADO</span>
    <h4>Uma declaração basta para ler um mod?</h4>
    <p>Não. Teste como as regras reagiriam a diferentes declarações fictícias. Nenhuma delas permite escolher, abrir, ler ou escrever um arquivo real.</p>
   </div>
   <span className="synthetic-admission-denied"><LockKeyhole size={14} aria-hidden="true"/> Acesso negado</span>
  </header>
  <label htmlFor="synthetic-read-scenario">Cenário de contrato
   <select id="synthetic-read-scenario" value={scenario} onChange={e=>setScenario(e.target.value as Scenario)}>
    {(Object.keys(labels) as Scenario[]).map(key=><option key={key} value={key}>{labels[key]}</option>)}
   </select>
  </label>
  <div className="synthetic-admission-stats" role="status" aria-live="polite" aria-atomic="true">
   <div><small>Situação do pedido</small><strong data-testid="synthetic-admission-state">Bloqueado</strong></div>
   <div><small>Bytes reais lidos</small><strong data-testid="synthetic-admission-bytes">{result.permittedReadBytes}</strong></div>
   <div><small>Regras que impedem o acesso</small><strong data-testid="synthetic-admission-count">{result.reasonCodes.length}</strong></div>
  </div>
  <p data-testid="synthetic-admission-consistency" className="synthetic-admission-context">
   {result.declarationConsistent?'Declarações coerentes no exemplo, mas sem prova nativa.':'Declarações do exemplo violam pelo menos uma regra de segurança.'}
  </p>
  <ul aria-label="Motivos do bloqueio de leitura" className="synthetic-admission-reasons">
   {result.reasonCodes.map(reason=><li data-reason={reason} key={reason}>
    <ShieldAlert size={14} aria-hidden="true"/>{reasonLabels[reason]}
   </li>)}
  </ul>
  <SyntheticContainerScreenPreview readiness={readiness}/>
  <p className="synthetic-admission-note">Este módulo não recebe caminhos, não abre seletores do sistema e não produz permissões ou tokens. Um futuro leitor nativo precisará validar consentimento, identidade e isolamento sem confiar nessas declarações.</p>
 </section>;
}
