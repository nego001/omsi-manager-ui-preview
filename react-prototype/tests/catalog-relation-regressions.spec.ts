import {test,expect} from '@playwright/test';
import type {CatalogMod} from '../src/catalog';
import {summarizeProposedRelationRegressions as compare} from '../src/catalog-relation-regressions';
const base:CatalogMod={id:'bus',title:'Ônibus',game:'omsi',
 category:'Ônibus',version:'1.0',description:'Somente declarações',size:'10 MB',safe:true};
test('identifica novos bloqueios e adições com dependências ausentes',()=>{
 const current=[base,{...base,id:'sound',title:'Som'}];
 const proposed=[
  {...base,requires:['missing']},
  {...current[1]},
  {...base,id:'new-map',title:'Mapa novo',category:'Mapas' as const,requires:['absent']}
 ];
 const snapshot=JSON.stringify([current,proposed]);
 const summary=compare(current,proposed,['bus'],['bus']);
 expect(summary).toMatchObject({
  newlyBlocked:[{id:'bus',previousBlockers:0,proposedBlockers:1,
   proposedBlockingCodes:['dependency-missing'],favoriteNow:true,selectedNow:true}],
  worsened:[],
  addedBlocked:[{id:'new-map',previousBlockers:0,proposedBlockers:1,
   proposedBlockingCodes:['dependency-missing'],favoriteNow:false,selectedNow:false}],
  improvedExisting:0,comparedExisting:2,addedRecords:1,
  installedPackagesChecked:false,realCompatibilityVerified:false
 });
 expect(JSON.stringify([current,proposed])).toBe(snapshot);
 expect(Object.isFrozen(summary)).toBe(true);
 expect(Object.isFrozen(summary.newlyBlocked[0].proposedBlockingCodes)).toBe(true);
});
test('distingue bloqueios que pioraram, melhoraram e alterações neutras',()=>{
 const current=[
  {...base,requires:['missing']},
  {...base,id:'worse',requires:['missing']},
  {...base,id:'better',requires:['gone']}
 ];
 const proposed=[
  {...current[0]},
  {...current[1],requires:['missing','another-missing']},
  {...current[2],requires:[]}
 ];
 const summary=compare(current,proposed,[],[]);
 expect(summary.newlyBlocked).toEqual([]);
 expect(summary.worsened).toMatchObject([{id:'worse',previousBlockers:1,proposedBlockers:2}]);
 expect(summary.changedReasons).toEqual([]);
 expect(summary.addedBlocked).toEqual([]);
 expect(summary.improvedExisting).toBe(1);
});
test('troca de jogo em uma dependência gera bloqueio lógico sem declarar instalação',()=>{
 const current=[{...base,requires:['engine']},{...base,id:'engine'}];
 const proposed=[current[0],{...current[1],game:'ets2' as const}];
 const summary=compare(current,proposed,['bus'],[]);
 expect(summary.newlyBlocked).toMatchObject([{
  id:'bus',previousBlockers:0,proposedBlockers:1,
  proposedBlockingCodes:['different-game'],favoriteNow:true
 }]);
 expect(summary.installedPackagesChecked).toBe(false);
});
test('recusa seleção sem favorito, IDs duplicados e catálogo inválido',()=>{
 const candidates:Array<[CatalogMod[],CatalogMod[],string[],string[]]>=[
  [[base,base],[base],[],[]],[[base],[base,base],[],[]],
  [[base],[base],[],['bus']],[[base],[base],['bus','bus'],[]],
  [[base],[base],['missing'],[]],
  [[{...base,game:'invalid' as CatalogMod['game']}],[base],[],[]]
 ];
 for(const args of candidates)
  expect(()=>compare(...args)).toThrow('PROPOSED_RELATION_REGRESSION_INVALID');
});

test('mesma quantidade mas novo tipo de bloqueio é destacado separadamente',()=>{
 const current=[
  {...base,requires:['missing']},
  {...base,id:'engine',title:'Motor'}
 ];
 const proposed=[
  {...current[0],requires:['engine']},
  {...current[1],game:'ets2' as const}
 ];
 const result=compare(current,proposed,['bus'],['bus']);
 expect(result.newlyBlocked).toEqual([]);
 expect(result.worsened).toEqual([]);
 expect(result.changedReasons).toMatchObject([{
  id:'bus',previousBlockers:1,proposedBlockers:1,
  previousBlockingCodes:['dependency-missing'],
  proposedBlockingCodes:['different-game'],
  favoriteNow:true,selectedNow:true
 }]);
 expect(Object.isFrozen(result.changedReasons[0].previousBlockingCodes)).toBe(true);
});
test('troca de ID ausente com mesmo tipo não é classificada como novo tipo',()=>{
 const current=[{...base,requires:['missing-a']}];
 const proposed=[{...base,requires:['missing-b']}];
 const result=compare(current,proposed,[],[]);
 expect(result.changedReasons).toEqual([]);
 expect(result.newlyBlocked).toEqual([]);
 expect(result.worsened).toEqual([]);
});

// Even when the NUMBER of declared blockers goes down, a new blocker TYPE
// must not be silently accepted as an improvement.
test('menos bloqueios, mas novo tipo, continua visível no pré-voo',()=>{
 const engine={...base,id:'engine',title:'Motor declarado'};
 const before=[{...base,requires:['missing_a','missing_b']},engine];
 const proposed=[
  {...base,requires:['engine']},
  {...engine,game:'ets2' as const}
 ];
 const snapshot=JSON.stringify([before,proposed]);
 const result=compare(before,proposed,['bus'],['bus']);
 expect(result).toMatchObject({
  newlyBlocked:[],worsened:[],addedBlocked:[],
  improvedExisting:1,comparedExisting:2,
  changedReasons:[{
   id:'bus',previousBlockers:2,proposedBlockers:1,
   previousBlockingCodes:['dependency-missing'],
   proposedBlockingCodes:['different-game'],
   favoriteNow:true,selectedNow:true
  }]
 });
 expect(Object.isFrozen(result.changedReasons[0])).toBe(true);
 expect(JSON.stringify([before,proposed])).toBe(snapshot);
});
test('queda de bloqueios sem introduzir novo tipo permanece só melhoria numérica',()=>{
 const before=[{...base,requires:['missing_a','missing_b']}];
 const proposed=[{...base,requires:['missing_a']}];
 const result=compare(before,proposed,[],[]);
 expect(result.improvedExisting).toBe(1);
 expect(result.changedReasons).toEqual([]);
 expect(result.worsened).toEqual([]);
});
