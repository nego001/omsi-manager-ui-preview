import {test,expect} from '@playwright/test';
import {
 buildSyntheticPackageIndex,projectSyntheticIndex,issueSyntheticRevisionTicket,
 type SyntheticPackageIndex
} from '../src/synthetic-package-index';
import {deriveSyntheticStructureHints} from '../src/synthetic-structure-hints';
import {validateSyntheticDefinitionClaims} from '../src/synthetic-definition-claims';
import {runSyntheticIndexedWorkers,type SyntheticWorkerDeclaration} from '../src/synthetic-index-workers';
import {SYNTHETIC_MODULE_IDS,type SyntheticModuleId} from '../src/distributed-reader-contract';
import {reviewSyntheticIdentification} from '../src/synthetic-independence-review';

const digest='7'.repeat(64);
const file=(path:string)=>({path,kind:'file',
 encodedBytes:80,expandedBytes:120,declaredFormat:'well-formed'});
function index(paths:string[]):SyntheticPackageIndex{
 const res=buildSyntheticPackageIndex(digest,paths.map(file));
 expect(res.status).toBe('ready');
 return res.index!;
}
function handle(index:SyntheticPackageIndex,root:string,suffix:string){
 const entry=projectSyntheticIndex(index,'definitions').entries
  .find(item=>item.root===root&&item.suffix===suffix);
 expect(entry).toBeDefined();
 return entry!.handle;
}
function neutralReports(index:SyntheticPackageIndex):SyntheticWorkerDeclaration[]{
 return SYNTHETIC_MODULE_IDS.filter(id=>id!=='container'&&id!=='structure'&&id!=='definitions')
  .map(id=>({
   moduleId:id as Exclude<SyntheticModuleId,'container'>,
   fixtureDigest:digest,revisionTicket:issueSyntheticRevisionTicket(index,id),
   status:'ok' as const,observations:[]
  }));
}
function result(index:SyntheticPackageIndex,definitionIndexHandle:string,
 marker:'omsi-bus-definition'|'ets2-vehicle-definition'|'ats-vehicle-definition',
 includeOthers=true){
 const structure=deriveSyntheticStructureHints(index);
 const definition=validateSyntheticDefinitionClaims(index,[{
  handle:definitionIndexHandle,marker,
  revisionTicket:issueSyntheticRevisionTicket(index,'definitions',definitionIndexHandle)
 }]);
 expect(definition.status).toBe('ready');
 return runSyntheticIndexedWorkers(index,[
  structure.declaration,definition.declaration!,
  ...(includeOthers?neutralReports(index):[])
 ]);
}

test('duas especialidades sobre a MESMA entrada não contam como provas independentes',()=>{
 const i=index(['vehicles/a.bus']);
 const worker=result(i,handle(i,'vehicles','bus'),'omsi-bus-definition');
 // Existing coordinator sees two specialist reports; M3 deliberately withholds
 // a stronger inference if both cited the same opaque source entry.
 expect(worker.snapshot.state).toBe('candidate');
 const review=reviewSyntheticIdentification(i,worker);
 expect(review.state).toBe('withheld');
 expect(review.reason).toBe('reused-source-entry');
 expect(review.candidateGame).toBeNull();
 expect(review.structureEntries).toBe(1);
 expect(review.definitionEntries).toBe(1);
 expect(review.independentEntries).toBe(1);
 expect(review.operationsEnabled).toBe(false);
});

test('duas entradas distintas permitem apenas candidato de fixture, nunca instalação',()=>{
 const i=index(['vehicles/a.bus','vehicles/b.bus']);
 const definition=projectSyntheticIndex(i,'definitions').entries
  .filter(x=>x.root==='vehicles'&&x.suffix==='bus')[1].handle;
 const worker=result(i,definition,'omsi-bus-definition');
 const review=reviewSyntheticIdentification(i,worker);
 expect(review.state).toBe('candidate');
 expect(review.reason).toBe('none');
 expect(review.candidateGame).toBe('omsi');
 expect(review.independentEntries).toBe(2);
 expect(review.specialistReports).toBe(7);
 expect(review.fixtureDigestVerified).toBe(false);
 expect(review.realPackageRead).toBe(false);
 expect(review.gameVerified).toBe(false);
 expect(review.compatibilityVerified).toBe(false);
 expect(review.installationVerified).toBe(false);
 expect(review.operationsEnabled).toBe(false);
 expect(Object.isFrozen(review)).toBe(true);
});

test('sinais contraditórios OMSI e ETS2 terminam ambíguos, sem destino',()=>{
 const i=index(['vehicles/a.bus','def/truck.sii']);
 const worker=result(i,handle(i,'def','sii'),'ets2-vehicle-definition');
 const review=reviewSyntheticIdentification(i,worker);
 expect(review.state).toBe('ambiguous');
 expect(review.reason).toBe('conflicting-games');
 expect(review.candidateGame).toBeNull();
});

test('sem todos os módulos, o revisor não promove consenso fictício',()=>{
 const i=index(['vehicles/a.bus','vehicles/b.bus']);
 const entries=projectSyntheticIndex(i,'definitions').entries.filter(x=>x.suffix==='bus');
 const worker=result(i,entries[1].handle,'omsi-bus-definition',false);
 expect(worker.snapshot.state).toBe('incomplete');
 expect(reviewSyntheticIdentification(i,worker).state).toBe('incomplete');
});

test('relatório bloqueado ou não emitido não cria candidato',()=>{
 const i=index(['vehicles/a.bus']);
 const bad=runSyntheticIndexedWorkers(i,[{
  moduleId:'structure',fixtureDigest:digest,
  revisionTicket:issueSyntheticRevisionTicket(i,'structure'),
  status:'blocked',observations:[]
 }]);
 expect(reviewSyntheticIdentification(i,bad).state).toBe('blocked');
 const forged={...bad,status:'complete' as const};
 expect(reviewSyntheticIdentification(i,forged).reason).toBe('invalid-provenance');
});

test('outcome de outro índice e clone JSON com digest igual falham fechados',()=>{
 const a=index(['vehicles/a.bus','vehicles/b.bus']);
 const b=index(['vehicles/a.bus','vehicles/b.bus']);
 const defs=projectSyntheticIndex(a,'definitions').entries.filter(e=>e.suffix==='bus');
 const worker=result(a,defs[1].handle,'omsi-bus-definition');
 const other=reviewSyntheticIdentification(b,worker);
 expect(other.state).toBe('blocked');
 expect(other.reason).toBe('invalid-provenance');
 const clone=JSON.parse(JSON.stringify(a)) as SyntheticPackageIndex;
 expect(reviewSyntheticIdentification(clone,worker).reason).toBe('invalid-provenance');
});

test('saída sanitizada não contém caminhos, nomes ou digest fictício',()=>{
 const i=index(['vehicles/private_customer_8765.bus','vehicles/private_customer_9876.bus']);
 const defs=projectSyntheticIndex(i,'definitions').entries.filter(e=>e.suffix==='bus');
 const review=reviewSyntheticIdentification(i,result(i,defs[1].handle,'omsi-bus-definition'));
 const serialized=JSON.stringify(review);
 for(const secret of ['customer','vehicles/','private','/','\\',digest]){
  expect(serialized).not.toContain(secret);
 }
});

test('lista sem pistas não produz candidato automático',()=>{
 const i=index(['mod/truck_ats.scs','def/shared.sii']);
 const structure=deriveSyntheticStructureHints(i);
 const definitions=validateSyntheticDefinitionClaims(i,[]);
 const worker=runSyntheticIndexedWorkers(i,[
  structure.declaration,definitions.declaration!,...neutralReports(i)
 ]);
 const review=reviewSyntheticIdentification(i,worker);
 expect(review.state).toBe('incomplete');
 expect(review.candidateGame).toBeNull();
});
