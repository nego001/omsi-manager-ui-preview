import {test,expect} from '@playwright/test';
import type {CatalogMod} from '../src/catalog';
import {findDeclaredCrossGameIdReuses as reuse} from '../src/catalog-cross-game-reuse';
const bus:CatalogMod={id:'omsi-bus',title:'Ônibus',game:'omsi',category:'Ônibus',
 version:'1.0',description:'Fictício',size:'1 MB',safe:true};
test('identifica IDs reutilizados entre OMSI, ETS2 e ATS sem supor identidade',()=>{
 const prior=[bus,{...bus,id:'old2',title:'Outro OMSI'},
  {...bus,id:'stay',title:'Continua'}];
 const proposed=[{...bus,game:'ets2' as const,title:'Nome diferente'},
  {...prior[1],game:'ats' as const},
  {...prior[2],version:'2.0'}];
 const before=JSON.stringify([prior,proposed]);
 expect(reuse(prior,proposed,['omsi-bus','old2'],['old2'])).toEqual([
  {id:'omsi-bus',oldTitle:'Ônibus',newTitle:'Nome diferente',
   oldGame:'omsi',newGame:'ets2',inFavorites:true,inActiveSelection:false},
  {id:'old2',oldTitle:'Outro OMSI',newTitle:'Outro OMSI',
   oldGame:'omsi',newGame:'ats',inFavorites:true,inActiveSelection:true}
 ]);
 expect(JSON.stringify([prior,proposed])).toBe(before);
 expect(Object.isFrozen(reuse(prior,proposed,[],[]))).toBe(true);
});
test('ignora mudanças de versão/categoria sem jogo diferente ou IDs novos',()=>{
 const next=[{...bus,version:'3.0',category:'Sons' as const},
  {...bus,id:'new-ats',game:'ats' as const}];
 expect(reuse([bus],next,[],[])).toEqual([]);
 expect(reuse([bus],[bus],['omsi-bus'],[])).toEqual([]);
});
test('recusa catálogos duplicados e IDs de seleções inválidas',()=>{
 for(const args of [
  [[bus,bus],[bus],[],[]],
  [[bus],[bus,bus],[],[]],
  [[bus],[bus],['unknown'],[]],
  [[bus],[bus],['omsi-bus','omsi-bus'],[]],
  [[bus],[bus],[],['omsi-bus']],
  [[bus],[bus],['omsi-bus'],['omsi-bus','omsi-bus']],
  [[{...bus,game:'unknown' as CatalogMod['game']}],[bus],[],[]]
 ] as Array<[CatalogMod[],CatalogMod[],string[],string[]]>)
  expect(()=>reuse(...args)).toThrow('DECLARED_CROSS_GAME_REUSE_INVALID');
});
