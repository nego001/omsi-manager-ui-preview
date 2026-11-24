import {useState} from 'react';
import {dependencyPreviewExample,projectDependencyObservation} from './omsi-dependency-report';
import {dependencyReviewGuidance} from './omsi-dependency-guidance';

import type {OmsiConfigMetadata} from './inspection-types';
function ConfigMetadataSelection(){
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<OmsiConfigMetadata|null>(null);
 const available=typeof window.omsiPreview?.precheckOmsiConfig==='function';
 async function select(){
  if(!available||busy)return;
  setBusy(true);setResult(null);
  try{const r=await window.omsiPreview!.precheckOmsiConfig!();
   if(r.status==='config-metadata-observed'&&r.scope==='selected-file-metadata-only'&&
      ['bus-candidate','ovh-candidate','cfg-candidate'].includes(r.candidateKind)&&
      Number.isSafeInteger(r.byteCount)&&r.byteCount>=1&&r.byteCount<=65536&&
      r.contentOpened===false&&r.dependencyScanPerformed===false&&r.nativeIdentityVerified===false&&
      r.compatibilityVerified===false&&r.operationsEnabled===false)setResult(r);
   else if(r.status==='cancelled')setResult({status:'cancelled'});
   else setResult({status:'error',message:'Não foi possível conferir a configuração selecionada.'});
  }catch{setResult({status:'error',message:'Não foi possível conferir a configuração selecionada.'});}
  finally{setBusy(false);}
 }
 return <section className="library-by-game" aria-label="Seleção nativa de configuração OMSI">
  <h2>Pré-checagem de configuração local</h2>
  <p>Selecione um arquivo .bus, .ovh ou .cfg para conferir apenas o tipo candidato e o tamanho. O conteúdo e as dependências não são abertos.</p>
  <button type="button" className="btn secondary" disabled={!available||busy} onClick={()=>void select()}>{busy?'Conferindo metadados...':'Selecionar arquivo para pré-checagem'}</button>
  {!available&&<p>Seleção nativa disponível apenas no desktop compatível.</p>}
  {result?.status==='config-metadata-observed'&&<p role="status">{result.candidateKind==='bus-candidate'?'.bus':result.candidateKind==='ovh-candidate'?'.ovh':'.cfg'} · {result.byteCount} bytes · conteúdo não aberto.</p>}
  {result?.status==='cancelled'&&<p role="status">Seleção cancelada.</p>}
  {result?.status==='error'&&<p role="alert">{result.message}</p>}
 </section>;
}
export function OmsiDependencyPreview(){
 const [mode,setMode]=useState<'mixed'|'limited'|'empty'>('mixed');
 const example=dependencyPreviewExample(mode);
 const report=projectDependencyObservation(example);
 const guidance=dependencyReviewGuidance(example);
 return <><ConfigMetadataSelection/><section className="library-by-game" aria-label="Prévia de dependências OMSI" data-demo-only="true">
  <div className="library-by-game-heading"><h2>Diagnóstico de dependências OMSI</h2><span>DEMONSTRAÇÃO FICTÍCIA · somente leitura</span></div>
  <p>Exemplos de resultados possíveis da verificação de referências. Nenhum arquivo do seu jogo é aberto por esta tela.</p>
  <div className="library-toolbar">
   <label>Cenário de exemplo<select aria-label="Cenário de dependências fictícias" value={mode} onChange={e=>setMode(e.target.value as typeof mode)}>
    <option value="mixed">Referências variadas</option><option value="limited">Busca incompleta</option><option value="empty">Sem referências</option>
   </select></label>
   <button type="button" className="btn secondary" disabled>Selecionar configuração OMSI (bloqueado)</button>
  </div>
  {!report?<p role="alert">Resultado recusado pelo contrato de visualização.</p>:<div className="inspection-assessment" role="status">
   <strong>{{'no-evidence':'Sem evidência de referências',incomplete:'Busca incompleta — revisão necessária','exact-hints-only':'Somente indícios de nomes exatos','review-required':'Referências exigem revisão'}[report.state]}</strong>
   <span>{report.referenceOccurrences} ocorrências fictícias · {report.entriesScanned} entradas de exemplo</span>
   <ul className="inspection-notices">{report.rows.filter(row=>row.count>0).map(row=><li key={row.status}>{row.label}: {row.count}</li>)}</ul>
   {report.budgetLimited&&<small>Limite atingido. As referências não examinadas não podem ser classificadas como ausentes.</small>}
   <small>Compatibilidade não verificada. Resultados não autorizam instalação, correção ou restauração.</small>
  </div>}
  {guidance&&<section aria-label="Orientações fictícias de diagnóstico">
   <h3>Orientações para revisão</h3>
   <p>{guidance.conclusion}</p>
   {guidance.unexaminedKnownMarkers>0&&<p>Marcadores fora da análise: {guidance.unexaminedKnownMarkers}.</p>}
   <ul className="inspection-notices">{guidance.items.map(item=><li key={item.status}><strong>{item.title} · {item.count}</strong> — {item.detail}</li>)}</ul>
   <small>{guidance.notice} Orientações fictícias; nenhuma operação autorizada.</small>
  </section>}
 </section></>;
}
