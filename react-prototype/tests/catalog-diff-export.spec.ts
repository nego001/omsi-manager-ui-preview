import {test,expect} from '@playwright/test';
import {compareDeclaredCatalogs,type DeclaredCatalogDiff} from '../src/catalog-replacement-diff';
import {serializeDeclaredCatalogDiff} from '../src/catalog-diff-export';
import type {CatalogMod} from '../src/catalog';
const mod=(i:number):CatalogMod=>({
 id:'mod_'+i,title:'Registro '+i,game:'omsi',category:'Ônibus',
 version:'1.0',description:'Fictício',size:'1 MB',safe:true
});
test('exporta todas as diferenças, inclusive as não exibidas no limite de cinco',()=>{
 const before=Array.from({length:9},(_,i)=>mod(i));
 const after=[...before.map(m=>({...m,version:'2.0'})),mod(99)];
 const snapshot=JSON.stringify(before);
 const comparison=compareDeclaredCatalogs(before,after);
 const exported=JSON.parse(serializeDeclaredCatalogDiff(comparison));
 expect(exported).toMatchObject({
  schema:'omsi-manager-declared-catalog-diff-v1',
  source:'catalog-declarations-unverified',
  scope:'pending-catalog-comparison-metadata-only',
  counts:{unchanged:0,changed:9,removed:0,added:1},
  completeDeclaredDiff:true,sourceAuthenticated:false,
  compatibilityVerified:false,installationVerified:false,
  restorableByPreview:false,proposedCatalogApplied:false
 });
 expect(exported.changed).toHaveLength(9);
 expect(exported.changed[8]).toMatchObject({id:'mod_8',fields:['version']});
 expect(Object.keys(exported.changed[8])).toEqual(['id','oldTitle','newTitle','fields']);
 expect(exported.added).toEqual([{id:'mod_99',title:'Registro 99'}]);
 expect(JSON.stringify(before)).toBe(snapshot);
});
test('recusa contagens incompatíveis, campos desconhecidos, IDs duplicados e controles',()=>{
 const valid=compareDeclaredCatalogs([mod(1)],[{...mod(1),title:'Alterado'},mod(2)]);
 const cases:DeclaredCatalogDiff[]=[
  {...valid,unchanged:200},
  {...valid,unchanged:-1},
  {...valid,changed:[{id:'mod_1',oldTitle:'ok',newTitle:'ok',fields:['version','version']}]},
  {...valid,changed:[{id:'mod_1',oldTitle:'ok',newTitle:'ok',
   fields:['path' as 'title']}]},
  {...valid,added:[{id:'mod_1',title:'Repetido'}]},
  {...valid,removed:[{id:'invalid name',title:'Invalido'}]},
  {...valid,added:[{id:'new',title:'\nlinha de controle'}]}
 ];
 for(const candidate of cases)
  expect(()=>serializeDeclaredCatalogDiff(candidate)).toThrow('DECLARED_CATALOG_DIFF_EXPORT_INVALID');
});
test('não inclui propriedades hostis extras, nem torna o relatório um manifesto importável',()=>{
 const diff=compareDeclaredCatalogs([mod(1)],[{...mod(1),title:'Outro'}]);
 const hostile={...diff,path:'/private/host',command:'install',changed:diff.changed.map(
  record=>({...record,script:'dangerous',hostPath:'C:\\Windows\\'}))};
 const output=serializeDeclaredCatalogDiff(hostile);
 expect(output).not.toContain('hostPath');
 expect(output).not.toContain('command');
 expect(output).not.toContain('private/host');
 expect(JSON.parse(output).schema).not.toBe('omsi-manager-catalog-v1');
});
