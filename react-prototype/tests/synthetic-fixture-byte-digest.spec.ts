import {test,expect} from '@playwright/test';
import {
 buildSyntheticPackageIndex,projectSyntheticIndex,type SyntheticPackageIndex
} from '../src/synthetic-package-index';
import {
 checkSyntheticFixtureBytes,matchesSyntheticFixtureByteReceipt,
 SYNTHETIC_BYTE_DIGEST_LIMIT
} from '../src/synthetic-fixture-byte-digest';

const digest='9'.repeat(64);
const abcSha='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const abc=()=>new Uint8Array([97,98,99]);
function index(size=3,path='vehicles/candidate.bus'):SyntheticPackageIndex{
 const r=buildSyntheticPackageIndex(digest,[{
  path,kind:'file',encodedBytes:size,expandedBytes:size,declaredFormat:'well-formed'
 }]);
 expect(r.status).toBe('ready');
 return r.index!;
}
function handle(i:SyntheticPackageIndex):string{
 const h=projectSyntheticIndex(i,'definitions').entries.find(e=>e.kind==='file');
 expect(h).toBeDefined();
 return h!.handle;
}

test('calcula SHA-256 verdadeiro dos três bytes fictícios e compara com vetor conhecido',async()=>{
 const i=index(),h=handle(i);
 const r=await checkSyntheticFixtureBytes(i,h,abc(),abcSha);
 expect(r.status).toBe('matched');
 expect(r.reason).toBe('none');
 expect(r.fixtureSha256).toBe(abcSha);
 expect(r.fixtureByteCount).toBe(3);
 expect(r.bytesHashedFromMemory).toBe(true);
 expect(r.expectedFixtureDigestMatched).toBe(true);
 expect(r.realPackageRead).toBe(false);
 expect(r.realPackageDigestVerified).toBe(false);
 expect(r.gameVerified).toBe(false);
 expect(r.compatibilityVerified).toBe(false);
 expect(r.installationVerified).toBe(false);
 expect(r.operationsEnabled).toBe(false);
 expect(matchesSyntheticFixtureByteReceipt(i,h,r)).toBe(true);
 expect(Object.isFrozen(r)).toBe(true);
});
test('bytes diferentes com mesmo tamanho falham sem publicar digest parcial',async()=>{
 const i=index(),h=handle(i);
 const r=await checkSyntheticFixtureBytes(i,h,new Uint8Array([120,121,122]),abcSha);
 expect(r.status).toBe('rejected');
 expect(r.reason).toBe('digest-mismatch');
 expect(r.fixtureSha256).toBeNull();
 expect(r.handle).toBeNull();
 expect(matchesSyntheticFixtureByteReceipt(i,h,r)).toBe(false);
});
test('cópia de bytes acontece antes da espera pelo hash assíncrono',async()=>{
 const i=index(),h=handle(i),bytes=abc();
 const pending=checkSyntheticFixtureBytes(i,h,bytes,abcSha);
 bytes.fill(0);
 const r=await pending;
 expect(r.status).toBe('matched');
 expect(r.fixtureSha256).toBe(abcSha);
 expect(bytes).toEqual(new Uint8Array([0,0,0]));
});
test('declaração de tamanho divergente bloqueia mesmo com hash de conteúdo correto',async()=>{
 const i=index(4),h=handle(i);
 const r=await checkSyntheticFixtureBytes(i,h,abc(),abcSha);
 expect(r.reason).toBe('declared-size-mismatch');
 expect(r.bytesHashedFromMemory).toBe(false);
});
test('limite de bytes protege antes de chamar o provedor de hash',async()=>{
 const i=index(SYNTHETIC_BYTE_DIGEST_LIMIT+1),h=handle(i);
 const bytes=new Uint8Array(SYNTHETIC_BYTE_DIGEST_LIMIT+1);
 const r=await checkSyntheticFixtureBytes(i,h,bytes,abcSha);
 expect(r.reason).toBe('byte-limit');
 expect(r.bytesHashedFromMemory).toBe(false);
 expect(r.fixtureSha256).toBeNull();
});
test('recusa handle inexistente, diretório e itens de módulo fora do escopo',async()=>{
 const i=index(),h=handle(i);
 expect((await checkSyntheticFixtureBytes(i,'synthetic-entry-9999',abc(),abcSha)).reason)
  .toBe('invalid-handle');
 expect((await checkSyntheticFixtureBytes(i,'../private',abc(),abcSha)).reason)
  .toBe('invalid-handle');
 const other=index(3,'images/cover.png');
 // Media file is invisible to the definitions specialist.
 expect((await checkSyntheticFixtureBytes(other,'synthetic-entry-0001',abc(),abcSha)).reason)
  .toBe('invalid-handle');
 expect(matchesSyntheticFixtureByteReceipt(i,h,{})).toBe(false);
});
test('contratos inválidos e digest informado com formato incorreto são rejeitados',async()=>{
 const i=index(),h=handle(i);
 const scenarios:[unknown,unknown][]=[
  ['abc',abcSha],[null,abcSha],[abc(),'A'.repeat(64)],
  [abc(),'../fake'],[abc(),null],[new Uint8Array(),abcSha]
 ];
 for(const [bytes,expected] of scenarios){
  const r=await checkSyntheticFixtureBytes(i,h,bytes,expected);
  expect(r.status).toBe('rejected');
  expect(r.fixtureSha256).toBeNull();
  expect(r.operationsEnabled).toBe(false);
 }
});
test('clone JSON e revisão diferente não reutilizam recibo emitido',async()=>{
 const i=index(),h=handle(i);
 const r=await checkSyntheticFixtureBytes(i,h,abc(),abcSha);
 const clone=JSON.parse(JSON.stringify(r));
 const clonedIndex=JSON.parse(JSON.stringify(i)) as SyntheticPackageIndex;
 const next=index();
 expect(matchesSyntheticFixtureByteReceipt(i,h,clone)).toBe(false);
 expect(matchesSyntheticFixtureByteReceipt(clonedIndex,h,r)).toBe(false);
 expect(matchesSyntheticFixtureByteReceipt(next,h,r)).toBe(false);
 expect((await checkSyntheticFixtureBytes(clonedIndex,h,abc(),abcSha)).reason)
  .toBe('invalid-index');
});
test('saída jamais expõe nomes privados, caminhos ou bytes brutos',async()=>{
 const i=index(3,'vehicles/PrivateCustomer9988.bus'),h=handle(i);
 const r=await checkSyntheticFixtureBytes(i,h,abc(),abcSha);
 const json=JSON.stringify(r);
 for(const secret of ['PrivateCustomer','vehicles/','candidate.bus','abc','\\']){
  expect(json).not.toContain(secret);
 }
 // No output looks like authorization for real file access.
 expect(r.source).toBe('synthetic-fixture');
 expect(r.stage).toBe('in-memory-byte-digest-only');
 expect(r.realPackageRead).toBe(false);
});
