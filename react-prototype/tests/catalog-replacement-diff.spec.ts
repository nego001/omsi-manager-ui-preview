import {test,expect} from '@playwright/test';
import {compareDeclaredCatalogs} from '../src/catalog-replacement-diff';
import {parseCatalogManifest,type CatalogMod} from '../src/catalog';

const base:CatalogMod={id:'bus',title:'Ônibus',game:'omsi',category:'Ônibus',
 version:'1.0',size:'120 MB',description:'Registro declarativo',safe:true,
 requires:['one','two'],conflictsWith:['three'],
 gameVersionRange:{min:'1.0',max:'2.0'},
 requiresMinVersions:[{id:'two',minVersion:'2.0'},{id:'one',minVersion:'1.0'}]};
test('compara IDs em dois catálogos, sem concluir que representam o mesmo mod real',()=>{
 const before=[base,{...base,id:'vanished',title:'Saiu'},{...base,id:'stable',title:'Mantido'}];
 const after=[{...base,version:'2.0',title:'Outro ônibus',game:'ets2'},
  {...base,id:'stable',title:'Mantido'},
  {...base,id:'added',title:'Novo'}];
 const prior=JSON.stringify(before),later=JSON.stringify(after);
 const diff=compareDeclaredCatalogs(before,after);
 expect(diff.unchanged).toBe(1);
 expect(diff.changed).toEqual([{id:'bus',oldTitle:'Ônibus',newTitle:'Outro ônibus',
  fields:['title','game','version']}]);
 expect(diff.removed).toEqual([{id:'vanished',title:'Saiu'}]);
 expect(diff.added).toEqual([{id:'added',title:'Novo'}]);
 expect(JSON.stringify(before)).toBe(prior);
 expect(JSON.stringify(after)).toBe(later);
});
test('ignora somente a ordem de listas equivalentes de dependências declaradas',()=>{
 const next={...base,requires:['two','one'],conflictsWith:['three'],
  requiresMinVersions:[{id:'one',minVersion:'1.0'},{id:'two',minVersion:'2.0'}]};
 expect(compareDeclaredCatalogs([base],[next])).toMatchObject({
  unchanged:1,changed:[],removed:[],added:[]
 });
 const changed={...next,requiresMinVersions:[{id:'one',minVersion:'9.0'},{id:'two',minVersion:'2.0'}]};
 expect(compareDeclaredCatalogs([base],[changed]).changed[0].fields)
  .toEqual(['requiresMinVersions']);
});
test('parser de manifesto mantém comparação restrita a metadados e rejeita duplicações',()=>{
 const serialized=JSON.stringify({schemaVersion:1,mods:[
  {id:'bus',title:'Ônibus',game:'omsi',category:'Ônibus',version:'1.0',
   size:'120 MB',description:'Somente catálogo'}
 ]});
 const catalog=parseCatalogManifest(serialized);
 expect(compareDeclaredCatalogs(catalog,catalog).unchanged).toBe(1);
 expect(()=>compareDeclaredCatalogs([base,base],[base]))
  .toThrow('DECLARED_CATALOG_COMPARISON_INVALID');
 expect(()=>compareDeclaredCatalogs([], [base]))
  .toThrow('DECLARED_CATALOG_COMPARISON_INVALID');
});
