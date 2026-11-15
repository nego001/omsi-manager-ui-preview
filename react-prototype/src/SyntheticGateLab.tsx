import {useMemo,useState} from 'react';
import {AlertTriangle,LockKeyhole,ShieldCheck} from 'lucide-react';
import {GATE_DEMO_PRESETS,runSyntheticGateDemo,type GateDemoPreset} from './synthetic-gate-presets';

const descriptions={
 'missing-module':'Índice fictício criado. Os especialistas ainda não analisaram nada.',
 'unsafe-entry':'A declaração contém caminho, link ou colisão de nomes que deve ser recusado.',
 'malformed-entry':'O exemplo declara uma estrutura malformada e não pode avançar.',
 'resource-limit':'O exemplo excede o limite fictício de expansão e não pode avançar.'
} as const;
export default function SyntheticGateLab(){
 const [preset,setPreset]=useState<GateDemoPreset>('regular');
 const result=useMemo(()=>runSyntheticGateDemo(preset),[preset]);
 const admitted=result.state==='index-created-review-incomplete';
 const explanation=descriptions[result.reason as keyof typeof descriptions]??
  'Não foi possível concluir a análise fictícia.';
 return <section className="synthetic-gate-lab" role="region"
  aria-label="Laboratório de pacotes fictícios" data-demo-only="true">
  <details>
   <summary>Experimentar verificações de segurança com pacotes fictícios</summary>
   <p>Escolha um cenário inventado para observar como o gate sintético reage.
    Isto não examina os favoritos, não abre mods e não comprova segurança real.</p>
   <label>Exemplo fictício
    <select aria-label="Escolher exemplo de pacote fictício" value={preset}
     onChange={e=>setPreset(e.target.value as GateDemoPreset)}>
     {GATE_DEMO_PRESETS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
   </label>
   <div className={'synthetic-gate-outcome '+(admitted?'incomplete':'rejected')}
    role="status" aria-live="polite">
    {admitted?<ShieldCheck size={19} aria-hidden="true"/>:
     <AlertTriangle size={19} aria-hidden="true"/>}
    <div>
     <strong>{admitted?'Índice fictício criado · análise incompleta':
      'Entrada fictícia recusada'}</strong>
     <p>{explanation}</p>
     <small>{result.indexedEntries} entrada(s) indexada(s) ·
      nenhum especialista real executado</small>
    </div>
   </div>
   <p className="synthetic-gate-warning"><LockKeyhole size={15} aria-hidden="true"/>
    Digest não verificado; nenhuma leitura real, compatibilidade confirmada
    ou instalação autorizada. Os limites exibidos são apenas de simulação.</p>
  </details>
 </section>;
}
