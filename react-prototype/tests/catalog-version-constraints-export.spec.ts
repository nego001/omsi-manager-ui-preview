import {test,expect} from '@playwright/test';
import type {CatalogMod} from '../src/catalog';
import {compareDeclaredVersionConstraints} from '../src/catalog-version-constraints';
import {serializeDeclaredVersionConstraintChanges as serialize} from '../src/catalog-version-constraints-export';
const mod=(i:number):CatalogMod=>({
 id:'mod_'+i,title:'Registro '+i,game:'omsi',category:'Ônibus',
 version:'2.0',description:'Somente metadados',size:'1 MB',safe:true
});
test('exporta todas as mudanças de versões, inclusive mais que cinco exemplos',()=>{
 const current=Array.from({length:10},(_,i)=>({
  ...mod(i),requires:['engine'],requiresMinVersions:[{id:'engine',minVersion:'1.0'}]
 }));
 const future=current.map((m,i)=>i<9?{
  ...m,requiresMinVersions:[{id:'engine',minVersion:'2.0'}],
  gameVersionRange:{min:'1.0',max:'5.0'}
 }:m);
 const snapshot=JSON.stringify([current,future]);
 const report=JSON.parse(serialize(compareDeclaredVersionConstraints(current,future)));
 expect(report).toMatchObject({
  schema:'omsi-manager-declared-version-constraints-v1',
  scope:'pending-catalog-version-requirements-metadata-only',
  counts:{comparedIds:10,unchangedConstraints:1,changed:9},
  completeDeclaredVersionChanges:true,proposedCatalogApplied:false,
  restorableByPreview:false,installedFilesChecked:false,
  realCompatibilityVerified:false,installationVerified:false,
  sourceAuthenticated:false,sameIdProvesPackageIdentity:false
 });
 expect(report.changed).toHaveLength(9);
 expect(report.changed[0]).toMatchObject({
  id:'mod_0',oldGameMin:null,newGameMin:'1.0',
  changedFloors:[{id:'engine',oldMinVersion:'1.0',newMinVersion:'2.0'}]
 });
 expect(JSON.stringify([current,future])).toBe(snapshot);
});
test('abrange limites e requisitos adicionados e retirados, sem criar manifesto importável',()=>{
 const original=[{...mod(0),requires:['a','b'],
  gameVersionRange:{min:'1.0',max:'3.0'},
  requiresMinVersions:[{id:'a',minVersion:'2.0'}]}];
 const proposal=[{...original[0],gameVersionRange:{min:'1.5',max:'2.0'},
  requiresMinVersions:[{id:'b',minVersion:'4.0'}]}];
 const report=JSON.parse(serialize(compareDeclaredVersionConstraints(original,proposal)));
 expect(report.changed[0]).toMatchObject({
  oldGameMin:'1.0',newGameMin:'1.5',oldGameMax:'3.0',newGameMax:'2.0',
  addedFloors:[{id:'b',minVersion:'4.0'}],
  removedFloors:[{id:'a',minVersion:'2.0'}],changedFloors:[]
 });
 expect(report.schema).not.toBe('omsi-manager-catalog-v1');
});
test('recusa registros forjados e inconsistentes em vez de serializar',()=>{
 const old=[{...mod(0),requires:['engine'],
  requiresMinVersions:[{id:'engine',minVersion:'1.0'}]}];
 const next=[{...old[0],requiresMinVersions:[{id:'engine',minVersion:'2.0'}]}];
 const valid=compareDeclaredVersionConstraints(old,next);
 const entry=valid.changed[0];
 const broken=[
  {...valid,comparedIds:0},
  {...valid,unchangedConstraints:1},
  {...valid,installedFilesChecked:true},
  {...valid,realCompatibilityVerified:true},
  {...valid,changed:[entry,entry]},
  {...valid,changed:[{...entry,id:'../path'}]},
  {...valid,changed:[{...entry,oldGameMin:'9.0',oldGameMax:'2.0'}]},
  {...valid,changed:[{...entry,newGameMin:'1.0-beta'}]},
  {...valid,changed:[{...entry,title:'Mal'+String.fromCharCode(10)+'Formado'}]},
  {...valid,changed:[{...entry,changedFloors:[
   {id:'engine',oldMinVersion:'1.0',newMinVersion:'2.0'},
   {id:'engine',oldMinVersion:'1.0',newMinVersion:'3.0'}
  ]}]},
  {...valid,changed:[{...entry,changedFloors:[
   {id:'engine',oldMinVersion:'2.0',newMinVersion:'2.0'}
  ]}]},
  {...valid,changed:[{...entry,addedFloors:[{id:'engine',minVersion:'2.0'}]}]},
  {...valid,changed:[{...entry,changedFloors:[]}]}
 ];
 for(const candidate of broken)
  expect(()=>serialize(candidate as typeof valid))
   .toThrow('DECLARED_VERSION_CONSTRAINT_EXPORT_INVALID');
});
test('descarta campos extras, caminhos privados e possíveis comandos',()=>{
 const prior=[mod(0)],future=[{...mod(0),gameVersionRange:{min:'1.0'}}];
 const valid=compareDeclaredVersionConstraints(prior,future);
 const forged={...valid,hostPath:'C:\\private',
  changed:[{...valid.changed[0],command:'execute',secret:'/home/private'}]};
 const json=serialize(forged);
 expect(json).not.toContain('hostPath');
 expect(json).not.toContain('command');
 expect(json).not.toContain('/home/private');
 expect(json).not.toContain('C:\\private');
});
