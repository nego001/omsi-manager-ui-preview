import {test,expect} from '@playwright/test';
import {SYNTHETIC_MODULE_IDS,projectSyntheticSnapshot,type SyntheticModuleReport} from '../src/distributed-reader-contract';
import {simulateSyntheticScenario,SYNTHETIC_LIMITS} from '../src/synthetic-reader-scenarios';
const digest='e'.repeat(64);
function fixture(){
 return {
  fixtureDigest:digest,
  entries:[{path:'vehicles/demo.bus',kind:'file',encodedBytes:100,expandedBytes:400,declaredFormat:'well-formed'}],
  modules:SYNTHETIC_MODULE_IDS.filter(id=>id!=='container').map(moduleId=>({
   moduleId,simulatedDurationMs:70,
   report:{moduleId,contractVersion:1,fixtureDigest:digest,status:'ok',
    signals:moduleId==='structure'?[{game:'omsi',evidenceId:'tree'}]:
     moduleId==='definitions'?[{game:'omsi',evidenceId:'definition'}]:
     moduleId==='manifest'?[{game:'omsi',evidenceId:'manifest'}]:[]
   } as SyntheticModuleReport
  })),
  cancelAtMs:null as number|null
 };
}
test('corpus sintético identifica apenas candidato sem autorizar ações',()=>{
 const a=simulateSyntheticScenario(fixture());
 expect(a.status).toBe('complete');
 expect(a.snapshot.candidateGame).toBe('omsi');
 expect(a.completedModules).toHaveLength(8);
 expect(a.logicalElapsedMs).toBe(490);
 expect(a.realTimeMeasured).toBe(false);
 expect(a.realPackageRead).toBe(false);
 expect(a.operationsEnabled).toBe(false);
 expect(a.snapshot.compatibilityVerified).toBe(false);
 expect(projectSyntheticSnapshot(a.snapshot).installer.enabled).toBe(false);
});
test('ordem dos módulos entregue pelo fixture não altera resultado e ordem processada',()=>{
 const f=fixture();
 const x=simulateSyntheticScenario(f),y=simulateSyntheticScenario({...f,modules:[...f.modules].reverse()});
 expect(x).toEqual(y);
 expect(x.completedModules[0]).toBe('container');
 expect(Object.isFrozen(x.completedModules)).toBe(true);
});
test('formato malformado fictício é bloqueado antes de executar especialistas',()=>{
 const f=fixture();f.entries[0].declaredFormat='broken';
 const a=simulateSyntheticScenario(f);
 expect(a.status).toBe('blocked');expect(a.reason).toBe('malformed-entry');
 expect(a.logicalElapsedMs).toBe(0);expect(a.completedModules).toEqual([]);
 expect(a.snapshot.findings).toContain('gate-blocked');
});
test('caminhos perigosos são bloqueados no gate simulado',()=>{
 for(const path of ['../private/a.scs','/root/a.scs','C:\\Games\\mod.scs','a/./b','a//b','a/../b','CON.txt','a/\u0000b']){
  const f=fixture();f.entries[0].path=path;
  const a=simulateSyntheticScenario(f);
  expect(a.reason,path).toBe('unsafe-entry');
  expect(a.snapshot.evidence,path).toHaveLength(0);
 }
});
test('links e colisões case-insensitive são bloqueados',()=>{
 const f=JSON.parse(JSON.stringify(fixture()));
 f.entries[0].kind='symlink';
 expect(simulateSyntheticScenario(f).reason).toBe('unsafe-entry');
 f.entries[0].kind='file';
 f.entries.push({...f.entries[0],path:'VEHICLES/DEMO.BUS'});
 expect(simulateSyntheticScenario(f).reason).toBe('unsafe-entry');
});
test('razão de expansão fictícia muito alta não permite conclusão',()=>{
 const f=fixture();f.entries[0].encodedBytes=1;f.entries[0].expandedBytes=1000;
 const a=simulateSyntheticScenario(f);
 expect(a.reason).toBe('resource-limit');expect(a.snapshot.state).toBe('blocked');
});
test('limites de entradas, bytes, profundidade são fechados',()=>{
 const f=JSON.parse(JSON.stringify(fixture()));
 f.entries=Array.from({length:SYNTHETIC_LIMITS.entries+1},(_,i)=>({...f.entries[0],path:'x'+i}));
 expect(simulateSyntheticScenario(f).reason).toBe('invalid-fixture');
 const bytes=fixture();bytes.entries[0].encodedBytes=100_000;bytes.entries[0].expandedBytes=SYNTHETIC_LIMITS.expandedBytes+1;
 expect(simulateSyntheticScenario(bytes).reason).toBe('resource-limit');
 const deep=fixture();deep.entries[0].path='x/'.repeat(SYNTHETIC_LIMITS.depth)+'file';
 expect(simulateSyntheticScenario(deep).reason).toBe('unsafe-entry');
});
test('campos extras, negativos e frações do fixture são rejeitados',()=>{
 const f=JSON.parse(JSON.stringify(fixture()));f.entries[0].command='execute';
 expect(simulateSyntheticScenario(f).reason).toBe('invalid-fixture');
 const negative=fixture();negative.entries[0].encodedBytes=-1;
 expect(simulateSyntheticScenario(negative).reason).toBe('invalid-fixture');
 const decimal=fixture();decimal.modules[0].simulatedDurationMs=1.5;
 expect(simulateSyntheticScenario(decimal).reason).toBe('invalid-fixture');
});
test('estouro do limite individual de tempo virtual não vira sucesso',()=>{
 const f=fixture();f.modules[1].simulatedDurationMs=SYNTHETIC_LIMITS.moduleMs+1;
 const a=simulateSyntheticScenario(f);
 expect(a.status).toBe('timed-out');
 expect(a.reason).toBe('simulated-timeout');
 expect(a.logicalElapsedMs).toBe(670);
 expect(a.completedModules).not.toContain('manifest');
 expect(a.snapshot.candidateGame).toBeNull();
});
test('orçamento total virtual é aplicado mesmo com tarefas menores',()=>{
 const f=fixture();f.modules.forEach(m=>m.simulatedDurationMs=400);
 const a=simulateSyntheticScenario(f);
 expect(a.status).toBe('timed-out');
 expect(a.logicalElapsedMs).toBe(SYNTHETIC_LIMITS.totalMs);
 expect(a.completedModules).toHaveLength(7);
 expect(a.snapshot.state).toBe('incomplete');
});
test('cancelamento antes do primeiro especialista não libera processamento',()=>{
 const f=fixture();f.cancelAtMs=0;
 const a=simulateSyntheticScenario(f);
 expect(a.status).toBe('cancelled');
 expect(a.completedModules).toEqual(['container']);
 expect(a.snapshot.candidateGame).toBeNull();
});
test('cancelamento entre dois eventos mantém conclusão incompleta',()=>{
 const f=fixture();f.cancelAtMs=105;
 const a=simulateSyntheticScenario(f);
 expect(a.status).toBe('cancelled');
 expect(a.logicalElapsedMs).toBe(105);
 expect(a.completedModules).toEqual(['container','structure']);
 expect(a.snapshot.state).toBe('incomplete');
 expect(a.snapshot.candidateGame).toBeNull();
});
test('cancelamento posterior à conclusão não altera o resultado',()=>{
 const f=fixture();f.cancelAtMs=2000;
 expect(simulateSyntheticScenario(f).status).toBe('complete');
});
test('divergência ETS2/ATS permanece ambígua após análise fictícia',()=>{
 const f=fixture();const m=f.modules.find(m=>m.moduleId==='manifest')!;
 m.report={...m.report,signals:[{game:'ats',evidenceId:'claims-ats'}]};
 const a=simulateSyntheticScenario(f);
 expect(a.status).toBe('complete');
 expect(a.snapshot.state).toBe('ambiguous');
 expect(a.snapshot.candidateGame).toBeNull();
 expect(projectSyntheticSnapshot(a.snapshot).workshop.audioEnabled).toBe(false);
});
test('relatório falsificado e tentativa de inserir gate são rejeitados',()=>{
 const f=fixture();f.modules[0].report={...f.modules[0].report,fixtureDigest:'f'.repeat(64)};
 expect(simulateSyntheticScenario(f).snapshot.state).toBe('blocked');
 const duplicate=JSON.parse(JSON.stringify(fixture()));duplicate.modules.push({...duplicate.modules[0]});
 expect(simulateSyntheticScenario(duplicate).reason).toBe('invalid-fixture');
 const forged=JSON.parse(JSON.stringify(fixture()));
 forged.modules[0].moduleId='container';forged.modules[0].report.moduleId='container';
 expect(simulateSyntheticScenario(forged).reason).toBe('invalid-fixture');
});
test('módulo ausente preserva estado incompleto e Oficina/Instalador bloqueados',()=>{
 const f=fixture();f.modules=f.modules.filter(m=>m.moduleId!=='audio');
 const a=simulateSyntheticScenario(f);
 expect(a.status).toBe('incomplete');
 expect(a.reason).toBe('missing-module');
 expect(a.snapshot.candidateGame).toBeNull();
 expect(projectSyntheticSnapshot(a.snapshot).installer.enabled).toBe(false);
 expect(projectSyntheticSnapshot(a.snapshot).workshop.skinEnabled).toBe(false);
});
