import {useState} from 'react';
import {FileSearch,LockKeyhole} from 'lucide-react';
import examples from './fixture-cross-package-examples.json';
import {buildFixtureTriage} from './fixture-diagnostic-guidance';

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
 const example:Example=examples.find(item=>item.id===selected)??examples[0];
 const triage=buildFixtureTriage(example);
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
     onChange={event=>setSelected(event.target.value)}>
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
