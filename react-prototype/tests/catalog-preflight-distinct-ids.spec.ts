import {test,expect} from '@playwright/test';
import type {CatalogMod} from '../src/catalog';
import {findDeclaredCrossGameIdReuses} from '../src/catalog-cross-game-reuse';
import {summarizeProposedRelationRegressions} from '../src/catalog-relation-regressions';
import {compareDeclaredReferenceTargets} from '../src/catalog-reference-changes';
import {compareDeclaredVersionConstraints} from '../src/catalog-version-constraints';
import {summarizeDistinctDeclaredPreflightIds as summarize} from '../src/catalog-preflight-distinct-ids';
const bus:CatalogMod={
 id:'bus',title:'Ônibus',game:'omsi',category:'Ônibus',version:'1.0',
 size:'20 MB',description:'Apenas metadados demonstrativos',safe:true
};
function analyze(before:CatalogMod[],after:CatalogMod[]){
 const snapshot=JSON.stringify([before,after]);
 const result=summarize(
  findDeclaredCrossGameIdReuses(before,after,[],[]),
  summarizeProposedRelationRegressions(before,after,[],[]),
  compareDeclaredReferenceTargets(before,after),
  compareDeclaredVersionConstraints(before,after)
 );
 expect(JSON.stringify([before,after])).toBe(snapshot);
 expect(Object.isFrozen(result)).toBe(true);
 expect(result).toMatchObject({
  installedFilesChecked:false,realCompatibilityVerified:false
 });
 return result;
}
test('deduplica alertas de quatro grupos e conta sobreposições por ID',()=>{
 const engine={...bus,id:'engine',title:'Motor'};
 const before=[
  {...bus,requires:['engine'],requiresMinVersions:[{id:'engine',minVersion:'1.0'}]},
  engine
 ];
 const after=[
  {...bus,requires:['missing'],requiresMinVersions:[{id:'missing',minVersion:'2.0'}]},
  {...engine,game:'ets2' as const}
 ];
 expect(analyze(before,after)).toMatchObject({distinctIds:2,overlappingIds:1});
});
test('aponta bloqueio em novo ID mesmo sem alterações de referências mantidas',()=>{
 const after=[bus,{...bus,id:'new-addon',title:'Novo mod',requires:['missing']}];
 expect(analyze([bus],after)).toMatchObject({distinctIds:1,overlappingIds:0});
});
test('catálogos idênticos não criam alertas mesmo com uma dependência antiga',()=>{
 const input=[{...bus,requires:['missing']}];
 expect(analyze(input,[{...input[0]}])).toMatchObject({distinctIds:0,overlappingIds:0});
});
test('recusa IDs duplicados e resumos adulterados inclusive entre grupos',()=>{
 const before=[bus],after=[{...bus,requires:['missing']}];
 const cross=findDeclaredCrossGameIdReuses(before,after,[],[]);
 const relations=summarizeProposedRelationRegressions(before,after,[],[]);
 const refs=compareDeclaredReferenceTargets(before,after);
 const versions=compareDeclaredVersionConstraints(before,after);
 const fail='DECLARED_PREFLIGHT_DISTINCT_IDS_INVALID';
 expect(()=>summarize([{id:'dup'},{id:'dup'}] as unknown as typeof cross,relations,refs,versions)).toThrow(fail);
 expect(()=>summarize(cross,{...relations,addedBlocked:[...relations.newlyBlocked]},refs,versions)).toThrow(fail);
 expect(()=>summarize(cross,relations,{...refs,compatibilityVerified:true} as unknown as typeof refs,versions)).toThrow(fail);
 expect(()=>summarize([{id:'invalid/path'}] as unknown as typeof cross,relations,refs,versions)).toThrow(fail);
});
