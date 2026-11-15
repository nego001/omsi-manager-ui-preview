import {test,expect} from '@playwright/test';
import {
 buildSyntheticPackageIndex,projectSyntheticIndex,type SyntheticPackageIndex
} from '../src/synthetic-package-index';
import {
 checkSyntheticFixtureBytes
} from '../src/synthetic-fixture-byte-digest';
import {
 compareSyntheticFixtureReceipts,recheckSyntheticFixtureBytes
} from '../src/synthetic-two-pass-recheck';

const digest='5'.repeat(64);
const abcSha='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const xyzSha='3608bca1e44ea6c4d268eb6db02260269892c0b42b86bbf1e77a6fa16c3c9282';
const abc=()=>new Uint8Array([97,98,99]);
const xyz=()=>new Uint8Array([120,121,122]);

function index(paths=['vehicles/model.bus']):SyntheticPackageIndex{
 const r=buildSyntheticPackageIndex(digest,paths.map(path=>({
  path,kind:'file',encodedBytes:3,expandedBytes:3,declaredFormat:'well-formed'
 })));
 expect(r.status).toBe('ready');
 return r.index!;
}
function handle(i:SyntheticPackageIndex,ordinal=0){
 const h=projectSyntheticIndex(i,'definitions').entries.filter(e=>e.kind==='file')[ordinal];
 expect(h).toBeDefined();
 return h.handle;
}
test('duas verificações de buffers fictícios separados mantêm apenas estado inalterado do fixture',async()=>{
 const i=index(),h=handle(i);
 const review=await recheckSyntheticFixtureBytes(i,h,abc(),abcSha,abc(),abcSha);
 expect(review.status).toBe('unchanged-fixture');
 expect(review.reason).toBe('none');
 expect(review.sameFixtureBytes).toBe(true);
 expect(review.firstByteCount).toBe(3);
 expect(review.secondByteCount).toBe(3);
 expect(review.twoDistinctReceipts).toBe(true);
 expect(review.previousEvidenceReusable).toBe(false);
 expect(review.realPackageDigestVerified).toBe(false);
 expect(review.realPackageRead).toBe(false);
 expect(review.gameVerified).toBe(false);
 expect(review.compatibilityVerified).toBe(false);
 expect(review.installationVerified).toBe(false);
 expect(review.operationsEnabled).toBe(false);
 expect(Object.isFrozen(review)).toBe(true);
});
test('mesmo tamanho mas conteúdo fictício alterado é detectado por SHA-256',async()=>{
 const i=index(),h=handle(i);
 const review=await recheckSyntheticFixtureBytes(i,h,abc(),abcSha,xyz(),xyzSha);
 expect(review.status).toBe('changed-fixture');
 expect(review.reason).toBe('none');
 expect(review.sameFixtureBytes).toBe(false);
 expect(review.previousEvidenceReusable).toBe(false);
 expect(review.operationsEnabled).toBe(false);
});
test('primeiro hash esperado incorreto rejeita antes de comparar resultados',async()=>{
 const i=index(),h=handle(i);
 const review=await recheckSyntheticFixtureBytes(i,h,abc(),xyzSha,abc(),abcSha);
 expect(review.status).toBe('blocked');
 expect(review.reason).toBe('first-pass-rejected');
 expect(review.sameFixtureBytes).toBeNull();
 expect(review.twoDistinctReceipts).toBe(false);
});
test('segundo hash esperado incorreto rejeita sem publicar primeiro digest',async()=>{
 const i=index(),h=handle(i);
 const review=await recheckSyntheticFixtureBytes(i,h,abc(),abcSha,xyz(),abcSha);
 expect(review.status).toBe('blocked');
 expect(review.reason).toBe('second-pass-rejected');
 expect(review.firstByteCount).toBe(0);
 expect(JSON.stringify(review)).not.toContain(abcSha);
});
test('mesmo Uint8Array ou duas views do mesmo buffer não são verificações separadas',async()=>{
 const i=index(),h=handle(i),data=abc();
 const same=await recheckSyntheticFixtureBytes(i,h,data,abcSha,data,abcSha);
 expect(same.reason).toBe('reused-buffer');
 const view=new Uint8Array(data.buffer,0,3);
 const alias=await recheckSyntheticFixtureBytes(i,h,data,abcSha,view,abcSha);
 expect(alias.reason).toBe('reused-buffer');
});
test('o mesmo recibo do M4 não pode ser reciclado como duas passagens',async()=>{
 const i=index(),h=handle(i);
 const receipt=await checkSyntheticFixtureBytes(i,h,abc(),abcSha);
 const review=compareSyntheticFixtureReceipts(i,h,receipt,receipt);
 expect(review.status).toBe('blocked');
 expect(review.reason).toBe('reused-receipt');
});
test('comparação direta de dois recibos distintos legítimos funciona sem expor hashes',async()=>{
 const i=index(),h=handle(i);
 const a=await checkSyntheticFixtureBytes(i,h,abc(),abcSha);
 const b=await checkSyntheticFixtureBytes(i,h,xyz(),xyzSha);
 const review=compareSyntheticFixtureReceipts(i,h,a,b);
 expect(review.status).toBe('changed-fixture');
 expect(review.twoDistinctReceipts).toBe(true);
 expect(JSON.stringify(review)).not.toContain(abcSha);
 expect(JSON.stringify(review)).not.toContain(xyzSha);
});
test('recibos de outra revisão, outro handle ou clone JSON falham fechados',async()=>{
 const i=index(['vehicles/a.bus','vehicles/b.bus']),h=handle(i);
 const a=await checkSyntheticFixtureBytes(i,h,abc(),abcSha);
 const b=await checkSyntheticFixtureBytes(i,h,abc(),abcSha);
 const other=index(['vehicles/a.bus','vehicles/b.bus']);
 expect(compareSyntheticFixtureReceipts(other,handle(other),a,b).reason).toBe('unissued-receipt');
 expect(compareSyntheticFixtureReceipts(i,handle(i,1),a,b).reason).toBe('unissued-receipt');
 expect(compareSyntheticFixtureReceipts(i,h,JSON.parse(JSON.stringify(a)),b).reason)
  .toBe('unissued-receipt');
 expect(compareSyntheticFixtureReceipts(i,h,a,{}).status).toBe('blocked');
});
test('índice forjado e handles de mídia fora do escopo são bloqueados',async()=>{
 const i=index(),h=handle(i),clone=JSON.parse(JSON.stringify(i)) as SyntheticPackageIndex;
 expect((await recheckSyntheticFixtureBytes(clone,h,abc(),abcSha,abc(),abcSha)).reason)
  .toBe('invalid-index');
 expect((await recheckSyntheticFixtureBytes(i,'synthetic-entry-9999',abc(),abcSha,abc(),abcSha)).reason)
  .toBe('invalid-handle');
 const image=index(['images/cover.png']);
 expect((await recheckSyntheticFixtureBytes(image,'synthetic-entry-0001',abc(),abcSha,abc(),abcSha)).reason)
  .toBe('invalid-handle');
});
test('entradas inválidas e sobrelimite não publicam nenhuma evidência parcial',async()=>{
 const i=index(),h=handle(i);
 const wrong=await recheckSyntheticFixtureBytes(i,h,'abc',abcSha,abc(),abcSha);
 expect(wrong.reason).toBe('first-pass-rejected');
 const invalid=await recheckSyntheticFixtureBytes(i,h,abc(),abcSha,null,xyzSha);
 expect(invalid.reason).toBe('second-pass-rejected');
 const large=new Uint8Array(65537);
 const oversized=await recheckSyntheticFixtureBytes(i,h,large,abcSha,abc(),abcSha);
 expect(oversized.reason).toBe('first-pass-rejected');
 for(const review of [wrong,invalid,oversized]){
  expect(review.firstByteCount).toBe(0);
  expect(review.secondByteCount).toBe(0);
  expect(review.realPackageRead).toBe(false);
  expect(review.operationsEnabled).toBe(false);
 }
});
test('saída não inclui nomes privados, caminhos nem dados/expectativas de hash',async()=>{
 const i=index(['vehicles/private_12345.bus']),h=handle(i);
 const review=await recheckSyntheticFixtureBytes(i,h,abc(),abcSha,xyz(),xyzSha);
 const printed=JSON.stringify(review);
 for(const secret of ['private_12345','vehicles/','abc',abcSha,xyzSha,'\\']){
  expect(printed).not.toContain(secret);
 }
 expect(review.source).toBe('synthetic-fixture');
 expect(review.stage).toBe('two-pass-memory-only');
});
