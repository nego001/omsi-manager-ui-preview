import {useState} from 'react';
import {LockKeyhole,ShieldAlert} from 'lucide-react';
import type {SyntheticQuarantineReview} from './synthetic-quarantine-review';
import type {SyntheticStorageFailureMatrix} from './synthetic-storage-failure-matrix';
import {snapshotSyntheticStorageFailureMatrix} from './synthetic-storage-failure-matrix';
import {
 createSyntheticNativeRecoveryBoundary,inspectSyntheticNativeRecoveryClaims,
 type SyntheticNativeProbe
} from './synthetic-native-recovery-boundary';

type Scenario='empty'|'all'|'identity'|'intent'|'stale'|'forged';
const labels:Readonly<Record<Scenario,string>>={
 empty:'Nenhuma comprovação apresentada',
 all:'Quatro declarações de sucesso (não autenticadas)',
 identity:'Identidade de arquivo não declarada',
 intent:'Confirmação de gravação incompleta',
 stale:'Relatório de geração desatualizada',
 forged:'Campo adicional tentando conceder permissão'
};
const statuses={
 'claim-rejected':'Registro com campos inválidos recusado',
 'review-invalidated':'A matriz mudou; revisão anterior invalidada',
 'stale-epoch':'Geração do relatório não corresponde',
 'incomplete-declarations':'Declarações incompletas: análise nativa pendente',
 'untrusted-declarations':'Todas declaradas, mas nenhuma verificada'
} as const;
export default function SyntheticNativeRecoveryBoundaryPreview({
 review,matrix
}:{review:SyntheticQuarantineReview;matrix:SyntheticStorageFailureMatrix}){
 const [scenario,setScenario]=useState<Scenario>('empty');
 const epoch=snapshotSyntheticStorageFailureMatrix(matrix).epoch;
 const base:SyntheticNativeProbe={
  schemaVersion:1,source:'synthetic-fixture',capturedEpoch:epoch,
  fileIdentity:'missing',journalDurability:'missing',
  freshByteAnalysis:'missing',userAuthorization:'missing'
 };
 const declared={...base,fileIdentity:'declared' as const,
  journalDurability:'declared' as const,freshByteAnalysis:'declared' as const,
  userAuthorization:'declared' as const};
 const probe:unknown=scenario==='all'?declared:
  scenario==='identity'?{...declared,fileIdentity:'missing'}:
  scenario==='intent'?{...declared,journalDurability:'missing'}:
  scenario==='stale'?{...declared,capturedEpoch:epoch+1}:
  scenario==='forged'?{...declared,operationsEnabled:true}:base;
 const boundary=createSyntheticNativeRecoveryBoundary(matrix,review);
 const result=inspectSyntheticNativeRecoveryClaims(boundary,probe);
 return <section className="synthetic-native-boundary" role="region"
  aria-label="Contrato de fronteira nativa fictícia"
  data-native-ready="false" data-operations-enabled="false">
  <header><div>
   <span className="eyebrow">FRONTEIRA NATIVA · CONTRATO SEM EXECUÇÃO</span>
   <h6><ShieldAlert size={14} aria-hidden="true"/> O que falta para recuperar arquivos de verdade?</h6>
   <p>Uma declaração de sucesso não substitui quatro verificações independentes. O laboratório não usa sistema de arquivos, IPC ou permissões reais.</p>
  </div><span className="synthetic-native-boundary-locked"><LockKeyhole size={13} aria-hidden="true"/> Bloqueado</span></header>
  <label htmlFor="synthetic-native-boundary-case">Cenário do contrato nativo fictício
   <select id="synthetic-native-boundary-case" value={scenario}
    onChange={e=>setScenario(e.target.value as Scenario)}>
    {(Object.keys(labels) as Scenario[]).map(x=><option key={x} value={x}>{labels[x]}</option>)}
   </select>
  </label>
  <div className="synthetic-native-boundary-gates" aria-label="Quatro verificações nativas pendentes">
   {result.gates.map(gate=><article key={gate.id} data-gate={gate.id} data-native-verified="false">
    <small>{gate.label}</small>
    <strong>{gate.claimed?'Declarada · não verificada':'Não declarada · não verificada'}</strong>
    <p>{gate.requirement}</p>
   </article>)}
  </div>
  <p className="synthetic-native-boundary-status" role="status" data-testid="synthetic-native-boundary-status">
   {statuses[result.status]} · {result.declaredGates} de 4 declarações informadas
  </p>
  <p className="synthetic-native-boundary-notice" data-testid="synthetic-native-boundary-notice">
   Nenhuma declaração equivale a identidade comprovada, gravação durável, reanálise real ou autorização. Instalar, remover, editar e atualizar mods continuam bloqueados.
  </p>
 </section>;
}
