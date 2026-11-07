// Deterministic, entirely in-memory package-gate examples.
// Never uses an archive, filesystem, IPC, network or a real mod's content.
import {simulateSyntheticScenario,type ScenarioReason} from './synthetic-reader-scenarios';

export const GATE_DEMO_PRESETS=Object.freeze([
 {id:'regular',label:'Estrutura fictícia regular'},
 {id:'traversal',label:'Caminho tentando sair do pacote'},
 {id:'symlink',label:'Link simbólico'},
 {id:'collision',label:'Nomes duplicados com letras diferentes'},
 {id:'expansion',label:'Expansão excessiva'},
 {id:'broken',label:'Formato declarado malformado'}
] as const);
export type GateDemoPreset=typeof GATE_DEMO_PRESETS[number]['id'];
export type GateDemoResult=Readonly<{
 preset:GateDemoPreset;
 state:'index-created-review-incomplete'|'rejected';
 reason:ScenarioReason;
 indexedEntries:number;
 gateSimulatedOnly:true;
 specialistsActuallyRun:0;
 realPackageRead:false;
 realDigestVerified:false;
 installationVerified:false;
 compatibilityVerified:false;
 operationsEnabled:false;
}>;
type ExampleEntry={
 path:string;kind:'file'|'directory'|'symlink';
 encodedBytes:number;expandedBytes:number;
 declaredFormat:'well-formed'|'broken';
};
const sample=(path:string):ExampleEntry=>({
 path,kind:'file',encodedBytes:100,expandedBytes:250,declaredFormat:'well-formed'
});
function declarations(id:GateDemoPreset):ExampleEntry[]{
 switch(id){
  case 'regular':return [
   sample('vehicles/demo.bus'),sample('audio/demo.wav'),sample('maps/demo.cfg')
  ];
  case 'traversal':return [sample('../outside/private.bus')];
  case 'symlink':return [{...sample('vehicles/shortcut.bus'),kind:'symlink'}];
  case 'collision':return [sample('vehicles/a.bus'),sample('VEHICLES/A.BUS')];
  case 'expansion':return [{...sample('mod/oversized.scs'),
   encodedBytes:1,expandedBytes:250}];
  case 'broken':return [{...sample('vehicles/broken.bus'),declaredFormat:'broken'}];
 }
}
export function runSyntheticGateDemo(preset:GateDemoPreset):GateDemoResult{
 if(!GATE_DEMO_PRESETS.some(p=>p.id===preset))
  throw Error('GATE_DEMO_PRESET_REFUSED');
 // Fixture digest is a declared marker, NOT a computed hash.
 const state=simulateSyntheticScenario({
  fixtureDigest:'a'.repeat(64),entries:declarations(preset),
  modules:[],cancelAtMs:null
 });
 if(state.realPackageRead!==false||state.operationsEnabled!==false||
    state.snapshot.digestVerified!==false||
    state.snapshot.compatibilityVerified!==false||
    state.snapshot.installationVerified!==false)
  throw Error('GATE_DEMO_CONTRACT_REFUSED');
 const accepted=preset==='regular';
 if(accepted?state.status!=='incomplete'||state.reason!=='missing-module'||
   !state.index||state.completedModules.join(',')!=='container':
   state.status!=='blocked'||state.index!==null||
   state.completedModules.length!==0)
  throw Error('GATE_DEMO_CONTRACT_REFUSED');
 return Object.freeze({
  preset,state:accepted?'index-created-review-incomplete' as const:'rejected' as const,
  reason:state.reason,indexedEntries:state.index?.entryCount??0,
  gateSimulatedOnly:true as const,specialistsActuallyRun:0 as const,
  realPackageRead:false as const,realDigestVerified:false as const,
  installationVerified:false as const,compatibilityVerified:false as const,
  operationsEnabled:false as const
 });
}
