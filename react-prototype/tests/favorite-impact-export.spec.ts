import {test,expect} from '@playwright/test';
import type {CatalogMod} from '../src/catalog';
import {compareDeclaredCatalogs} from '../src/catalog-replacement-diff';
import {summarizeFavoriteCatalogImpact} from '../src/favorite-catalog-impact';
import {serializeDeclaredFavoriteImpact} from '../src/favorite-impact-export';
const mod=(i:number):CatalogMod=>({
 id:'mod_'+i,title:'Registro '+i,game:'omsi',category:'Ônibus',
 version:'1.0',description:'Apenas metadados',size:'1 MB',safe:true
});
test('exporta 100% dos favoritos mesmo quando a interface mostra só cinco',()=>{
 const before=Array.from({length:12},(_,i)=>mod(i));
 const proposed=[...before.slice(0,4),...before.slice(4,9).map(m=>({...m,version:'2.0'}))];
 const snapshot=JSON.stringify(before);
 const impact=summarizeFavoriteCatalogImpact(before,before.map(x=>x.id),
  compareDeclaredCatalogs(before,proposed));
 const exported=JSON.parse(serializeDeclaredFavoriteImpact(impact));
 expect(exported).toMatchObject({
  schema:'omsi-manager-declared-favorite-impact-v1',
  scope:'pending-catalog-favorites-impact-metadata-only',
  source:'catalog-declarations-unverified',
  counts:{total:12,unchanged:4,changed:5,removed:3},
  completeFavoriteImpact:true,allFavoritesDiscardedOnConfirmation:true,
  proposedCatalogApplied:false,sourceAuthenticated:false,
  installationVerified:false,compatibilityVerified:false,
  installedPackagesCompared:false,restorableByPreview:false,
  sameIdProvesPackageIdentity:false
 });
 expect(exported.changed).toHaveLength(5);
 expect(exported.removed).toHaveLength(3);
 expect(exported.changed[0].fields).toEqual(['version']);
 expect(JSON.stringify(before)).toBe(snapshot);
});
test('recusa contagens falsas, campos hostis, IDs repetidos e caracteres de controle',()=>{
 const before=[mod(0),mod(1)];
 const impact=summarizeFavoriteCatalogImpact(before,before.map(x=>x.id),
  compareDeclaredCatalogs(before,[{...mod(0),title:'Outro nome'}]));
 const broken=[
  {...impact,total:999},
  {...impact,allFavoritesDiscardedOnConfirmation:false},
  {...impact,installedPackagesCompared:true},
  {...impact,unchanged:[{id:'mod_0',title:'Repetido'}]},
  {...impact,removed:[{id:'bad id',title:'Nome'}]},
  {...impact,removed:[{id:'mod_1',title:'Invalido'+String.fromCharCode(10)+'linha'}]},
  {...impact,changed:[{...impact.changed[0],fields:['version','version']}]},
  {...impact,changed:[{...impact.changed[0],fields:['command']}]}
 ];
 for(const caseValue of broken)
  expect(()=>serializeDeclaredFavoriteImpact(caseValue as typeof impact))
   .toThrow('DECLARED_FAVORITE_IMPACT_EXPORT_INVALID');
});
test('descarta propriedades desconhecidas e não cria arquivo importável nem autorização',()=>{
 const unchanged=[{id:'demo',title:'Favorito'}];
 const forged={
  total:1,unchanged,changed:[],removed:[],
  allFavoritesDiscardedOnConfirmation:true,
  installedPackagesCompared:false,sameIdProvesPackageIdentity:false,
  command:'install',hostPath:'/home/private/secret',
  // Other unexpected fields inside entries cannot leak either.
  ignored:{profilePath:'C:\\private'}
 };
 const output=serializeDeclaredFavoriteImpact(forged as Parameters<typeof serializeDeclaredFavoriteImpact>[0]);
 expect(output).not.toContain('/home/private');
 expect(output).not.toContain('hostPath');
 expect(output).not.toContain('profilePath');
 expect(JSON.parse(output).schema).not.toBe('omsi-manager-catalog-v1');
 expect(JSON.parse(output).restorableByPreview).toBe(false);
});
