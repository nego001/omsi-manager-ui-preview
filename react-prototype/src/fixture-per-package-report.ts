// Per-package count-only projections for fixed, CI-matched ZIP fixtures.
// This file NEVER reads files, imports a ZIP parser, uses IPC or grants writes.
import {buildFixtureCoverage,type FixtureCoverageInput} from './fixture-evidence-coverage';

type Category='withinOwn'|'otherCandidate'|'ambiguous'|'unresolved'|'unsafe'|'unsupported';
const categories:readonly Category[]=['withinOwn','otherCandidate','ambiguous','unresolved','unsafe','unsupported'];
export type PerFixtureSlot=Readonly<Omit<FixtureCoverageInput,'fixtureCount'>&{slot:number}>;
export type PerFixtureScenario=FixtureCoverageInput&Readonly<{slots:readonly PerFixtureSlot[]}>;
export type PerFixtureStatus='fixture-path-refused'|'inspection-incomplete'|
 'needs-human-review'|'nominal-match-only'|'no-known-references'|'no-definition-sources';
export type PerFixtureReport=Readonly<{
 slot:number;status:PerFixtureStatus;
 title:string;description:string;
 inspectedSources:number;notInspectedSources:number;
 counts:Readonly<Record<Category,number>>;
 verification:'test-fixture-only';
 checkedRealFiles:false;dependenciesVerified:false;compatibilityVerified:false;canInstall:false;
}>;
export type PerFixtureProjection=Readonly<{
 origin:'memory-zip-fixtures-ci';reports:readonly PerFixtureReport[];
 allSlotsCovered:true;realPackagesRead:false;installationEnabled:false;
}>;
export function projectFixtureSlots(example:PerFixtureScenario):PerFixtureProjection{
 // Validate top-level counts and source coverage independently of each slot.
 const total=buildFixtureCoverage(example);
 if(!Array.isArray(example.slots)||example.slots.length!==example.fixtureCount)
  throw Error('FIXTURE_SLOTS_INVALID');
 const reports=example.slots.map((slot,i)=>{
  if(!slot||!Number.isSafeInteger(slot.slot)||slot.slot!==i+1)
   throw Error('FIXTURE_SLOTS_INVALID');
  const scope=buildFixtureCoverage({...slot,fixtureCount:example.fixtureCount});
  const status:PerFixtureStatus=
   slot.unsafe>0?'fixture-path-refused':
   slot.notInspectedSources>0?'inspection-incomplete':
   slot.ambiguous>0||slot.unresolved>0||slot.otherCandidate>0||slot.unsupported>0?
    'needs-human-review':
   slot.withinOwn>0?'nominal-match-only':
   slot.inspectedSources>0?'no-known-references':'no-definition-sources';
  const descriptions:Record<PerFixtureStatus,[string,string]>={
   'fixture-path-refused':['Referência recusada pelo laboratório',
    'Há caminhos não aceitos neste exemplo. Não constitui diagnóstico de malware.'],
   'inspection-incomplete':['Inspeção textual incompleta',
    'Pelo menos uma definição não foi lida. Outras referências podem existir.'],
   'needs-human-review':['Referências pendentes de confirmação',
    'A comparação nominal não determina dependências nem ordem de carregamento.'],
   'nominal-match-only':['Apenas correspondências internas de nome',
    'Encontrar o nome não comprova a integridade do conteúdo encontrado.'],
   'no-known-references':['Sem referências reconhecidas neste exemplo',
    'O parser de teste é limitado; ausência de marcador não comprova ausência de dependências.'],
   'no-definition-sources':['Sem definições textuais neste pacote fictício',
    'Este pacote não possui fontes .bus/.cfg inspecionáveis no cenário inventado.']
  };
  const [title,description]=descriptions[status];
  return Object.freeze({
   slot:slot.slot,status,title,description,
   inspectedSources:scope.inspectedSources,
   notInspectedSources:scope.notInspectedSources,
   counts:Object.freeze(Object.fromEntries(categories.map(key=>[key,slot[key]])) as Record<Category,number>),
   verification:'test-fixture-only' as const,
   checkedRealFiles:false as const,dependenciesVerified:false as const,
   compatibilityVerified:false as const,canInstall:false as const
  });
 });
 for(const key of [...categories,'inspectedSources','notInspectedSources'] as const){
  if(example.slots.reduce((sum,slot)=>sum+slot[key],0)!==example[key])
   throw Error('FIXTURE_SLOTS_INVALID');
 }
 if(reports.some(x=>x.checkedRealFiles||x.canInstall||
    x.dependenciesVerified||x.compatibilityVerified)||
    total.realFilesInspected||total.installAllowed)
  throw Error('FIXTURE_SLOTS_INVALID');
 return Object.freeze({
  origin:'memory-zip-fixtures-ci' as const,reports:Object.freeze(reports),
  allSlotsCovered:true as const,realPackagesRead:false as const,
  installationEnabled:false as const
 });
}
