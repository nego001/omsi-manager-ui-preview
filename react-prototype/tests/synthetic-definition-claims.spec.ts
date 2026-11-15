import {test,expect} from '@playwright/test';
import {
 buildSyntheticPackageIndex,projectSyntheticIndex,issueSyntheticRevisionTicket,
 type SyntheticPackageIndex
} from '../src/synthetic-package-index';
import {
 validateSyntheticDefinitionClaims,type SyntheticDefinitionMarker
} from '../src/synthetic-definition-claims';
import {deriveSyntheticStructureHints} from '../src/synthetic-structure-hints';
import {runSyntheticIndexedWorkers} from '../src/synthetic-index-workers';
import {SYNTHETIC_MODULE_IDS,type SyntheticModuleId} from '../src/distributed-reader-contract';

const digest='c'.repeat(64);
const entry=(path:string)=>({
 path,kind:'file',encodedBytes:50,expandedBytes:100,declaredFormat:'well-formed'
});
function index(paths:string[]):SyntheticPackageIndex{
 const result=buildSyntheticPackageIndex(digest,paths.map(entry));
 expect(result.status).toBe('ready');
 return result.index!;
}
function handle(i:SyntheticPackageIndex,suffix:string,root:string,ordinal=0){
 const matches=projectSyntheticIndex(i,'definitions').entries
  .filter(e=>e.root===root&&e.suffix===suffix&&e.kind==='file');
 expect(matches.length).toBeGreaterThan(ordinal);
 return matches[ordinal].handle;
}
function claim(i:SyntheticPackageIndex,id:string,marker:SyntheticDefinitionMarker){
 return {handle:id,marker,revisionTicket:issueSyntheticRevisionTicket(i,'definitions',id)};
}
function neutrals(i:SyntheticPackageIndex){
 return SYNTHETIC_MODULE_IDS.filter(id=>
  id!=='container'&&id!=='structure'&&id!=='definitions').map(id=>({
  moduleId:id as Exclude<SyntheticModuleId,'container'>,
  fixtureDigest:digest,revisionTicket:issueSyntheticRevisionTicket(i,id),
  status:'ok' as const,observations:[]
 }));
}
test('declaração OMSI continua fictícia, imutável e vinculada à revisão',()=>{
 const i=index(['vehicles/a.bus']);
 const id=handle(i,'bus','vehicles');
 const out=validateSyntheticDefinitionClaims(i,[claim(i,id,'omsi-bus-definition')]);
 expect(out.status).toBe('ready');
 expect(out.reason).toBe('none');
 expect(out.facts).toEqual([{handle:id,marker:'omsi-bus-definition',game:'omsi',verified:false}]);
 expect(out.declaration?.status).toBe('ok');
 expect(out.declaration?.observations).toHaveLength(1);
 expect(out.digestVerified).toBe(false);
 expect(out.gameVerified).toBe(false);
 expect(out.realPackageRead).toBe(false);
 expect(out.operationsEnabled).toBe(false);
 expect(Object.isFrozen(out)).toBe(true);
 expect(Object.isFrozen(out.facts[0])).toBe(true);
 expect(Object.isFrozen(out.declaration?.observations)).toBe(true);
});
test('extensões compartilhadas não produzem pistas de jogo sem fatos explícitos',()=>{
 const i=index(['mod/ats_vehicle.scs','def/ets2_vehicle.sii']);
 const out=validateSyntheticDefinitionClaims(i,[]);
 expect(out.status).toBe('ready');
 expect(out.reason).toBe('no-claims');
 expect(out.facts).toHaveLength(0);
 expect(out.declaration?.status).toBe('incomplete');
 const worker=runSyntheticIndexedWorkers(i,[out.declaration]);
 expect(worker.snapshot.state).toBe('incomplete');
 expect(worker.snapshot.candidateGame).toBeNull();
});
test('SII na raiz def aceita marcador fictício ETS2 ou ATS sem detectar jogo real',()=>{
 const i=index(['def/vehicle.sii']);
 const id=handle(i,'sii','def');
 for(const marker of ['ets2-vehicle-definition','ats-vehicle-definition'] as const){
  const out=validateSyntheticDefinitionClaims(i,[claim(i,id,marker)]);
  expect(out.status).toBe('ready');
  expect(out.facts[0].game).toBe(marker.startsWith('ets2')?'ets2':'ats');
  expect(out.gameVerified).toBe(false);
 }
});
test('duas declarações independentes ainda exigem todos os módulos do coordenador',()=>{
 const i=index(['vehicles/a.bus','vehicles/b.bus']);
 const structure=deriveSyntheticStructureHints(i);
 const definitions=validateSyntheticDefinitionClaims(i,[
  claim(i,handle(i,'bus','vehicles',1),'omsi-bus-definition')
 ]);
 const result=runSyntheticIndexedWorkers(i,[structure.declaration,definitions.declaration]);
 expect(result.status).toBe('incomplete');
 expect(result.snapshot.candidateGame).toBeNull();
 expect(result.snapshot.findings).toContain('module-missing');
 expect(result.snapshot.operationsEnabled).toBe(false);
});
test('consenso de fixture completo é só candidato sintético, nunca autorização',()=>{
 const i=index(['vehicles/a.bus','vehicles/b.bus']);
 const structure=deriveSyntheticStructureHints(i);
 const definitions=validateSyntheticDefinitionClaims(i,[
  claim(i,handle(i,'bus','vehicles',1),'omsi-bus-definition')
 ]);
 const result=runSyntheticIndexedWorkers(i,[
  structure.declaration,definitions.declaration,...neutrals(i)
 ]);
 expect(result.status).toBe('complete');
 expect(result.snapshot.state).toBe('candidate');
 expect(result.snapshot.candidateGame).toBe('omsi');
 expect(result.snapshot.digestVerified).toBe(false);
 expect(result.snapshot.compatibilityVerified).toBe(false);
 expect(result.snapshot.installationVerified).toBe(false);
 expect(result.snapshot.operationsEnabled).toBe(false);
 expect(result.realPackageRead).toBe(false);
});
test('OMSI estrutural com definição ETS2 fica ambíguo mesmo com demais módulos ok',()=>{
 const i=index(['vehicles/a.bus','def/vehicle.sii']);
 const structure=deriveSyntheticStructureHints(i);
 const definitions=validateSyntheticDefinitionClaims(i,[
  claim(i,handle(i,'sii','def'),'ets2-vehicle-definition')
 ]);
 const result=runSyntheticIndexedWorkers(i,[
  structure.declaration,definitions.declaration,...neutrals(i)
 ]);
 expect(result.snapshot.state).toBe('ambiguous');
 expect(result.snapshot.findings).toContain('ambiguous-game');
 expect(result.snapshot.candidateGame).toBeNull();
 expect(result.snapshot.operationsEnabled).toBe(false);
});
test('arquivo fora da raiz ou sufixo autorizado não pode se tornar sinal',()=>{
 const i=index(['other/vehicle.bus','vehicles/vehicle.sii','mod/truck.scs']);
 for(const id of projectSyntheticIndex(i,'definitions').entries.map(e=>e.handle)){
  const out=validateSyntheticDefinitionClaims(i,[claim(i,id,'omsi-bus-definition')]);
  expect(out.status).toBe('rejected');
  expect(out.reason).toBe('out-of-scope');
  expect(out.declaration).toBeNull();
 }
});
test('handle não existente ou apontando outro tipo não passa no validador',()=>{
 const i=index(['def/truck.sii','vehicles/a.bus']);
 expect(validateSyntheticDefinitionClaims(i,[{
  handle:'synthetic-entry-9999',marker:'ats-vehicle-definition',
  revisionTicket:issueSyntheticRevisionTicket(i,'definitions')
 }]).reason).toBe('out-of-scope');
 const bus=handle(i,'bus','vehicles');
 expect(validateSyntheticDefinitionClaims(i,[
  claim(i,bus,'ets2-vehicle-definition')
 ]).reason).toBe('out-of-scope');
});
test('ticket de revisão antiga falha mesmo com mesmo digest e handle ordinal',()=>{
 const old=index(['def/vehicle.sii']);
 const fresh=index(['def/vehicle.sii']);
 const id=handle(old,'sii','def');
 const out=validateSyntheticDefinitionClaims(fresh,[
  claim(old,id,'ats-vehicle-definition')
 ]);
 expect(out.status).toBe('rejected');
 expect(out.reason).toBe('stale-revision');
 expect(out.facts).toEqual([]);
});
test('dados estranhos, campos inesperados e lotes grandes são rejeitados sem vazar',()=>{
 const i=index(['def/vehicle.sii']);
 const id=handle(i,'sii','def');
 const good=claim(i,id,'ats-vehicle-definition');
 for(const batch of [
  'invalid',null,[null],[{...good,path:'C:/Users/private'}],
  [{...good,marker:'injected-command'}],
  [{...good,handle:'../secret'}],Array.from({length:5},()=>good)
 ]){
  const out=validateSyntheticDefinitionClaims(i,batch);
  expect(out.status).toBe('rejected');
  expect(out.declaration).toBeNull();
  expect(JSON.stringify(out)).not.toMatch(/Users|private|secret|injected-command/);
 }
});
test('um registro duplicado ou contraditório é rejeitado por inteiro',()=>{
 const i=index(['def/a.sii','def/b.sii']);
 const id=handle(i,'sii','def');
 const ets=claim(i,id,'ets2-vehicle-definition');
 const ats=claim(i,id,'ats-vehicle-definition');
 for(const batch of [[ets,ets],[ets,ats]]){
  const out=validateSyntheticDefinitionClaims(i,batch);
  expect(out.reason).toBe('conflicting-claims');
  expect(out.facts).toHaveLength(0);
  expect(out.declaration).toBeNull();
 }
});
test('ordem de declarações não muda conteúdo e não revela nomes privados',()=>{
 const i=index(['def/customer_9876.sii','def/personal_1234.sii']);
 const a=handle(i,'sii','def',0),b=handle(i,'sii','def',1);
 const x=validateSyntheticDefinitionClaims(i,[
  claim(i,b,'ets2-vehicle-definition'),claim(i,a,'ets2-vehicle-definition')
 ]);
 const y=validateSyntheticDefinitionClaims(i,[
  claim(i,a,'ets2-vehicle-definition'),claim(i,b,'ets2-vehicle-definition')
 ]);
 expect(x.facts).toEqual(y.facts);
 expect(x.declaration?.observations.map(o=>({handle:o.handle,game:o.game})))
  .toEqual(y.declaration?.observations.map(o=>({handle:o.handle,game:o.game})));
 for(const hidden of ['customer_9876','personal_1234','def/']){
  expect(JSON.stringify(x)).not.toContain(hidden);
 }
});
test('índice falsificado não autoriza declarações mesmo copiando o JSON inteiro',()=>{
 const i=index(['def/vehicle.sii']);
 const clone=JSON.parse(JSON.stringify(i)) as SyntheticPackageIndex;
 const out=validateSyntheticDefinitionClaims(clone,[
  claim(i,handle(i,'sii','def'),'ats-vehicle-definition')
 ]);
 expect(out.reason).toBe('invalid-index');
 expect(out.declaration).toBeNull();
});
