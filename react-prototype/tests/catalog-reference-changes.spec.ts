import {test,expect} from '@playwright/test';
import type {CatalogMod} from '../src/catalog';
import {compareDeclaredReferenceTargets as compare} from '../src/catalog-reference-changes';
const base:CatalogMod={
 id:'bus',title:'Ônibus fictício',game:'omsi',category:'Ônibus',
 version:'1.0',description:'Somente metadados',size:'1 MB',safe:true
};
test('detecta alvos declarados alterados mesmo quando o código do bloqueio permanece igual',()=>{
 const current=[{...base,requires:['missing-a'],conflictsWith:['old-x']}];
 const proposed=[{...base,requires:['missing-b'],conflictsWith:['new-x']}];
 const unchanged=JSON.stringify([current,proposed]);
 const summary=compare(current,proposed);
 expect(summary).toMatchObject({
  comparedIds:1,unchangedReferences:0,
  installedFilesChecked:false,compatibilityVerified:false,
  changed:[{
   id:'bus',oldGame:'omsi',newGame:'omsi',
   requiresAdded:['missing-b'],requiresRemoved:['missing-a'],
   conflictsAdded:['new-x'],conflictsRemoved:['old-x']
  }]
 });
 expect(Object.isFrozen(summary)).toBe(true);
 expect(Object.isFrozen(summary.changed[0].requiresAdded)).toBe(true);
 expect(JSON.stringify([current,proposed])).toBe(unchanged);
});
test('não trata reordenação ou versão alterada como troca de referência',()=>{
 const prior=[{...base,requires:['z','a'],conflictsWith:['y','b']}];
 const next=[{...prior[0],requires:['a','z'],conflictsWith:['b','y'],version:'9.0'}];
 expect(compare(prior,next)).toMatchObject({
  comparedIds:1,unchangedReferences:1,changed:[]
 });
});
test('reconhece ID novo e removido sem fingir que há referência comparável',()=>{
 const prior=[base,{...base,id:'gone'}];
 const next=[base,{...base,id:'new'}];
 expect(compare(prior,next)).toMatchObject({
  comparedIds:1,unchangedReferences:1,changed:[]
 });
});
test('recusa registros duplicados, alvos hostis e listas longas',()=>{
 const wrong:Array<[CatalogMod[],CatalogMod[]]>=[
  [[base,base],[base]],
  [[base],[base,base]],
  [[{...base,requires:['duplicate','duplicate']}],[base]],
  [[base],[{...base,conflictsWith:['../escape']}]],
  [[base],[{...base,requires:['UPPERCASE']}]],
  [[base],[{...base,requires:Array.from({length:21},(_,i)=>'mod_'+i)}]],
  [[{...base,game:'wrong' as CatalogMod['game']}],[base]]
 ];
 for(const [oldMods,newMods] of wrong)
  expect(()=>compare(oldMods,newMods)).toThrow('DECLARED_REFERENCE_CHANGES_INVALID');
});
