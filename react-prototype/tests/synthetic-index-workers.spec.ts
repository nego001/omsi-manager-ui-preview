import {test,expect} from '@playwright/test';
import {buildSyntheticPackageIndex,projectSyntheticIndex,issueSyntheticRevisionTicket,type SyntheticPackageIndex} from '../src/synthetic-package-index';
import {runSyntheticIndexedWorkers,type SyntheticWorkerDeclaration} from '../src/synthetic-index-workers';
import {SYNTHETIC_MODULE_IDS,projectSyntheticSnapshot,type SyntheticModuleId} from '../src/distributed-reader-contract';
const digest='f'.repeat(64);
function index(paths=['Vehicles/bus.bus','meta/catalog.json','def/config.sii','audio/motor.wav','skins/coat.dds','mod/Truck_ats.scs']){
 const entries=paths.map(path=>({path,kind:'file',encodedBytes:100,expandedBytes:150,declaredFormat:'well-formed'}));
 const result=buildSyntheticPackageIndex(digest,entries);
 expect(result.status).toBe('ready');
 return result.index!;
}
function handle(i:SyntheticPackageIndex,id:SyntheticModuleId,suffix:string){
 const found=projectSyntheticIndex(i,id).entries.find(x=>x.suffix===suffix);
 expect(found).toBeDefined();
 return found!.handle;
}
function declarations(i:SyntheticPackageIndex,target:'omsi'|'ets2'|'ats'='omsi'):SyntheticWorkerDeclaration[]{
 return SYNTHETIC_MODULE_IDS.filter(id=>id!=='container').map(id=>({
  moduleId:id as Exclude<SyntheticModuleId,'container'>,fixtureDigest:digest,
  revisionTicket:issueSyntheticRevisionTicket(i,id),status:'ok' as const,
  observations:id==='structure'?[{handle:handle(i,id,'bus'),game:target,
   revisionTicket:issueSyntheticRevisionTicket(i,id,handle(i,id,'bus'))}]:
   id==='manifest'?[{handle:handle(i,id,'json'),game:target,
   revisionTicket:issueSyntheticRevisionTicket(i,id,handle(i,id,'json'))}]:
   id==='definitions'?[{handle:handle(i,id,'sii'),game:target,
   revisionTicket:issueSyntheticRevisionTicket(i,id,handle(i,id,'sii'))}]:[]
 }));
}
test('o gate entrega apenas vistas limitadas; todos os módulos compartilham um snapshot',()=>{
 const i=index(),result=runSyntheticIndexedWorkers(i,declarations(i));
 expect(result.status).toBe('complete');
 expect(result.reason).toBe('none');
 expect(result.snapshot.state).toBe('candidate');
 expect(result.snapshot.candidateGame).toBe('omsi');
 expect(result.coverage).toHaveLength(7);
 expect(result.reports.map(x=>x.moduleId)).toEqual(SYNTHETIC_MODULE_IDS);
 expect(result.coverage.find(x=>x.moduleId==='audio')?.visibleEntries).toBe(1);
 expect(result.coverage.find(x=>x.moduleId==='media')?.visibleEntries).toBe(1);
 expect(result.coverage.find(x=>x.moduleId==='container')).toBeUndefined();
 expect(result.snapshot.evidence.map(x=>x.evidenceId)).toEqual([
  handle(i,'structure','bus'),handle(i,'manifest','json'),handle(i,'definitions','sii')
 ]);
 expect(result.realPackageRead).toBe(false);
 expect(result.operationsEnabled).toBe(false);
 expect(result.snapshot.compatibilityVerified).toBe(false);
 expect(projectSyntheticSnapshot(result.snapshot).installer.enabled).toBe(false);
});
test('cada especialista só recebe pistas permitidas, não nomes ou caminhos completos',()=>{
 const i=index(),result=runSyntheticIndexedWorkers(i,declarations(i));
 const printed=JSON.stringify(result);
 for(const secret of ['Vehicles','bus.bus','catalog.json','config.sii','Truck_ats.scs','audio/motor']){
  expect(printed).not.toContain(secret);
 }
 expect(result.reports.find(x=>x.moduleId==='audio')?.signals).toEqual([]);
 expect(result.reports.find(x=>x.moduleId==='media')?.signals).toEqual([]);
 expect(result.coverage.find(x=>x.moduleId==='definitions')?.visibleEntries).toBe(2);
});
test('ordem da entrega dos especialistas não altera relatório nem evidência',()=>{
 const i=index(),fixture=declarations(i);
 const a=runSyntheticIndexedWorkers(i,fixture);
 const b=runSyntheticIndexedWorkers(i,[...fixture].reverse());
 expect(a).toEqual(b);
 expect(Object.isFrozen(a.coverage)).toBe(true);
 expect(Object.isFrozen(a.reports)).toBe(true);
 expect(Object.isFrozen(a.reports[1].signals)).toBe(true);
});
test('sufixo SCS com nome ATS não classifica jogo automaticamente',()=>{
 const i=index(['mod/Definitely_ats.scs']);
 const fixture=SYNTHETIC_MODULE_IDS.filter(id=>id!=='container').map(id=>({
  moduleId:id,fixtureDigest:digest,revisionTicket:issueSyntheticRevisionTicket(i,id),status:'ok',observations:[]
 }));
 const a=runSyntheticIndexedWorkers(i,fixture);
 expect(a.status).toBe('complete');
 expect(a.snapshot.state).toBe('unknown');
 expect(a.snapshot.candidateGame).toBeNull();
});
test('conflitos declarados entre ETS2 e ATS permanecem ambíguos, sem destino',()=>{
 const i=index();
 const fixture=declarations(i,'ats').map(f=>f.moduleId==='manifest'
  ?{...f,observations:[{handle:handle(i,'manifest','json'),game:'ets2' as const,revisionTicket:issueSyntheticRevisionTicket(i,'manifest',handle(i,'manifest','json'))}]}:f);
 const a=runSyntheticIndexedWorkers(i,fixture);
 expect(a.status).toBe('complete');
 expect(a.snapshot.state).toBe('ambiguous');
 expect(a.snapshot.findings).toContain('ambiguous-game');
 expect(a.snapshot.candidateGame).toBeNull();
 expect(projectSyntheticSnapshot(a.snapshot).library.gameCandidate).toBeNull();
});
test('proíbe definição OMSI baseada em índice de som não permitido ao módulo',()=>{
 const i=index(),fixture=declarations(i);
 const audioHandle=handle(i,'audio','wav');
 const defs=fixture.find(x=>x.moduleId==='definitions')!;
 const altered=fixture.map(x=>x===defs?{...x,observations:[{handle:audioHandle,game:'omsi' as const,revisionTicket:defs.revisionTicket}]}:x);
 const a=runSyntheticIndexedWorkers(i,altered);
 expect(a.status).toBe('blocked');
 expect(a.reason).toBe('out-of-scope-handle');
 expect(a.snapshot.findings).toEqual(['invalid-contract']);
 expect(a.snapshot.evidence).toEqual([]);
});
test('manifesto não consulta DDS, ainda que DDS esteja no índice global',()=>{
 const i=index(),fixture=declarations(i);
 const imageHandle=handle(i,'media','dds');
 const a=runSyntheticIndexedWorkers(i,fixture.map(x=>x.moduleId==='manifest'
  ?{...x,observations:[{handle:imageHandle,game:'omsi' as const,revisionTicket:x.revisionTicket}]}:x));
 expect(a.reason).toBe('out-of-scope-handle');
 expect(a.reports).toHaveLength(0);
});
test('módulo de áudio não pode emitir classificação arbitrária de jogo',()=>{
 const i=index(),fixture=declarations(i);
 const a=runSyntheticIndexedWorkers(i,fixture.map(x=>x.moduleId==='audio'
  ?{...x,observations:[{handle:handle(i,'audio','wav'),game:'omsi' as const}]}:x));
 expect(a.reason).toBe('invalid-fixture');
 expect(a.snapshot.candidateGame).toBeNull();
});
test('referência inexistente não pode virar evidência',()=>{
 const i=index(),fixture=declarations(i);
 const a=runSyntheticIndexedWorkers(i,fixture.map(x=>x.moduleId==='definitions'
  ?{...x,observations:[{handle:'synthetic-entry-9999',game:'ats' as const,revisionTicket:x.revisionTicket}]}:x));
 expect(a.reason).toBe('out-of-scope-handle');
});
test('diretórios não são evidência de conteúdo do jogo',()=>{
 const entries=[{path:'Vehicles',kind:'directory',encodedBytes:0,expandedBytes:0,declaredFormat:'well-formed'}];
 const i=buildSyntheticPackageIndex(digest,entries).index!;
 const fixture=declarations(index()).map(x=>({...x,observations:[],revisionTicket:issueSyntheticRevisionTicket(i,x.moduleId)}));
 const a=runSyntheticIndexedWorkers(i,fixture.map(x=>x.moduleId==='structure'
  ?{...x,observations:[{handle:i.entries[0].handle,game:'omsi' as const,revisionTicket:x.revisionTicket}]}:x));
 expect(a.reason).toBe('out-of-scope-handle');
});
test('mod sem módulo de áudio é análise incompleta, mesmo com outros indícios concordantes',()=>{
 const i=index(),fixture=declarations(i).filter(x=>x.moduleId!=='audio');
 const a=runSyntheticIndexedWorkers(i,fixture);
 expect(a.status).toBe('incomplete');
 expect(a.reason).toBe('missing-module');
 expect(a.snapshot.findings).toContain('module-missing');
 expect(a.snapshot.candidateGame).toBeNull();
});
test('módulo explicitamente incompleto não fornece classificações parciais',()=>{
 const i=index();
 const fixture=declarations(i).map(x=>x.moduleId==='audio'?{...x,status:'incomplete' as const}:x);
 const a=runSyntheticIndexedWorkers(i,fixture);
 expect(a.status).toBe('incomplete');
 expect(a.snapshot.candidateGame).toBeNull();
 expect(a.snapshot.findings).toContain('module-incomplete');
});
test('módulo bloqueado prevalece sobre indicações de jogo dos demais',()=>{
 const i=index();
 const fixture=declarations(i).map(x=>x.moduleId==='resources'?{...x,status:'blocked' as const}:x);
 const a=runSyntheticIndexedWorkers(i,fixture);
 expect(a.status).toBe('blocked');
 expect(a.reason).toBe('module-blocked');
 expect(a.snapshot.findings).toEqual(['module-blocked']);
 expect(a.snapshot.evidence).toEqual([]);
});
test('módulo incompleto ou bloqueado não pode apresentar evidência positiva',()=>{
 const i=index(),fixture=declarations(i);
 for(const status of ['incomplete','blocked'] as const){
  const a=runSyntheticIndexedWorkers(i,fixture.map(x=>x.moduleId==='structure'
   ?{...x,status}:x));
  expect(a.reason).toBe('invalid-fixture');
  expect(a.snapshot.evidence).toEqual([]);
 }
});
test('digest declarado antigo, mesmo com handle ordinal igual, é recusado',()=>{
 const i=index(),fixture=declarations(i);
 const a=runSyntheticIndexedWorkers(i,fixture.map(x=>x.moduleId==='manifest'
  ?{...x,fixtureDigest:'a'.repeat(64)}:x));
 expect(a.status).toBe('blocked');
 expect(a.reason).toBe('invalid-fixture');
});
test('rejeita duplicação de especialista e módulos inventados sem relatório parcial',()=>{
 const i=index(),fixture=declarations(i);
 const duplicate=runSyntheticIndexedWorkers(i,[...fixture,fixture[0]]);
 expect(duplicate.reason).toBe('invalid-fixture');
 const impostor={...fixture[0],moduleId:'installer'};
 const forged=runSyntheticIndexedWorkers(i,[impostor,...fixture.slice(1)]);
 expect(forged.reason).toBe('invalid-fixture');
 expect(forged.reports).toHaveLength(0);
});
test('recusa campos extras e injeção de caminhos no contrato das observações',()=>{
 const i=index(),fixture=declarations(i),original=fixture[0];
 const injected=runSyntheticIndexedWorkers(i,[{...original,path:'C:/personal'},...fixture.slice(1)]);
 expect(injected.reason).toBe('invalid-fixture');
 const unsafe=runSyntheticIndexedWorkers(i,[{...original,observations:[{handle:'synthetic-entry-0001',game:'omsi',path:'../secret'}]},...fixture.slice(1)]);
 expect(unsafe.reason).toBe('invalid-fixture');
 expect(JSON.stringify(unsafe)).not.toContain('secret');
});
test('falha no gate impede qualquer relatório especializado',()=>{
 const idx=buildSyntheticPackageIndex(digest,[{
  path:'../secret.scs',kind:'file',encodedBytes:20,expandedBytes:100,declaredFormat:'well-formed'
 }]);
 expect(idx.index).toBeNull();
 const output=runSyntheticIndexedWorkers(idx.index as unknown as SyntheticPackageIndex,[]);
 expect(output.status).toBe('blocked');
 expect(output.coverage).toHaveLength(0);
 expect(output.reports).toHaveLength(0);
});
test('um índice falsificado não pode gerar evidências aceitas',()=>{
 const i=index(),clone=JSON.parse(JSON.stringify(i)) as SyntheticPackageIndex;
 const a=runSyntheticIndexedWorkers(clone,declarations(i));
 expect(a.status).toBe('blocked');
 expect(a.reason).toBe('invalid-fixture');
 expect(a.snapshot.findings).toContain('invalid-contract');
});
test('nenhum módulo ligado a índices cria recursos disponíveis na Oficina',()=>{
 const i=index(),a=runSyntheticIndexedWorkers(i,declarations(i));
 expect(a.snapshot.operationsEnabled).toBe(false);
 expect(projectSyntheticSnapshot(a.snapshot).workshop.skinEnabled).toBe(false);
 expect(projectSyntheticSnapshot(a.snapshot).workshop.audioEnabled).toBe(false);
 expect(projectSyntheticSnapshot(a.snapshot).installer.enabled).toBe(false);
});
