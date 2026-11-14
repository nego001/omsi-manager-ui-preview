import {test,expect} from '@playwright/test';
import type {CatalogMod} from '../src/catalog';
import {compareDeclaredVersionConstraints as compare} from '../src/catalog-version-constraints';
import {summarizeDeclaredConstraintDirections as classify} from '../src/catalog-version-direction';
const mod=(id:string):CatalogMod=>({
 id,title:'Registro '+id,game:'omsi',category:'Ônibus',
 version:'3.0',description:'Apenas metadados',size:'1 MB',safe:true
});
test('separa subida de mínimo, queda de máximo e limites relaxados',()=>{
 const before=[
  {...mod('raised'),gameVersionRange:{min:'1.0'}},
  {...mod('lowered_ceiling'),gameVersionRange:{max:'5.0'}},
  {...mod('relaxed'),gameVersionRange:{min:'2.0',max:'4.0'}},
  {...mod('mixed'),gameVersionRange:{min:'1.0',max:'4.0'}},
  {...mod('numeric'),gameVersionRange:{min:'1.0'}}
 ];
 const proposed=[
  {...before[0],gameVersionRange:{min:'2.0'}},
  {...before[1],gameVersionRange:{max:'4.0'}},
  {...before[2],gameVersionRange:{min:'1.0',max:'5.0'}},
  {...before[3],gameVersionRange:{min:'2.0',max:'5.0'}},
  {...before[4],gameVersionRange:{min:'1.0.0'}}
 ];
 const original=JSON.stringify([before,proposed]);
 const x=classify(compare(before,proposed),[]);
 expect(x.items).toEqual([
  {id:'raised',direction:'more-restrictive'},
  {id:'lowered_ceiling',direction:'more-restrictive'},
  {id:'relaxed',direction:'less-restrictive'},
  {id:'mixed',direction:'mixed-directions'},
  {id:'numeric',direction:'numerically-equivalent'}
 ]);
 expect(x.counts).toMatchObject({
  'more-restrictive':2,'less-restrictive':1,
  'mixed-directions':1,'numerically-equivalent':1,
  'different-games-not-comparable':0
 });
 expect(Object.isFrozen(x.items)).toBe(true);
 expect(Object.isFrozen(x.counts)).toBe(true);
 expect(JSON.stringify([before,proposed])).toBe(original);
});
test('adição, remoção e redução de piso de dependência mantêm direção explícita',()=>{
 const prior=[
  {...mod('add'),requires:['dep']},
  {...mod('remove'),requires:['dep'],
   requiresMinVersions:[{id:'dep',minVersion:'2.0'}]},
  {...mod('lower'),requires:['dep'],
   requiresMinVersions:[{id:'dep',minVersion:'3.0'}]}
 ];
 const future=[
  {...prior[0],requiresMinVersions:[{id:'dep',minVersion:'1.0'}]},
  {...prior[1],requiresMinVersions:[]},
  {...prior[2],requiresMinVersions:[{id:'dep',minVersion:'1.5'}]}
 ];
 expect(classify(compare(prior,future),[]).items).toEqual([
  {id:'add',direction:'more-restrictive'},
  {id:'remove',direction:'less-restrictive'},
  {id:'lower',direction:'less-restrictive'}
 ]);
});
test('um ID reutilizado entre simuladores nunca recebe direção numérica',()=>{
 const old=[{...mod('bus'),gameVersionRange:{min:'1.0'}}];
 const proposed=[{...old[0],game:'ets2' as const,gameVersionRange:{min:'9.0'}}];
 const summary=compare(old,proposed);
 expect(classify(summary,['bus']).items).toEqual([{
  id:'bus',direction:'different-games-not-comparable'
 }]);
});
test('rejeita entradas incoerentes ou IDs cruzados repetidos',()=>{
 const x=compare([{...mod('bus'),gameVersionRange:{min:'1.0'}}],
  [{...mod('bus'),gameVersionRange:{min:'2.0'}}]);
 expect(()=>classify(x,['bus','bus']))
  .toThrow('DECLARED_CONSTRAINT_DIRECTION_INVALID');
 expect(()=>classify({...x,installedFilesChecked:true} as typeof x,[]))
  .toThrow('DECLARED_CONSTRAINT_DIRECTION_INVALID');
 expect(()=>classify({...x,changed:[x.changed[0],x.changed[0]]},[]))
  .toThrow('DECLARED_CONSTRAINT_DIRECTION_INVALID');
});

test('piso de dependência cujo ID mudou de OMSI para ETS2 não é comparável',()=>{
 const old=[
  {...mod('bus'),requires:['engine'],
   requiresMinVersions:[{id:'engine',minVersion:'1.0'}]},
  {...mod('engine'),game:'omsi' as const}
 ];
 const proposed=[
  {...old[0],requiresMinVersions:[{id:'engine',minVersion:'2.0'}]},
  {...old[1],game:'ets2' as const}
 ];
 const summary=compare(old,proposed);
 expect(summary.changed).toMatchObject([{
  id:'bus',changedFloors:[{
   id:'engine',oldMinVersion:'1.0',newMinVersion:'2.0'
  }]
 }]);
 const result=classify(summary,['engine']);
 expect(result.items).toEqual([
  {id:'bus',direction:'different-games-not-comparable'}
 ]);
 expect(result.counts['more-restrictive']).toBe(0);
 expect(result.counts['different-games-not-comparable']).toBe(1);
 expect(result.installedVersionsChecked).toBe(false);
 expect(result.realCompatibilityVerified).toBe(false);
});
test('o mesmo piso numericamente maior é restritivo se o jogo da dependência continua igual',()=>{
 const previous=[{...mod('bus'),requires:['engine'],
  requiresMinVersions:[{id:'engine',minVersion:'1.0'}]},mod('engine')];
 const proposed=[{...previous[0],
  requiresMinVersions:[{id:'engine',minVersion:'2.0'}]},previous[1]];
 expect(classify(compare(previous,proposed),[]).items).toEqual([
  {id:'bus',direction:'more-restrictive'}
 ]);
});
test('recusa contadores incoerentes e IDs de jogos trocados inválidos',()=>{
 const summary=compare(
  [{...mod('bus'),gameVersionRange:{min:'1.0'}}],
  [{...mod('bus'),gameVersionRange:{min:'2.0'}}]
 );
 expect(()=>classify({...summary,comparedIds:0},[]))
  .toThrow('DECLARED_CONSTRAINT_DIRECTION_INVALID');
 expect(()=>classify({...summary,unchangedConstraints:1},[]))
  .toThrow('DECLARED_CONSTRAINT_DIRECTION_INVALID');
 expect(()=>classify(summary,['INVALID-CAPS']))
  .toThrow('DECLARED_CONSTRAINT_DIRECTION_INVALID');
});
