import {useState} from 'react';
import {FileSearch,LockKeyhole} from 'lucide-react';
import examples from './fixture-cross-package-examples.json';
import {buildFixtureTriage} from './fixture-diagnostic-guidance';
import {buildFixtureCoverage} from './fixture-evidence-coverage';
import {projectFixtureSlots} from './fixture-per-package-report';

// Static, CI-checked outputs from fixed Python in-memory ZIP fixtures.
// Never reads an actual mod or treats the selected catalog favorites as ZIPs.
type Example=(typeof examples)[number];
const kinds=[
 {id:'withinOwn',title:'Presente no próprio ZIP'},
 {id:'otherCandidate',title:'Candidato em um único outro ZIP'},
 {id:'ambiguous',title:'Ambíguo em vários ZIPs'},
 {id:'unresolved',title:'Não encontrado nos ZIPs do exemplo'},
 {id:'unsafe',title:'Caminho perigoso'},
 {id:'unsupported',title:'Formato de referência não suportado'},
] as const;

export default function FixtureCrossPackageLab(){
 const [selected,setSelected]=useState(examples[0].id);
 const [slot,setSlot]=useState(1);
 const example:Example=examples.find(item=>item.id===selected)??examples[0];
 const projection=projectFixtureSlots(example);
 const current=projection.reports.find(item=>item.slot===slot)??projection.reports[0];
 const triage=buildFixtureTriage(example);
 const coverage=buildFixtureCoverage(example);
 if(!examples.every(item=>item.fixtureCount>=2&&item.fixtureCount<=4))
  throw Error('FIXTURE_EXAMPLE_REPORT_INVALID');
 return <section className="cross-fixture-lab" role="region"
  aria-label="Comparação demonstrativa entre ZIPs" data-demo-only="true">
  <details>
   <summary>Comparar dependências em ZIPs fictícios</summary>
   <p>Exemplos pré-calculados, conferidos pela CI contra o leitor Python.
    Nenhum ZIP é aberto nesta tela. Os seus favoritos não participam da demonstração.</p>
   <label>Escolha o cenário fictício
    <select aria-label="Cenário de referências entre ZIPs" value={selected}
     onChange={event=>{setSelected(event.target.value);setSlot(1)}}>
     {examples.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
   </label>
   <div className="cross-fixture-results" role="status">
    <div className="cross-fixture-title"><FileSearch size={18} aria-hidden="true"/>
     <strong>{example.fixtureCount} pacotes fictícios · {example.declared} referências declaradas</strong>
    </div>
    <dl>
     {kinds.map(item=><div key={item.id}><dt>{item.title}</dt>
      <dd data-key={item.id}>{example[item.id]}</dd></div>)}
    </dl>
   </div>
   <section className="fixture-per-package" role="region" aria-label="Relatório individual de pacote fictício">
    <h3>Detalhes de cada pacote do cenário</h3>
    <p>Visão de um pacote por vez, baseada em contagens conferidas pelo leitor
     Python na CI. Pacotes reais e favoritos não participam desta análise.</p>
    <label>Pacote a detalhar
     <select aria-label="Escolher pacote fictício" value={String(current.slot)}
      onChange={event=>setSlot(Number(event.target.value))}>
      {projection.reports.map(item=><option key={item.slot} value={String(item.slot)}>
       Pacote fictício {item.slot}</option>)}
     </select>
    </label>
    <div className="fixture-per-package-status" role="status">
     <strong data-package-status={current.status}>Pacote fictício {current.slot} · {current.title}</strong>
     <p>{current.description}</p>
    </div>
    <dl>
     <div><dt>Fontes inspecionadas (somente no teste)</dt><dd data-slot-count="inspected">{current.inspectedSources}</dd></div>
     <div><dt>Fontes não inspecionadas</dt><dd data-slot-count="uninspected">{current.notInspectedSources}</dd></div>
     {kinds.map(item=><div key={item.id}><dt>{item.title}</dt>
      <dd data-slot-count={item.id}>{current.counts[item.id]}</dd></div>)}
    </dl>
    <small>Origem exclusiva: ZIPs de demonstração em memória, conferidos na CI.
     Nenhum formato, dependência, compatibilidade ou instalação real foi verificado.</small>
   </section>
   <section className="fixture-coverage" role="region" aria-label="Cobertura das evidências fictícias">
    <h3>O que foi observado e o que ainda falta?</h3>
    <p>Os testes Python conferiram a estrutura ZIP e o CRC das amostras inventadas.
     A correspondência de arquivos é apenas por nome, não por conteúdo válido.</p>
    <dl>
     <div><dt>Fontes de definição inspecionadas no exemplo</dt><dd data-coverage="inspected">{coverage.inspectedSources}</dd></div>
     <div><dt>Fontes não inspecionadas</dt><dd data-coverage="notInspected">{coverage.notInspectedSources}</dd></div>
     <div><dt>Correspondências nominais no ZIP de origem</dt><dd data-coverage="nominalMatches">{coverage.nominalMatches}</dd></div>
     <div><dt>Possíveis fornecedores em outros ZIPs</dt><dd data-coverage="candidates">{coverage.candidateReferences}</dd></div>
    </dl>
    {coverage.unknownReferencesPossible&&<p role="status">A análise está incompleta:
     arquivos de definição não inspecionados podem conter referências desconhecidas.
     Zero referências encontradas não significa ausência de dependências.</p>}
    <h4>Plano de verificação, não executável</h4>
    <ol>{coverage.actions.map(step=><li key={step.id} data-evidence-step={step.id}>
     <strong>{step.status==='ci-fixture-checked'?'Observado apenas na CI':
      step.status==='fixture-blocked'?'Recusado pelo teste':'Precisa de evidências'} · {step.text}</strong>
     <span>{step.reason}</span>
    </li>)}</ol>
    <p className="fixture-coverage-disclaimer">Nenhum arquivo real inspecionado.
     Compatibilidade e dependências reais não verificadas. Instalação bloqueada.</p>
   </section>
   <section className="fixture-triage" role="region" aria-label="Orientações do cenário fictício">
    <h3>Triagem demonstrativa · sem verificação real</h3>
    <p data-triage-summary={triage.state}>{triage.summary}</p>
    {triage.items.length>0&&<ol>
     {triage.items.map(step=><li key={step.category} data-diagnostic-kind={step.category}>
      <strong>{step.count} · {step.title}</strong>
      <span>{step.explanation}</span>
      <small>Verificação pendente: {step.nextCheck}</small>
     </li>)}
    </ol>}
    <p className="fixture-triage-origin">Origem: exemplos ZIP gerados na CI Python,
     reproduzidos por contagens estáticas. Nenhum mod do usuário foi analisado.</p>
   </section>
   <p className="synthetic-gate-warning"><LockKeyhole size={15} aria-hidden="true"/>
    Se dois ZIPs declaram o mesmo destino, o resultado é ambíguo e não escolhe
    um deles. Nenhuma referência candidata significa mod instalado ou dependência
    confirmada. Nenhuma leitura real, compatibilidade ou instalação foi autorizada.</p>
  </details>
 </section>;
}
