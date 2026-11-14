import {test,expect} from '@playwright/test';
import {buildSyntheticPackageIndex,type SyntheticPackageIndex} from '../src/synthetic-package-index';
import {planSyntheticRevalidation,projectPendingSyntheticRevalidation} from '../src/synthetic-index-revalidation';
import {SYNTHETIC_MODULE_IDS} from '../src/distributed-reader-contract';

const digest='f'.repeat(64);
const other='a'.repeat(64);
const entry=(path:string,encodedBytes=100,expandedBytes=150,kind='file')=>({
 path,kind,encodedBytes,expandedBytes,declaredFormat:'well-formed'
});
const issued=(paths:ReturnType<typeof entry>[],hash=digest)=>{
 const r=buildSyntheticPackageIndex(hash,paths);
 expect(r.status).toBe('ready');
 return r.index!;
};
function checkClosed(plan:ReturnType<typeof planSyntheticRevalidation>){
 expect(plan.previousSnapshotInvalidated).toBe(true);
 expect(plan.previousEvidenceReusable).toBe(false);
 expect(plan.handlesReusableAcrossIndexes).toBe(false);
 expect(plan.actualContentVerified).toBe(false);
 expect(plan.operationsEnabled).toBe(false);
 expect(plan.requiredBeforeNewClaims).toEqual(SYNTHETIC_MODULE_IDS);
 const projection=projectPendingSyntheticRevalidation(plan);
 expect(projection.gameCandidate).toBeNull();
 expect(projection.installer.enabled).toBe(false);
 expect(projection.workshop.audioEnabled).toBe(false);
 expect(projection.workshop.skinEnabled).toBe(false);
}
test('mudança de textura marca recursos e mídia, invalida conclusões anteriores',()=>{
 const a=issued([entry('Vehicles/bus.bus'),entry('skins/coat.dds')]);
 const b=issued([entry('Vehicles/bus.bus'),entry('skins/coat.dds',110,160)]);
 const plan=planSyntheticRevalidation(a,b);
 expect(plan.reason).toBe('declared-structure-changed');
 expect(plan.changeCounts).toEqual({added:0,removed:0,modified:1});
 expect(plan.affectedModules).toEqual(['structure','definitions','resources','media']);
 checkClosed(plan);
});
test('mudança de áudio marca o setor de áudio e dependentes',()=>{
 const a=issued([entry('audio/engine.wav')]);
 const b=issued([entry('audio/engine.wav',105,200)]);
 const plan=planSyntheticRevalidation(a,b);
 expect(plan.affectedModules).toEqual(['structure','definitions','audio']);
 checkClosed(plan);
});
test('manifesto alterado exige conferir metadados e relações',()=>{
 const a=issued([entry('metadata/file.json')]);
 const b=issued([entry('metadata/file.json',180,200)]);
 const p=planSyntheticRevalidation(a,b);
 expect(p.affectedModules).toEqual(['structure','manifest','relations']);
 checkClosed(p);
});
test('definição SII impacta jogo, relações e sons declarativos',()=>{
 const a=issued([entry('def/vehicle.sii')]);
 const b=issued([entry('def/vehicle.sii',200,350)]);
 const p=planSyntheticRevalidation(a,b);
 expect(p.affectedModules).toEqual(['structure','manifest','definitions','audio','relations']);
 checkClosed(p);
});
test('arquivos SCS e ZIP potencialmente compostos exigem conferir TODOS os módulos',()=>{
 for(const path of ['mod/sample.scs','mod/sample.zip']){
  const a=issued([entry(path)]);
  const b=issued([entry(path,115,175)]);
  const p=planSyntheticRevalidation(a,b);
  expect(p.affectedModules).toEqual(SYNTHETIC_MODULE_IDS);
  checkClosed(p);
 }
});
test('inclusão de arquivo desloca handles posicionais e invalida evidências antigas',()=>{
 const a=issued([entry('mods/z.scs')]);
 const b=issued([entry('mods/a.scs'),entry('mods/z.scs')]);
 expect(a.entries[0].handle).toBe(b.entries[0].handle);
 const p=planSyntheticRevalidation(a,b);
 expect(p.changeCounts.added).toBe(1);
 expect(p.declaredStructureChanged).toBe(true);
 checkClosed(p);
});
test('renomeação com MESMA extensão, grupo e tamanho não passa despercebida',()=>{
 const a=issued([entry('audio/engine_old.wav')]);
 const b=issued([entry('audio/engine_new.wav')]);
 expect(a.entries).toEqual(b.entries);
 const p=planSyntheticRevalidation(a,b);
 expect(p.changeCounts).toEqual({added:1,removed:1,modified:0});
 expect(p.affectedModules).toEqual(['structure','definitions','audio']);
 checkClosed(p);
});
test('ordem de entrada e diferenças de caixa não causam mudanças falsas',()=>{
 const a=issued([entry('Vehicles/A.bus'),entry('skins/coat.dds')]);
 const b=issued([entry('SKINS/COAT.DDS'),entry('vehicles/a.bus')]);
 const p=planSyntheticRevalidation(a,b);
 expect(p.declaredStructureChanged).toBe(false);
 expect(p.changeCounts).toEqual({added:0,removed:0,modified:0});
 expect(p.reason).toBe('identical-declarations-unverified');
 checkClosed(p);
});
test('estrutura idêntica ainda NÃO comprova integridade de bytes nem permite reuso',()=>{
 const a=issued([entry('audio/example.bank')]);
 const b=issued([entry('audio/example.bank')]);
 const p=planSyntheticRevalidation(a,b);
 expect(p.affectedModules).toEqual([]);
 expect(p.status).toBe('recheck-required');
 expect(p.requiredBeforeNewClaims).toEqual(SYNTHETIC_MODULE_IDS);
 checkClosed(p);
});
test('troca do digest declarado invalida tudo mesmo sem alterar entradas',()=>{
 const a=issued([entry('Vehicles/a.bus')],digest);
 const b=issued([entry('Vehicles/a.bus')],other);
 const p=planSyntheticRevalidation(a,b);
 expect(p.reason).toBe('declared-digest-changed');
 expect(p.affectedModules).toEqual(SYNTHETIC_MODULE_IDS);
 checkClosed(p);
});
test('entradas desconhecidas ou diretórios modificados forçam revisão geral',()=>{
 const a=issued([entry('unknown/what.dat')]);
 const b=issued([entry('unknown/what.dat',104,170)]);
 const p=planSyntheticRevalidation(a,b);
 expect(p.affectedModules).toEqual(SYNTHETIC_MODULE_IDS);
 checkClosed(p);
});
test('diretório sintético adicionado exige revisar especialistas sem inferir jogo',()=>{
 const a=issued([entry('Vehicles/a.bus')]);
 const b=issued([entry('Vehicles/a.bus'),entry('Vehicles',0,0,'directory')]);
 const p=planSyntheticRevalidation(a,b);
 expect(p.affectedModules).toEqual(SYNTHETIC_MODULE_IDS);
 checkClosed(p);
});
test('mudança de formato (extensão) invalida pistas antigas com novos grupos',()=>{
 const a=issued([entry('media/sample.wav')]);
 const b=issued([entry('media/sample.png')]);
 const p=planSyntheticRevalidation(a,b);
 expect(p.changeCounts).toEqual({added:1,removed:1,modified:0});
 expect(p.affectedModules).toEqual(['structure','definitions','resources','audio','media']);
 checkClosed(p);
});
test('índice falsificado é recusado e não compartilha dados de revisão',()=>{
 const a=issued([entry('mod/a.scs')]);
 const fake=JSON.parse(JSON.stringify(a)) as SyntheticPackageIndex;
 const p=planSyntheticRevalidation(a,fake);
 expect(p.status).toBe('blocked');
 expect(p.reason).toBe('untrusted-index');
 expect(p.affectedModules).toEqual([]);
 checkClosed(p);
});
test('resultado não expõe caminhos, nomes privados nem handles antigos',()=>{
 const a=issued([entry('private/SecretName92834.dds')]);
 const b=issued([entry('private/SecretName92834.dds',105,170)]);
 const p=planSyntheticRevalidation(a,b);
 const serialized=JSON.stringify(p)+JSON.stringify(projectPendingSyntheticRevalidation(p));
 for(const secret of ['SecretName92834','private/','synthetic-entry-','/'])expect(serialized).not.toContain(secret);
 expect(Object.isFrozen(p)).toBe(true);
 expect(Object.isFrozen(p.affectedModules)).toBe(true);
 expect(Object.isFrozen(p.changeCounts)).toBe(true);
 checkClosed(p);
});
test('mesmo objeto de índice não é certificado como bytes iguais',()=>{
 const a=issued([entry('audio/sound.wav')]);
 const p=planSyntheticRevalidation(a,a);
 expect(p.declaredStructureChanged).toBe(false);
 expect(p.actualContentVerified).toBe(false);
 checkClosed(p);
});
