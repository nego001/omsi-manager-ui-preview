import {useRef,useState} from 'react';
import {dependencyPreviewExample,projectDependencyObservation} from './omsi-dependency-report';
import {dependencyReviewGuidance} from './omsi-dependency-guidance';
import {projectConfigMetadata} from './omsi-config-metadata-view.mjs';
import {focusInspectionPanel} from './library-inspection-navigation';
import type {OmsiConfigMetadata} from './inspection-types';

function ConfigMetadataSelection({hasLocalInventory}:{hasLocalInventory:boolean}){
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<OmsiConfigMetadata|null>(null);
 const inFlight=useRef(false);
 const available=typeof window.omsiPreview?.precheckOmsiConfig==='function';
 async function select(){
  if(!available||inFlight.current)return;
  inFlight.current=true;setBusy(true);setResult(null);
  try{setResult(projectConfigMetadata(await window.omsiPreview!.precheckOmsiConfig!()));}
  catch{setResult(projectConfigMetadata(null));}
  finally{inFlight.current=false;setBusy(false);}
 }
 const observed=result?.status==='config-metadata-observed'?result:null;
 const extension=observed?.candidateKind==='bus-candidate'?'.bus':observed?.candidateKind==='ovh-candidate'?'.ovh':'.cfg';
 return <section className="library-by-game config-metadata-panel" aria-label="Seleção nativa de configuração OMSI">
  <div className="library-by-game-heading"><h2 id="local-config-metadata-heading" tabIndex={-1}>Pré-checagem de configuração local</h2><span className="config-metadata-tag">METADADOS LOCAIS · SOMENTE LEITURA</span></div>
  <p>Selecione um arquivo .bus, .ovh ou .cfg para conferir apenas o tipo candidato e o tamanho. O conteúdo e as dependências não são abertos.</p>
  <div className="inspection-panel-links" role="group" aria-label="Atalhos da pré-checagem">
   {hasLocalInventory&&<button type="button" className="btn secondary" onClick={()=>focusInspectionPanel('local')}>Voltar ao conteúdo local</button>}
   <button type="button" className="btn secondary" onClick={()=>focusInspectionPanel('demonstration')}>Ver demonstração de dependências</button>
  </div>
  <dl className="config-metadata-facts" aria-label="Limites da pré-checagem">
   <div><dt>Formatos aceitos</dt><dd>.bus / .ovh / .cfg</dd></div>
   <div><dt>Limite por arquivo</dt><dd>64 KiB</dd></div>
   <div><dt>Escopo</dt><dd>Um arquivo selecionado</dd></div>
  </dl>
  <div className="config-metadata-actions">
   <button type="button" className="btn secondary" disabled={!available||busy} onClick={()=>void select()}>{busy?'Conferindo metadados...':'Selecionar arquivo para pré-checagem'}</button>
   {result&&!busy&&<button type="button" className="btn secondary" onClick={()=>setResult(null)}>Limpar resultado da pré-checagem</button>}
  </div>
  {!available&&<p className="config-metadata-note">Seleção nativa disponível apenas no desktop compatível.</p>}
  {busy&&<p role="status" className="config-metadata-note">Aguardando seleção e conferência do arquivo.</p>}
  {observed&&<div className="config-metadata-result" aria-label="Resultado local">
   <p role="status">{extension} · {observed.byteCount} bytes · conteúdo não aberto.</p>
   <p>Tipo candidato identificado pela extensão. Nenhuma compatibilidade foi confirmada.</p>
  </div>}
  {result?.status==='cancelled'&&<p role="status" className="config-metadata-note">Seleção cancelada.</p>}
  {result?.status==='error'&&<p role="alert" className="config-metadata-note">{result.message}</p>}
  <p className="config-metadata-note">Diagnóstico de dependências, instalação e correção de mods reais continuam indisponíveis. Nenhum nome ou caminho é exibido.</p>
 </section>;
}
export function OmsiDependencyPreview({hasLocalInventory=false}:{hasLocalInventory?:boolean}){
 const [mode,setMode]=useState<'mixed'|'limited'|'empty'>('mixed');
 const example=dependencyPreviewExample(mode);
 const report=projectDependencyObservation(example);
 const guidance=dependencyReviewGuidance(example);
 return <><ConfigMetadataSelection hasLocalInventory={hasLocalInventory}/><section className="library-by-game config-demo-panel" aria-label="Prévia de dependências OMSI" data-demo-only="true">
  <div className="library-by-game-heading"><h2 id="omsi-dependency-demo-heading" tabIndex={-1}>Diagnóstico de dependências OMSI</h2><span>DEMONSTRAÇÃO FICTÍCIA · somente leitura</span></div>
  <p>Exemplos de resultados possíveis da verificação de referências. Nenhum arquivo do seu jogo é aberto por esta tela.</p>
  <div className="inspection-panel-links" role="group" aria-label="Atalhos do diagnóstico demonstrativo">
   {hasLocalInventory&&<button type="button" className="btn secondary" onClick={()=>focusInspectionPanel('local')}>Voltar ao conteúdo local</button>}
   <button type="button" className="btn secondary" onClick={()=>focusInspectionPanel('metadata')}>Voltar à pré-checagem OMSI</button>
  </div>
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
