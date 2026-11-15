import {test,expect} from '@playwright/test';
import type {CatalogMod} from '../src/catalog';
import {compareDeclaredVersionConstraints as compare} from '../src/catalog-version-constraints';
const mod=(id:string):CatalogMod=>({
 id,title:'Registro '+id,game:'omsi',category:'Ônibus',
 version:'2.0',description:'Metadados',size:'1 MB',safe:true
});
test('detecta aumento de versão mínima mesmo com IDs de dependência iguais',()=>{
 const baseline=[{...mod('bus'),requires:['engine'],
  requiresMinVersions:[{id:'engine',minVersion:'1.0'}]},mod('engine')];
 const proposed=[{...baseline[0],requiresMinVersions:[{id:'engine',minVersion:'1.9'}]},baseline[1]];
 const snapshot=JSON.stringify([baseline,proposed]);
 const result=compare(baseline,proposed);
 expect(result).toMatchObject({
  comparedIds:2,unchangedConstraints:1,
  installedFilesChecked:false,realCompatibilityVerified:false,
  changed:[{id:'bus',oldGameMin:null,newGameMin:null,oldGameMax:null,newGameMax:null,
   addedFloors:[],removedFloors:[],
   changedFloors:[{id:'engine',oldMinVersion:'1.0',newMinVersion:'1.9'}]}]
 });
 expect(Object.isFrozen(result.changed[0].changedFloors)).toBe(true);
 expect(JSON.stringify([baseline,proposed])).toBe(snapshot);
});
test('mostra faixa do jogo alterada e inclusão ou exclusão de versão mínima',()=>{
 const prior=[{...mod('bus'),requires:['a','b'],
  requiresMinVersions:[{id:'a',minVersion:'1.2'}],
  gameVersionRange:{min:'1.0',max:'2.0'}}];
 const next=[{...prior[0],gameVersionRange:{min:'1.5',max:'1.9'},
  requiresMinVersions:[{id:'b',minVersion:'3.0'}]}];
 expect(compare(prior,next).changed).toMatchObject([{
  id:'bus',oldGameMin:'1.0',newGameMin:'1.5',
  oldGameMax:'2.0',newGameMax:'1.9',
  removedFloors:[{id:'a',minVersion:'1.2'}],
  addedFloors:[{id:'b',minVersion:'3.0'}],changedFloors:[]
 }]);
});
test('reordenação de versões mínimas e alteração só do mod não geram falso positivo',()=>{
 const old={...mod('bus'),requires:['b','a'],
  requiresMinVersions:[{id:'b',minVersion:'1.0'},{id:'a',minVersion:'2.0'}]};
 const next={...old,version:'3.0',requires:['a','b'],
  requiresMinVersions:[{id:'a',minVersion:'2.0'},{id:'b',minVersion:'1.0'}]};
 expect(compare([old],[next])).toMatchObject({
  changed:[],unchangedConstraints:1,comparedIds:1
 });
});
test('recusa intervalos invertidos, versões inválidas e requisitos órfãos',()=>{
 const x=mod('bus');
 const candidates:CatalogMod[][]=[
  [{...x,gameVersionRange:{}}],
  [{...x,gameVersionRange:{min:'4.0',max:'2.0'}}],
  [{...x,gameVersionRange:{min:'1.0-beta'}}],
  [{...x,requiresMinVersions:[{id:'x',minVersion:'1.0'}]}],
  [{...x,requires:['a'],requiresMinVersions:[{id:'a',minVersion:'bad'}]}],
  [{...x,requires:['a'],requiresMinVersions:[{id:'a',minVersion:'1.0'},{id:'a',minVersion:'2.0'}]}],
  [{...x,requires:['a','a']}],
  [x,x]
 ];
 for(const candidate of candidates)
  expect(()=>compare([x],candidate)).toThrow('DECLARED_VERSION_CONSTRAINTS_INVALID');
});
