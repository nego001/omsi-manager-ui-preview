import {useState} from 'react';
import {dependencyPreviewExample,projectDependencyObservation} from './omsi-dependency-report';
import {dependencyReviewGuidance} from './omsi-dependency-guidance';

export function OmsiDependencyPreview(){
 const [mode,setMode]=useState<'mixed'|'limited'|'empty'>('mixed');
 const example=dependencyPreviewExample(mode);
 const report=projectDependencyObservation(example);
 const guidance=dependencyReviewGuidance(example);
 return <section className="library-by-game" aria-label="Prévia de dependências OMSI" data-demo-only="true">
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
 </section>;
}
