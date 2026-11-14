import {test,expect} from '@playwright/test';
import {compareDeclaredCatalogs} from '../src/catalog-replacement-diff';
import {summarizeFavoriteCatalogImpact as summarize} from '../src/favorite-catalog-impact';
import type {CatalogMod} from '../src/catalog';
const sample:CatalogMod={id:'bus',title:'Ônibus',game:'omsi',category:'Ônibus',
 version:'1.0',size:'100 MB',description:'Somente catálogo',safe:true};
test('separa favoritos preservados por ID, alterados e ausentes sem preservar sessão',()=>{
 const current=[sample,{...sample,id:'map',title:'Mapa',category:'Mapas'},
  {...sample,id:'sound',title:'Som',category:'Sons'},
  {...sample,id:'not-favorited',title:'Não favorito'}];
 const proposed=[{...sample,version:'2.0',game:'ets2'},
  {...current[1]},{...current[3]},{...sample,id:'new',title:'Novo'}];
 const original=JSON.stringify([current,proposed]);
 const result=summarize(current,['sound','map','bus'],compareDeclaredCatalogs(current,proposed));
 expect(result).toMatchObject({
  total:3,unchanged:[{id:'map',title:'Mapa'}],
  changed:[{id:'bus',oldTitle:'Ônibus',newTitle:'Ônibus',fields:['game','version']}],
  removed:[{id:'sound',title:'Som'}],
  allFavoritesDiscardedOnConfirmation:true,
  installedPackagesCompared:false,sameIdProvesPackageIdentity:false
 });
 expect(JSON.stringify([current,proposed])).toBe(original);
 expect(Object.isFrozen(result)).toBe(true);
 expect(Object.isFrozen(result.changed[0].fields)).toBe(true);
});
test('sem favoritos e IDs reordenados não geram identidade automática',()=>{
 const current=[sample,{...sample,id:'other',title:'Outro'}];
 const proposed=[{...current[1]},{...sample}];
 const diff=compareDeclaredCatalogs(current,proposed);
 expect(summarize(current,[],diff)).toMatchObject({total:0,changed:[],removed:[],unchanged:[],
  allFavoritesDiscardedOnConfirmation:true});
 expect(summarize(current,['other'],diff)).toMatchObject({
  total:1,unchanged:[{id:'other',title:'Outro'}]});
});
test('recusa favoritos duplicados, desconhecidos e comparações contraditórias',()=>{
 const current=[sample,{...sample,id:'other',title:'Outro'}];
 const diff=compareDeclaredCatalogs(current,[sample]);
 for(const ids of [['bus','bus'],['unknown'],['other','unknown']] as string[][])
  expect(()=>summarize(current,ids,diff)).toThrow('FAVORITE_CATALOG_IMPACT_INVALID');
 for(const broken of [
  {...diff,unchanged:2},
  {...diff,removed:[{id:'absent',title:'Inexistente'}]},
  {...diff,changed:[{id:'bus',oldTitle:'Falsificado',newTitle:'Novo',fields:['title']}]},
  {...diff,added:[{id:'bus',title:'Colisão'}]}
 ])
  expect(()=>summarize(current,['bus'],broken as typeof diff))
   .toThrow('FAVORITE_CATALOG_IMPACT_INVALID');
});
