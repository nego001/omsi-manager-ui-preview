import {test,expect} from '@playwright/test';
import {
 buildSyntheticPackageIndex,issueSyntheticRevisionTicket,matchesSyntheticRevisionTicket,
 projectSyntheticIndex,type SyntheticPackageIndex,type SyntheticRevisionTicket
} from '../src/synthetic-package-index';
import {
 runSyntheticIndexedWorkers,type SyntheticWorkerDeclaration
} from '../src/synthetic-index-workers';
import {SYNTHETIC_MODULE_IDS,projectSyntheticSnapshot,type SyntheticModuleId} from '../src/distributed-reader-contract';
import {planSyntheticRevalidation,projectPendingSyntheticRevalidation} from '../src/synthetic-index-revalidation';
const digest='f'.repeat(64);
const entry=(path:string)=>({path,kind:'file',encodedBytes:100,expandedBytes:150,declaredFormat:'well-formed'});
function make(paths=['Vehicles/bus.bus','meta/catalog.json','def/config.sii','audio/motor.wav']):SyntheticPackageIndex{
 const output=buildSyntheticPackageIndex(digest,paths.map(entry));
 expect(output.status).toBe('ready');
 return output.index!;
}
type SpecialistId=Exclude<SyntheticModuleId,'container'>;
function claim(index:SyntheticPackageIndex,moduleId:SpecialistId,suffix:string,game:'omsi'|'ats'|'ets2'='omsi'){
 const handle=projectSyntheticIndex(index,moduleId).entries.find(item=>item.suffix===suffix)?.handle;
 expect(handle).toBeDefined();
 return {handle:handle!,game,revisionTicket:issueSyntheticRevisionTicket(index,moduleId,handle)};
}
function declarations(index:SyntheticPackageIndex,game:'omsi'|'ats'|'ets2'='omsi'):SyntheticWorkerDeclaration[]{
 return SYNTHETIC_MODULE_IDS.filter((id):id is SpecialistId=>id!=='container').map(moduleId=>({
  moduleId,fixtureDigest:digest,status:'ok' as const,
  revisionTicket:issueSyntheticRevisionTicket(index,moduleId),
  observations:moduleId==='structure'?[claim(index,moduleId,'bus',game)]:
   moduleId==='manifest'?[claim(index,moduleId,'json',game)]:
   moduleId==='definitions'?[claim(index,moduleId,'sii',game)]:[]
 }));
}
function rejected(out:ReturnType<typeof runSyntheticIndexedWorkers>,reason:string){
 expect(out.status).toBe('blocked');
 expect(out.reason).toBe(reason);
 expect(out.reports).toHaveLength(0);
 expect(out.coverage).toHaveLength(0);
 expect(out.snapshot.evidence).toHaveLength(0);
 expect(out.snapshot.candidateGame).toBeNull();
 expect(out.operationsEnabled).toBe(false);
}
test('cada relatório e observação é vinculado à revisão exata do índice',()=>{
 const i=make(),decl=declarations(i);
 const output=runSyntheticIndexedWorkers(i,decl);
 expect(output.status).toBe('complete');
 expect(output.snapshot.state).toBe('candidate');
 expect(output.snapshot.candidateGame).toBe('omsi');
 expect(output.snapshot.compatibilityVerified).toBe(false);
 expect(output.snapshot.installationVerified).toBe(false);
 expect(decl.every(d=>matchesSyntheticRevisionTicket(i,d.moduleId,null,d.revisionTicket))).toBe(true);
 expect(decl.flatMap(d=>d.observations).length).toBe(3);
 expect(projectSyntheticSnapshot(output.snapshot).installer.enabled).toBe(false);
});
test('replay de batch em outro índice idêntico e com digest declarado igual é bloqueado',()=>{
 const old=make(),next=make();
 expect(old.entries).toEqual(next.entries);
 expect(old.fixtureDigest).toBe(next.fixtureDigest);
 rejected(runSyntheticIndexedWorkers(next,declarations(old)),'stale-revision');
});
test('novo pacote com arquivo inserido desloca handle, mas prova antiga é recusada',()=>{
 const old=make();
 const next=make(['Vehicles/bus.bus','meta/catalog.json','def/config.sii','audio/motor.wav','AAA/new.scs']);
 expect(old.entries[0].handle).toBe(next.entries[0].handle);
 rejected(runSyntheticIndexedWorkers(next,declarations(old)),'stale-revision');
 const pending=planSyntheticRevalidation(old,next);
 expect(pending.previousSnapshotInvalidated).toBe(true);
 expect(projectPendingSyntheticRevalidation(pending).gameCandidate).toBeNull();
});
test('renomeação com mesmo sufixo e tamanho não transforma evidência antiga em atual',()=>{
 const old=make();
 const next=make(['Vehicles/bus.bus','meta/catalog-renamed.json','def/config.sii','audio/motor.wav']);
 expect(old.entries).toEqual(next.entries);
 rejected(runSyntheticIndexedWorkers(next,declarations(old)),'stale-revision');
});
test('carimbo de relatório novo com observação antiga ainda é rejeitado',()=>{
 const old=make(),next=make();
 const oldDecl=declarations(old);
 const patched=oldDecl.map(d=>({
  ...d,revisionTicket:issueSyntheticRevisionTicket(next,d.moduleId)
 }));
 rejected(runSyntheticIndexedWorkers(next,patched),'stale-revision');
});
test('observação nova não salva relatório ainda carimbado na revisão anterior',()=>{
 const old=make(),next=make();
 const oldDecl=declarations(old);
 const fresh=declarations(next);
 const patched=fresh.map((d,i)=>({...d,revisionTicket:oldDecl[i].revisionTicket}));
 rejected(runSyntheticIndexedWorkers(next,patched),'stale-revision');
});
test('ticket de relatório de outro especialista não passa na revisão atual',()=>{
 const i=make(),decl=declarations(i);
 const wrong=issueSyntheticRevisionTicket(i,'structure');
 const patched=decl.map(d=>d.moduleId==='manifest'?{...d,revisionTicket:wrong}:d);
 rejected(runSyntheticIndexedWorkers(i,patched),'stale-revision');
});
test('ticket de observação de outro especialista não vale mesmo com handle compartilhado',()=>{
 const i=make(),decl=declarations(i);
 const common=claim(i,'manifest','sii');
 const stolen=issueSyntheticRevisionTicket(i,'definitions',common.handle);
 const patched=decl.map(d=>d.moduleId==='manifest'
  ?{...d,observations:[{...common,revisionTicket:stolen}]}:d);
 rejected(runSyntheticIndexedWorkers(i,patched),'stale-revision');
});
test('ticket válido para outro handle no mesmo módulo não autoriza troca da observação',()=>{
 const i=make(['Vehicles/first.bus','Vehicles/second.bus','meta/catalog.json','def/config.sii']);
 const decl=declarations(i);
 const buses=projectSyntheticIndex(i,'structure').entries.filter(e=>e.suffix==='bus');
 expect(buses).toHaveLength(2);
 const ticket=issueSyntheticRevisionTicket(i,'structure',buses[0].handle);
 const changed=decl.map(d=>d.moduleId==='structure'
  ?{...d,observations:[{handle:buses[1].handle,game:'omsi' as const,revisionTicket:ticket}]}:d);
 rejected(runSyntheticIndexedWorkers(i,changed),'stale-revision');
});
test('ticket em branco e token fabricado não provam revisão de módulo',()=>{
 const i=make(),decl=declarations(i);
 const blank=decl.map(d=>d.moduleId==='audio'?{...d,revisionTicket:null}:d);
 rejected(runSyntheticIndexedWorkers(i,blank),'stale-revision');
 const forged=decl.map(d=>d.moduleId==='audio'?{...d,revisionTicket:{
  scope:'synthetic-revision-fixture',verified:false,operationsEnabled:false
 }}:d);
 rejected(runSyntheticIndexedWorkers(i,forged),'stale-revision');
});
test('clonar JSON de um ticket não preserva a associação privada',()=>{
 const i=make(),decl=declarations(i);
 const clone=JSON.parse(JSON.stringify(decl[0].revisionTicket)) as SyntheticRevisionTicket;
 expect(matchesSyntheticRevisionTicket(i,'structure',null,clone)).toBe(false);
 const attempt=decl.map((d,j)=>j===0?{...d,revisionTicket:clone}:d);
 rejected(runSyntheticIndexedWorkers(i,attempt),'stale-revision');
});
test('token de observação clonado é rejeitado mesmo se o restante do relatório for legítimo',()=>{
 const i=make(),decl=declarations(i);
 const first=decl.find(d=>d.moduleId==='structure')!;
 const attempted=decl.map(d=>d===first?{
  ...d,observations:first.observations.map(o=>({
   ...o,revisionTicket:JSON.parse(JSON.stringify(o.revisionTicket)) as SyntheticRevisionTicket
  }))
 }:d);
 rejected(runSyntheticIndexedWorkers(i,attempted),'stale-revision');
});
test('campo de ticket ausente não passa pelo contrato de relatório',()=>{
 const i=make(),decl=declarations(i);
 const {revisionTicket:_ignored,...without}=decl[0];
 rejected(runSyntheticIndexedWorkers(i,[without,...decl.slice(1)]),'invalid-fixture');
});
test('campo de ticket ausente na observação não passa no validador',()=>{
 const i=make(),decl=declarations(i);
 const first=decl[0],obs=first.observations[0];
 const {revisionTicket:_ignored,...without}=obs;
 rejected(runSyntheticIndexedWorkers(i,[{...first,observations:[without]},...decl.slice(1)]),'invalid-fixture');
});
test('o gate não emite tickets para índice clonado nem para módulo container',()=>{
 const i=make(),clone=JSON.parse(JSON.stringify(i)) as SyntheticPackageIndex;
 expect(()=>issueSyntheticRevisionTicket(clone,'structure')).toThrow();
 expect(()=>issueSyntheticRevisionTicket(i,'container')).toThrow();
});
test('um módulo não consegue emitir ticket para arquivo fora da sua visão',()=>{
 const i=make();
 const audio=projectSyntheticIndex(i,'audio').entries[0].handle;
 expect(()=>issueSyntheticRevisionTicket(i,'manifest',audio)).toThrow();
 expect(()=>issueSyntheticRevisionTicket(i,'structure','synthetic-entry-9999')).toThrow();
});
test('ticket de pasta não se torna autorização de evidência',()=>{
 const result=buildSyntheticPackageIndex(digest,[{
  path:'Vehicles',kind:'directory',encodedBytes:0,expandedBytes:0,declaredFormat:'well-formed'
 }]);
 const i=result.index!;
 expect(()=>issueSyntheticRevisionTicket(i,'structure',i.entries[0].handle)).toThrow();
});
test('ticket de outra revisão falha mesmo quando a própria declaração nova é legítima',()=>{
 const old=make(),next=make();
 const oldObs=declarations(old)[0].observations[0];
 const fresh=declarations(next);
 const patched=fresh.map(d=>d.moduleId==='structure'
  ?{...d,observations:[oldObs]}:d);
 rejected(runSyntheticIndexedWorkers(next,patched),'stale-revision');
});
test('a mesma revisão aceita emissões de tickets diferentes para o mesmo escopo',()=>{
 const i=make(),a=declarations(i),b=declarations(i);
 expect(a[0].revisionTicket).not.toBe(b[0].revisionTicket);
 expect(runSyntheticIndexedWorkers(i,a).snapshot).toEqual(runSyntheticIndexedWorkers(i,b).snapshot);
 expect(runSyntheticIndexedWorkers(i,b).snapshot.state).toBe('candidate');
});
test('resultado publicado não contém tickets nem caminhos ou palavras privadas',()=>{
 const i=make(['Vehicles/secret_bus.bus','meta/catalog.json','def/config.sii','audio/motor.wav']);
 const result=runSyntheticIndexedWorkers(i,declarations(i));
 const serialized=JSON.stringify(result);
 for(const forbidden of ['revisionTicket','secret_bus','Vehicles/','synthetic-revision-fixture'])
  expect(serialized).not.toContain(forbidden);
 expect(result.reports[1].signals.every(s=>Object.keys(s).length===2)).toBe(true);
 expect(Object.isFrozen(result.reports)).toBe(true);
 expect(Object.isFrozen(result.snapshot)).toBe(true);
});
test('contradição declarada continua ambígua mesmo com tickets corretos',()=>{
 const i=make(),decl=declarations(i);
 const conflicting=decl.map(d=>d.moduleId==='manifest'
  ?{...d,observations:[claim(i,'manifest','json','ats')]}:d);
 const out=runSyntheticIndexedWorkers(i,conflicting);
 expect(out.status).toBe('complete');
 expect(out.snapshot.state).toBe('ambiguous');
 expect(out.snapshot.candidateGame).toBeNull();
 expect(projectSyntheticSnapshot(out.snapshot).workshop.audioEnabled).toBe(false);
});
