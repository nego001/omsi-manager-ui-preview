import {test,expect} from '@playwright/test';
import type {CatalogMod} from '../src/catalog';
import {compareDeclaredCatalogs} from '../src/catalog-replacement-diff';
import {summarizeSelectedCatalogImpact} from '../src/selection-catalog-impact';

const base:CatalogMod={id:'bus',title:'Ônibus',game:'omsi',category:'Ônibus',
 version:'1.0',description:'Apenas teste',size:'100 MB',safe:true};
test('recorta somente a seleção ativa: ID igual, metadados alterados, desaparecido',()=>{
 const current=[base,{...base,id:'map',title:'Mapa',category:'Mapas'},
  {...base,id:'sound',title:'Som',category:'Sons'}, {...base,id:'other',title:'Outro'}];
 const future=[{...base,version:'3.0'},current[1],current[3]];
 const raw=JSON.stringify([current,future]);
 const result=summarizeSelectedCatalogImpact(current,['sound','bus','map'],
  compareDeclaredCatalogs(current,future));
 expect(result).toMatchObject({
  total:3,
  unchanged:[{id:'map',title:'Mapa'}],
  changed:[{id:'bus',oldTitle:'Ônibus',newTitle:'Ônibus',fields:['version']}],
  removed:[{id:'sound',title:'Som'}],
  allSelectionsDiscardedOnConfirmation:true,
  installedPackagesCompared:false,sameIdProvesPackageIdentity:false
 });
 expect(JSON.stringify([current,future])).toBe(raw);
 expect(Object.isFrozen(result)).toBe(true);
 expect(Object.isFrozen(result.changed[0].fields)).toBe(true);
});
test('seleção vazia é um resultado neutro, sem migração implícita',()=>{
 const result=summarizeSelectedCatalogImpact([base],[],compareDeclaredCatalogs([base],[base]));
 expect(result).toMatchObject({total:0,changed:[],removed:[],unchanged:[],
  allSelectionsDiscardedOnConfirmation:true});
});
test('recusa ID selecionado ausente, duplicação e diff incoerente',()=>{
 const current=[base,{...base,id:'map',title:'Mapa'}];
 const good=compareDeclaredCatalogs(current,[base]);
 for(const ids of [['bus','bus'],['gone'],['map','gone']])
  expect(()=>summarizeSelectedCatalogImpact(current,ids,good))
   .toThrow('FAVORITE_CATALOG_IMPACT_INVALID');
 expect(()=>summarizeSelectedCatalogImpact(current,['bus'],{
  ...good,changed:[{id:'bus',oldTitle:'Alterado',newTitle:'Outro',fields:['title']}]
 })).toThrow('FAVORITE_CATALOG_IMPACT_INVALID');
});
