import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {createSyntheticValidationReadiness} from '../src/synthetic-validation-readiness';
import {createSyntheticReadAdmissionSession} from '../src/synthetic-read-admission';
import {
 createSyntheticContainerReview,advanceSyntheticContainerReview,
 cancelSyntheticContainerReview,issueSyntheticStreamDeclarationSource,
 type SyntheticContainerReview,type SyntheticStreamDeclarationSource
} from '../src/synthetic-container-screen';
import {
 createSyntheticStreamReview,advanceSyntheticStreamReview,cancelSyntheticStreamReview,
 snapshotSyntheticStreamReview,SYNTHETIC_STREAM_LIMITS,
 type SyntheticStreamReview
} from '../src/synthetic-stream-checkpoints';
const plan=createSyntheticValidationReadiness(createSyntheticDiagnosticDemo()[3].timeline);
const session=createSyntheticReadAdmissionSession(plan);
function screen(entries:readonly {path:string;kind:'file'|'directory';encodedBytes:number;expandedBytes:number}[]){
 const h=createSyntheticContainerReview(session,{format:'zip-declared',entries:entries.map(e=>({
  ...e,compression:'deflate'
 }))});
 for(let i=0;i<Math.max(1,entries.length);i++)advanceSyntheticContainerReview(h);
 return h;
}
const validScreen=()=>screen([
 {path:'def/engine.sii',kind:'file',encodedBytes:400,expandedBytes:1000},
 {path:'sound/engine.ogg',kind:'file',encodedBytes:300,expandedBytes:700}
]);
function source(){return issueSyntheticStreamDeclarationSource(validScreen());}
const good=(s:SyntheticStreamDeclarationSource=source())=>s.entries.map(entry=>({
 entryOrdinal:entry.ordinal,encodedBytes:entry.encodedBytes,
 expandedBytes:entry.expandedBytes,elapsedMs:20,endOfEntry:true
}));
function run(h:SyntheticStreamReview){
 let r=snapshotSyntheticStreamReview(h);
 for(let n=0;n<520&&r.status==='pending';n++)r=advanceSyntheticStreamReview(h);
 return r;
}
test('fluxo de blocos exige triagem sintética finalizada e emissão original',()=>{
 const h=createSyntheticContainerReview(session,{format:'zip-declared',
  entries:[{path:'def/a.sii',kind:'file',compression:'deflate',encodedBytes:100,expandedBytes:150}]});
 expect(()=>issueSyntheticStreamDeclarationSource(h)).toThrow('incompleta ou bloqueada');
 advanceSyntheticContainerReview(h);
 const s=issueSyntheticStreamDeclarationSource(h);
 expect(s.entries).toEqual([{ordinal:1,encodedBytes:100,expandedBytes:150}]);
 expect(Object.isFrozen(s.entries)).toBe(true);
 expect(Object.isFrozen(s.entries[0])).toBe(true);
});
test('catálogo bloqueado ou cancelado não emite origem de blocos',()=>{
 const bad=createSyntheticContainerReview(session,{format:'scs-proprietary-declared',entries:[]});
 expect(()=>issueSyntheticStreamDeclarationSource(bad)).toThrow('incompleta ou bloqueada');
 const stopped=createSyntheticContainerReview(session,{format:'zip-declared',entries:[]});
 cancelSyntheticContainerReview(stopped);
 expect(()=>issueSyntheticStreamDeclarationSource(stopped)).toThrow('incompleta ou bloqueada');
});
test('cópia de fonte ou de revisão não é reconhecida por vínculo privado',()=>{
 const s=source(),fixture=good(s);
 for(const fake of [{...s},JSON.parse(JSON.stringify(s))]){
  expect(()=>createSyntheticStreamReview(fake as SyntheticStreamDeclarationSource,fixture)).toThrow('não emitida');
 }
 const h=createSyntheticStreamReview(s,fixture);
 expect(()=>snapshotSyntheticStreamReview({...h})).toThrow('não emitido');
 expect(()=>cancelSyntheticStreamReview(JSON.parse(JSON.stringify(h)))).toThrow('não emitido');
});
test('dois blocos declarados consistentes só são liberados juntos ao fim',()=>{
 const s=source(),h=createSyntheticStreamReview(s,good(s));
 let r=snapshotSyntheticStreamReview(h);
 expect(r.status).toBe('pending');expect(r.releasedEntries).toBe(0);
 expect(r.processedChunks).toBe(0);
 r=advanceSyntheticStreamReview(h);
 expect(r.status).toBe('pending');expect(r.stagedEntries).toBe(1);
 expect(r.releasedEntries).toBe(0);
 expect(r.stagedEncodedBytes).toBe(400);
 r=advanceSyntheticStreamReview(h);
 expect(r.status).toBe('declarations-reviewed');
 expect(r.releasedEntries).toBe(2);
 expect(r.stagedEntries).toBe(0);
 expect(r.stagedEncodedBytes).toBe(0);
 expect(r.realBytesRead).toBe(0);expect(r.archiveParsed).toBe(false);
 expect(r.decompressionPerformed).toBe(false);expect(r.operationsEnabled).toBe(false);
});
test('interrupção no meio de um arquivo descarta totais e indicadores parciais',()=>{
 const s=source(),f=good(s);
 const half={...f[0],encodedBytes:200,expandedBytes:500,endOfEntry:false};
 const rest={...f[0],encodedBytes:200,expandedBytes:500};
 const h=createSyntheticStreamReview(s,[half,rest,f[1]]);
 const first=advanceSyntheticStreamReview(h);
 expect(first.stagedEncodedBytes).toBe(200);
 const stopped=cancelSyntheticStreamReview(h);
 expect(stopped.status).toBe('cancelled');expect(stopped.failure).toBe('cancelled');
 expect(stopped.discardedPartialResults).toBe(true);
 expect(stopped.releasedEntries).toBe(0);expect(stopped.stagedEntries).toBe(0);
 expect(stopped.stagedEncodedBytes).toBe(0);expect(stopped.stagedExpandedBytes).toBe(0);
 expect(stopped.declaredElapsedMs).toBe(0);
 expect(advanceSyntheticStreamReview(h)).toEqual(stopped);
});
test('interrupção depois de uma entrada terminada apaga resultados não publicados',()=>{
 const s=source(),h=createSyntheticStreamReview(s,good(s));
 expect(advanceSyntheticStreamReview(h).stagedEntries).toBe(1);
 const x=cancelSyntheticStreamReview(h);
 expect(x.releasedEntries).toBe(0);
 expect(x.stagedEntries).toBe(0);
 expect(x.discardedPartialResults).toBe(true);
});
test('truncamento depois de uma entrada impede publicar qualquer declaração',()=>{
 const s=source(),h=createSyntheticStreamReview(s,[good(s)[0]]);
 const x=run(h);
 expect(x.status).toBe('blocked');expect(x.failure).toBe('truncated-stream');
 expect(x.releasedEntries).toBe(0);expect(x.stagedEncodedBytes).toBe(0);
 expect(x.discardedPartialResults).toBe(true);
});
test('ordem invertida ou ordinal extra bloqueia antes de contabilizar',()=>{
 const s=source(),f=good(s);
 for(const list of [[f[1],f[0]],[{...f[0],entryOrdinal:3}]]){
  const x=run(createSyntheticStreamReview(s,list));
  expect(x.failure).toBe('entry-order');
  expect(x.processedChunks).toBe(0);
  expect(x.releasedEntries).toBe(0);
 }
});
test('fim de entrada com contagem errada descarta resultados',()=>{
 const s=source(),f=good(s);
 for(const wrong of [
  {...f[0],encodedBytes:399}, {...f[0],expandedBytes:999},
  {...f[0],endOfEntry:false}
 ]){
  const x=run(createSyntheticStreamReview(s,[wrong,...f.slice(1)]));
  expect(x.failure).toBe('size-mismatch');
  expect(x.discardedPartialResults).toBe(true);
 }
});
test('bloco acima de cota comprimida ou expandida não altera contador acumulado',()=>{
 const s=source(),f=good(s);
 const over=[
  {...f[0],encodedBytes:SYNTHETIC_STREAM_LIMITS.encodedBytesPerChunk+1},
  {...f[0],expandedBytes:SYNTHETIC_STREAM_LIMITS.expandedBytesPerChunk+1},
  {...f[0],encodedBytes:1,expandedBytes:101}
 ];
 for(const block of over){
  const x=advanceSyntheticStreamReview(createSyntheticStreamReview(s,[block,...f.slice(1)]));
  expect(x.failure).toBe('resource-limit');
  expect(x.stagedEncodedBytes).toBe(0);expect(x.releasedEntries).toBe(0);
 }
});
test('bloco acima do tempo declarado e total acumulado acima de cinco segundos bloqueiam',()=>{
 const s=source(),f=good(s);
 const tooSlow=run(createSyntheticStreamReview(s,[{...f[0],elapsedMs:251},f[1]]));
 expect(tooSlow.failure).toBe('time-limit');
 const entries=screen([{path:'def/long.sii',kind:'file',encodedBytes:10400,expandedBytes:10400}]);
 const longSource=issueSyntheticStreamDeclarationSource(entries);
 const many=Array.from({length:26},(_,i)=>({
  entryOrdinal:1,encodedBytes:400,expandedBytes:400,
  elapsedMs:200,endOfEntry:i===25
 }));
 const total=run(createSyntheticStreamReview(longSource,many));
 expect(total.failure).toBe('time-limit');
 expect(total.releasedEntries).toBe(0);
});
test('mesmo bloco com tempo zero continua sem comprovação real',()=>{
 const s=source(),f=good(s).map(x=>({...x,elapsedMs:0}));
 const x=run(createSyntheticStreamReview(s,f));
 expect(x.status).toBe('declarations-reviewed');
 expect(x.realIntegrityVerified).toBe(false);expect(x.realBytesRead).toBe(0);
});
test('contrato malformado, getter, campos extras e array não reconhecido são rejeitados',()=>{
 const s=source();
 expect(()=>createSyntheticStreamReview(s,{})).toThrow('inválidos');
 const malformed=[
  {...good(s)[0],path:'C:\\fake\\x.scs'},
  {entryOrdinal:1,encodedBytes:10,expandedBytes:10,elapsedMs:10},
  {...good(s)[0],entryOrdinal:-1},{...good(s)[0],expandedBytes:NaN},
  {...good(s)[0],elapsedMs:Infinity},{...good(s)[0],encodedBytes:1.4}
 ];
 for(const input of malformed){
  const x=run(createSyntheticStreamReview(s,[input]));
  expect(x.failure).toBe('invalid-chunk');
  expect(x.discardedPartialResults).toBe(true);
 }
 const accessor=Object.defineProperty({...good(s)[0]},'expandedBytes',{enumerable:true,get(){throw Error('untrusted getter')}});
 expect(run(createSyntheticStreamReview(s,[accessor])).failure).toBe('invalid-chunk');
});
test('mais de 512 blocos nem sequer são processados',()=>{
 const s=source();
 const over=Array.from({length:SYNTHETIC_STREAM_LIMITS.chunks+1},()=>({...good(s)[0]}));
 const x=run(createSyntheticStreamReview(s,over));
 expect(x.status).toBe('blocked');expect(x.failure).toBe('chunk-limit');
 expect(x.processedChunks).toBe(0);expect(x.totalDeclaredChunks).toBe(0);
});
test('catálogo com diretório usa ordinais da triagem original, sem caminho público',()=>{
 const h=screen([
  {path:'Vehicles',kind:'directory',encodedBytes:0,expandedBytes:0},
  {path:'Vehicles/car.bus',kind:'file',encodedBytes:100,expandedBytes:100}
 ]);
 const s=issueSyntheticStreamDeclarationSource(h);
 expect(s.entries).toEqual([{ordinal:2,encodedBytes:100,expandedBytes:100}]);
 const x=run(createSyntheticStreamReview(s,[{
  entryOrdinal:2,encodedBytes:100,expandedBytes:100,elapsedMs:10,endOfEntry:true
 }]));
 expect(x.status).toBe('declarations-reviewed');
});
test('arquivo vazio pode ser descrito sem confundir com leitura de dados',()=>{
 const h=screen([{path:'def/empty.cfg',kind:'file',encodedBytes:0,expandedBytes:0}]);
 const s=issueSyntheticStreamDeclarationSource(h);
 const x=run(createSyntheticStreamReview(s,[{
  entryOrdinal:1,encodedBytes:0,expandedBytes:0,elapsedMs:0,endOfEntry:true
 }]));
 expect(x.status).toBe('declarations-reviewed');expect(x.realBytesRead).toBe(0);
});
test('uma sequência vazia sem arquivos pode encerrar declaração, sem parser',()=>{
 const h=screen([]),s=issueSyntheticStreamDeclarationSource(h);
 const x=run(createSyntheticStreamReview(s,[]));
 expect(x.status).toBe('declarations-reviewed');expect(x.releasedEntries).toBe(0);
 expect(x.archiveParsed).toBe(false);
});
test('sequência vazia com arquivos não publica resultados e indica truncamento',()=>{
 const s=source();
 const x=run(createSyntheticStreamReview(s,[]));
 expect(x.status).toBe('blocked');expect(x.failure).toBe('truncated-stream');
 expect(x.releasedEntries).toBe(0);
});
test('dados originais mutados depois da criação não alteram o checkpoint',()=>{
 const s=source(),f=good(s),h=createSyntheticStreamReview(s,f);
 f[0].encodedBytes=999999;
 const x=run(h);
 expect(x.status).toBe('declarations-reviewed');
});
test('fluxo finalizado é idempotente e cancelamento posterior não retroage',()=>{
 const s=source(),h=createSyntheticStreamReview(s,good(s));
 const result=run(h);
 expect(advanceSyntheticStreamReview(h)).toEqual(result);
 expect(cancelSyntheticStreamReview(h)).toEqual(result);
});
test('snapshots e limites públicos são congelados e sem caminhos reais',()=>{
 const s=source(),h=createSyntheticStreamReview(s,good(s));
 const x=run(h),json=JSON.stringify(h)+JSON.stringify(x);
 expect(Object.isFrozen(h)).toBe(true);
 expect(Object.isFrozen(x)).toBe(true);
 expect(Object.isFrozen(SYNTHETIC_STREAM_LIMITS)).toBe(true);
 for(const secret of ['Vehicles/','sound/','def/','revisionTicket','synthetic-entry','SECRET_FILE','C:\\']){
  expect(json).not.toContain(secret);
 }
});
test('fluxo declarado nunca herda permissão de instalação ou dados de conteúdo real',()=>{
 const x=run(createSyntheticStreamReview(source(),good()));
 expect(x.decompressionPerformed).toBe(false);
 expect(x.dataRetainedBytes).toBe(0);
 expect(x.realIntegrityVerified).toBe(false);
 expect(x.operationsEnabled).toBe(false);
});
