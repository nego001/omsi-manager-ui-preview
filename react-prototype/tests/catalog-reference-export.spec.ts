import {test,expect} from '@playwright/test';
import type {CatalogMod} from '../src/catalog';
import {compareDeclaredReferenceTargets} from '../src/catalog-reference-changes';
import {serializeDeclaredReferenceChanges as serialize} from '../src/catalog-reference-export';
const mod=(i:number):CatalogMod=>({
 id:'mod_'+i,title:'Registro '+i,game:'omsi',category:'Ônibus',
 version:'1.0',description:'Somente metadados',size:'1 MB',safe:true
});
test('relatório exporta todas as referências trocadas, inclusive mais de cinco',()=>{
 const current=Array.from({length:11},(_,i)=>({...mod(i),requires:['old_'+i]}));
 const future=current.map((x,i)=>i<9?{...x,requires:['next_'+i]}:x);
 const snapshot=JSON.stringify([current,future]);
 const result=JSON.parse(serialize(compareDeclaredReferenceTargets(current,future)));
 expect(result).toMatchObject({
  schema:'omsi-manager-declared-reference-changes-v1',
  counts:{comparedIds:11,unchangedReferences:2,changed:9},
  completeReferenceChanges:true,proposedCatalogApplied:false,
  sourceAuthenticated:false,installationVerified:false,
  compatibilityVerified:false,installedFilesChecked:false,
  restorableByPreview:false,sameIdProvesPackageIdentity:false
 });
 expect(result.changed).toHaveLength(9);
 expect(result.changed[0]).toMatchObject({
  id:'mod_0',requiresRemoved:['old_0'],requiresAdded:['next_0'],
  conflictsAdded:[],conflictsRemoved:[]
 });
 expect(JSON.stringify([current,future])).toBe(snapshot);
});
test('rejeita contagens forjadas, listas com IDs hostis e diferença inconsistente',()=>{
 const current=[{...mod(0),requires:['old-0'],conflictsWith:['bad-0']}];
 const future=[{...mod(0),requires:['next-0'],conflictsWith:['other-0']}];
 const valid=compareDeclaredReferenceTargets(current,future);
 const entry=valid.changed[0];
 const broken=[
  {...valid,comparedIds:0},
  {...valid,unchangedReferences:1},
  {...valid,installedFilesChecked:true},
  {...valid,compatibilityVerified:true},
  {...valid,changed:[entry,entry]},
  {...valid,changed:[{...entry,requiresAdded:['../private']}]},
  {...valid,changed:[{...entry,requiresAdded:['next-0','next-0']}]},
  {...valid,changed:[{...entry,requiresAdded:['old-0']}]},
  {...valid,changed:[{...entry,requiresAdded:[],requiresRemoved:[],
   conflictsAdded:[],conflictsRemoved:[]}]},
  {...valid,changed:[{...entry,oldGame:'new-game'}]},
  {...valid,changed:[{...entry,oldTitle:'bad'+String.fromCharCode(10)+'title'}]}
 ];
 for(const candidate of broken)
  expect(()=>serialize(candidate as typeof valid))
   .toThrow('DECLARED_REFERENCE_EXPORT_INVALID');
});
test('somente campos autorizados aparecem: não copiar caminhos nem comandos arbitrários',()=>{
 const old=[{...mod(0),requires:['old']}];
 const next=[{...mod(0),requires:['next']}];
 const summary=compareDeclaredReferenceTargets(old,next);
 const forged={...summary,hostPath:'C:\\private',
  changed:[{...summary.changed[0],command:'execute',secret:'/home/private'}]};
 const output=serialize(forged);
 expect(output).not.toContain('hostPath');
 expect(output).not.toContain('command');
 expect(output).not.toContain('/home/private');
 expect(output).not.toContain('C:\\private');
 expect(JSON.parse(output).schema).not.toBe('omsi-manager-catalog-v1');
});
