import {test,expect} from '@playwright/test';
import type {CatalogMod} from '../src/catalog';
import {compareDeclaredCatalogs} from '../src/catalog-replacement-diff';
import {summarizeSelectedCatalogImpact} from '../src/selection-catalog-impact';
import {serializeDeclaredSelectedImpact} from '../src/selection-impact-export';
const mod=(n:number):CatalogMod=>({
 id:'mod_'+n,title:'Registro '+n,game:'omsi',category:'Ônibus',
 version:'1.0',description:'Metadado sintético',size:'1 MB',safe:true
});
test('relatório exporta seleção completa além dos cinco exemplos visíveis',()=>{
 const before=Array.from({length:12},(_,i)=>mod(i));
 const after=[...before.slice(0,4),...before.slice(4,9).map(x=>({...x,version:'2.0'}))];
 const snapshot=JSON.stringify([before,after]);
 const result=summarizeSelectedCatalogImpact(before,before.map(x=>x.id),
  compareDeclaredCatalogs(before,after));
 const parsed=JSON.parse(serializeDeclaredSelectedImpact(result));
 expect(parsed).toMatchObject({
  schema:'omsi-manager-declared-selection-impact-v1',
  scope:'pending-catalog-active-selection-impact-metadata-only',
  source:'catalog-declarations-unverified',
  counts:{total:12,unchanged:4,changed:5,removed:3},
  completeSelectedImpact:true,allSelectionsDiscardedOnConfirmation:true,
  proposedCatalogApplied:false,restorableByPreview:false,
  sourceAuthenticated:false,installationVerified:false,
  compatibilityVerified:false,installedPackagesCompared:false,
  sameIdProvesPackageIdentity:false
 });
 expect(parsed.changed).toHaveLength(5);
 expect(parsed.removed).toHaveLength(3);
 expect(parsed.changed[0].fields).toEqual(['version']);
 expect(JSON.stringify([before,after])).toBe(snapshot);
});
test('rejeita contagens falsas, colisões e campos não autorizados',()=>{
 const originals=[mod(0),mod(1)];
 const valid=summarizeSelectedCatalogImpact(originals,['mod_0','mod_1'],
  compareDeclaredCatalogs(originals,[{...mod(0),title:'Revisado'}]));
 const cases=[
  {...valid,total:200},
  {...valid,allSelectionsDiscardedOnConfirmation:false},
  {...valid,installedPackagesCompared:true},
  {...valid,removed:[{id:'mod_0',title:'Colisão'}]},
  {...valid,removed:[{id:'invalid id',title:'Não permitido'}]},
  {...valid,changed:[{...valid.changed[0],fields:['path']}]},
  {...valid,changed:[{...valid.changed[0],oldTitle:'Título'+String.fromCharCode(10)+'com quebra'}]}
 ];
 for(const candidate of cases)
  expect(()=>serializeDeclaredSelectedImpact(candidate as typeof valid))
   .toThrow('DECLARED_SELECTION_IMPACT_EXPORT_INVALID');
});
test('limpa campos extras e deixa claro que não é JSON de importação',()=>{
 const forged={
  total:1,unchanged:[{id:'one',title:'Um',hostPath:'/home/private'}],
  changed:[],removed:[],
  allSelectionsDiscardedOnConfirmation:true,
  installedPackagesCompared:false,sameIdProvesPackageIdentity:false,
  installerCommand:'install',secretPath:'C:\\private'
 };
 const result=serializeDeclaredSelectedImpact(forged as Parameters<typeof serializeDeclaredSelectedImpact>[0]);
 expect(result).not.toContain('hostPath');
 expect(result).not.toContain('/home/private');
 expect(result).not.toContain('installerCommand');
 expect(result).not.toContain('secretPath');
 expect(JSON.parse(result).schema).not.toBe('omsi-manager-catalog-v1');
});
