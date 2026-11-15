import {test,expect} from '@playwright/test';
import {
 buildSyntheticPackageIndex,projectSyntheticIndex,SYNTHETIC_ENTRY_LIMITS,
 type SyntheticPackageIndex,type SyntheticIndexReason
} from '../src/synthetic-package-index';
import {simulateSyntheticScenario} from '../src/synthetic-reader-scenarios';
import {SYNTHETIC_MODULE_IDS,type SyntheticModuleId} from '../src/distributed-reader-contract';

const digest='d'.repeat(64);
const entry=(path:string,kind='file')=>({
 path,kind,encodedBytes:kind==='directory'?0:100,
 expandedBytes:kind==='directory'?0:300,declaredFormat:'well-formed'
});
function ready(paths=['Vehicles/Bus01.bus','maps/TestMap.cfg']){
 const result=buildSyntheticPackageIndex(digest,paths.map(p=>entry(p)));
 expect(result.status).toBe('ready');
 expect(result.index).not.toBeNull();
 return result.index!;
}
function blocked(entries:unknown):SyntheticIndexReason{
 const result=buildSyntheticPackageIndex(digest,entries);
 expect(result.status).toBe('rejected');
 expect(result.index).toBeNull();
 return result.reason;
}

test('gate sintético emite um único índice imutável, ordenado e sem acesso real',()=>{
 const index=ready(['Vehicles/Bus01.bus','maps/TestMap.cfg','mod/candidate.scs']);
 expect(index.schemaVersion).toBe(1);
 expect(index.source).toBe('synthetic-fixture');
 expect(index.identity).toBe('fixture-index-v1');
 expect(index.digestVerified).toBe(false);
 expect(index.gameVerified).toBe(false);
 expect(index.operationsEnabled).toBe(false);
 expect(index.entryCount).toBe(3);
 expect(index.files).toBe(3);
 expect(index.directories).toBe(0);
 expect(index.encodedBytes).toBe(300);
 expect(index.expandedBytes).toBe(900);
 expect(index.entries.map(e=>e.handle)).toEqual(['synthetic-entry-0001','synthetic-entry-0002','synthetic-entry-0003']);
 expect(Object.isFrozen(index)).toBe(true);
 expect(Object.isFrozen(index.entries)).toBe(true);
 expect(index.entries.every(e=>Object.isFrozen(e))).toBe(true);
});
test('ordem e caixa dos caminhos não afetam o índice compartilhado',()=>{
 const a=ready(['Vehicles/A.bus','maps/B.cfg','mod/C.scs']);
 const b=ready(['MOD/c.scs','MAPS/b.cfg','VEHICLES/a.bus']);
 expect(a).toEqual(b);
});
test('índice e projeções não vazam nomes completos, subpastas ou caminho privado',()=>{
 const secret='PrivateCustomer8765/MyRealBus5279.bus';
 const i=ready([secret,'Vehicles/VeryPrivateRepaint99.dds']);
 const projections=SYNTHETIC_MODULE_IDS.map(id=>projectSyntheticIndex(i,id));
 const serialized=JSON.stringify({index:i,projections});
 for(const forbidden of ['PrivateCustomer8765','MyRealBus5279','VeryPrivateRepaint99','.bus','/','\\']){
  expect(serialized).not.toContain(forbidden);
 }
 expect(i.entries.map(e=>e.root)).toEqual(['other','vehicles']);
 expect(i.entries.map(e=>e.suffix)).toEqual(['bus','dds']);
});
test('projeções limitam cada módulo às pistas declarativas de que precisa',()=>{
 const index=ready([
  'Vehicles/BUS.bus','scripts/BUS.cfg','materials/coat.dds','audio/motor.wav',
  'mod/payload.scs','pack/manifest.json','audio/test.bank','img/cover.png',
  'def/vehicle.sii','map/unknown.private'
 ]);
 const structure=projectSyntheticIndex(index,'structure');
 expect(structure.entries).toHaveLength(index.entryCount);
 const gate=projectSyntheticIndex(index,'container');
 expect(gate.entries).toHaveLength(0);
 const definition=projectSyntheticIndex(index,'definitions');
 expect(definition.entries.map(x=>x.suffix).sort()).toEqual(['bus','cfg','sii']);
 const audio=projectSyntheticIndex(index,'audio');
 expect(audio.entries.map(x=>x.suffix).sort()).toEqual(['bank','wav']);
 const media=projectSyntheticIndex(index,'media');
 expect(media.entries.map(x=>x.suffix).sort()).toEqual(['dds','png']);
 const manifest=projectSyntheticIndex(index,'manifest');
 expect(manifest.entries.map(x=>x.suffix).sort()).toEqual(['json','sii']);
 expect(projectSyntheticIndex(index,'relations').entries.map(x=>x.suffix).sort()).toEqual(['json','sii']);
 expect(projectSyntheticIndex(index,'resources').entries.map(x=>x.suffix).sort()).toEqual(['dds','png']);
 expect(structure.entries[0]).toBe(index.entries[0]);
 for(const view of [structure,audio,media,gate]){
  expect(view.operationsEnabled).toBe(false);
  expect(view.verified).toBe(false);
  expect(view.fixtureDigest).toBe(digest);
  expect(Object.isFrozen(view)).toBe(true);
  expect(Object.isFrozen(view.entries)).toBe(true);
 }
});
test('extensões não reconhecidas viram desconhecidas, não instruções executáveis',()=>{
 const i=ready(['x/malware.exe','x/file.bat','x/random.foo','mod/truck_ats.scs']);
 expect(i.entries.map(e=>e.suffix)).toEqual(['scs','unknown','unknown','unknown']);
 expect(i.gameVerified).toBe(false);
 expect(projectSyntheticIndex(i,'definitions').entries).toHaveLength(0);
});
test('pasta e arquivo têm classificação de entrada, mas não são instalações reais',()=>{
 const out=buildSyntheticPackageIndex(digest,[
  entry('Vehicles','directory'),entry('Vehicles/A.bus'),entry('maps','directory')
 ]);
 expect(out.status).toBe('ready');
 expect(out.index?.files).toBe(1);
 expect(out.index?.directories).toBe(2);
 expect(out.index?.entries.filter(e=>e.kind==='directory').every(e=>e.suffix==='unknown')).toBe(true);
 expect(out.index?.gameVerified).toBe(false);
});
test('arquivos declarados como pastas com tamanho impedem criação do índice',()=>{
 const bad=entry('vehicles','directory');bad.encodedBytes=42;
 expect(blocked([bad])).toBe('invalid-fixture');
});
test('rejeita traversal, absolutos, separador Windows, controles e nomes reservados',()=>{
 for(const name of ['../secret.scs','./a.scs','a/../b.scs','/etc/passwd','C:\\Mods\\file.scs','a//b','a/CON.txt','a/AUX','a/LPT1.wav','a/file.','a/\u0000secret','a/z?bad']){
  expect(blocked([entry(name)]),name).toBe('unsafe-entry');
 }
});
test('rejeita colisões case-insensitive, inclusive arquivo-pai contraditório',()=>{
 expect(blocked([entry('MOD/A.scs'),entry('mod/a.scs')])).toBe('unsafe-entry');
 expect(blocked([entry('Vehicles'),entry('vehicles/A.bus')])).toBe('unsafe-entry');
 expect(blocked([entry('mod/a/b.scs'),entry('MOD/A')])).toBe('unsafe-entry');
});
test('links sintéticos e formato malformado nunca publicam índice parcial',()=>{
 expect(blocked([entry('vehicles/A.bus','symlink')])).toBe('unsafe-entry');
 const broken=entry('mod/broken.scs');broken.declaredFormat='broken';
 expect(blocked([entry('maps/ok.cfg'),broken])).toBe('malformed-entry');
});
test('rejeita campos inesperados, caminho inadequado e tamanhos fracionários',()=>{
 expect(blocked([{...entry('mod/A.scs'),command:'delete'}])).toBe('invalid-fixture');
 expect(blocked([{...entry('mod/A.scs'),encodedBytes:0.5}])).toBe('invalid-fixture');
 expect(blocked([{...entry('mod/A.scs'),encodedBytes:-1}])).toBe('invalid-fixture');
 expect(blocked([{...entry('mod/A.scs'),expandedBytes:Infinity}])).toBe('invalid-fixture');
 expect(blocked([entry('x/'.repeat(13)+'y.scs')])).toBe('unsafe-entry');
 expect(blocked([entry('a'.repeat(SYNTHETIC_ENTRY_LIMITS.path+1))])).toBe('unsafe-entry');
});
test('rejeita zip bomb fictícia e orçamentos globais',()=>{
 expect(blocked([{...entry('mods/test.scs'),encodedBytes:1,expandedBytes:101}])).toBe('resource-limit');
 expect(blocked([{...entry('mods/test.scs'),encodedBytes:0,expandedBytes:1}])).toBe('resource-limit');
 expect(blocked([{...entry('mods/test.scs'),encodedBytes:SYNTHETIC_ENTRY_LIMITS.encodedBytes+1}])).toBe('resource-limit');
 expect(blocked([{...entry('mods/test.scs'),encodedBytes:60000,expandedBytes:SYNTHETIC_ENTRY_LIMITS.expandedBytes+1}])).toBe('resource-limit');
 expect(blocked(Array.from({length:SYNTHETIC_ENTRY_LIMITS.entries+1},(_,n)=>entry('mod/item'+n+'.scs')))).toBe('invalid-fixture');
});
test('entradas com digest ausente, formato falso ou objeto estranho são recusadas',()=>{
 expect(buildSyntheticPackageIndex('X'.repeat(64),[entry('mod/a.scs')]).reason).toBe('invalid-fixture');
 expect(buildSyntheticPackageIndex(digest,{entries:[entry('mod/a.scs')]}).reason).toBe('invalid-fixture');
 expect(buildSyntheticPackageIndex(digest,[{...entry('a.scs'),declaredFormat:'untrusted'}]).reason).toBe('invalid-fixture');
 expect(buildSyntheticPackageIndex(digest,[null]).reason).toBe('invalid-fixture');
});
test('índices falsificados e IDs de módulos desconhecidos não conseguem projeção',()=>{
 const i=ready(['mod/a.scs']);
 const cloned=JSON.parse(JSON.stringify(i)) as SyntheticPackageIndex;
 expect(()=>projectSyntheticIndex(cloned,'structure')).toThrow('Projeção sintética inválida');
 expect(()=>projectSyntheticIndex(i,'evil' as SyntheticModuleId)).toThrow('Projeção sintética inválida');
});
test('simulador usa o MESMO tipo de índice e não transforma sufixo SCS em reconhecimento',()=>{
 const src={
  fixtureDigest:digest,entries:[entry('mod/Truck_ats.scs')],
  modules:[],cancelAtMs:null
 };
 const out=simulateSyntheticScenario(src);
 expect(out.status).toBe('incomplete');
 expect(out.reason).toBe('missing-module');
 expect(out.index?.entries).toHaveLength(1);
 expect(out.index?.entries[0].suffix).toBe('scs');
 expect(out.index?.gameVerified).toBe(false);
 expect(out.snapshot.candidateGame).toBeNull();
 expect(out.operationsEnabled).toBe(false);
});
test('gate recusado deixa índice nulo e não passa material inseguro aos módulos',()=>{
 const out=simulateSyntheticScenario({
  fixtureDigest:digest,entries:[entry('../escape.bat')],modules:[],cancelAtMs:null
 });
 expect(out.status).toBe('blocked');
 expect(out.index).toBeNull();
 expect(out.completedModules).toEqual([]);
 expect(out.snapshot.findings).toContain('gate-blocked');
});
