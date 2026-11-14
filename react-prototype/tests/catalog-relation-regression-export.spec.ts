import {test,expect} from '@playwright/test';
import type {CatalogMod} from '../src/catalog';
import {summarizeProposedRelationRegressions} from '../src/catalog-relation-regressions';
import {serializeDeclaredRelationRegressions as serialize} from '../src/catalog-relation-regression-export';
const mod=(n:number):CatalogMod=>({
 id:'mod_'+n,title:'Registro '+n,game:'omsi',category:'Ônibus',
 version:'1.0',size:'1 MB',description:'Apenas metadados',safe:true
});
test('exporta todos os registros, inclusive além dos cinco exemplos da tela',()=>{
 const before=Array.from({length:14},(_,i)=>mod(i));
 const proposed=before.map((x,i)=>i<9?{...x,requires:['missing_'+i]}:x);
 const snapshot=JSON.stringify([before,proposed]);
 const summary=summarizeProposedRelationRegressions(before,proposed,[],[]);
 const report=JSON.parse(serialize(summary));
 expect(report).toMatchObject({
  schema:'omsi-manager-declared-relation-regressions-v1',
  counts:{comparedExisting:14,addedRecords:0,improvedExisting:0,
   newlyBlocked:9,worsened:0,changedReasons:0,addedBlocked:0},
  completeFlaggedRecords:true,proposedCatalogApplied:false,
  restorableByPreview:false,installedPackagesChecked:false,
  realCompatibilityVerified:false,installationVerified:false,
  sourceAuthenticated:false
 });
 expect(report.newlyBlocked).toHaveLength(9);
 expect(report.newlyBlocked[0]).toMatchObject({
  id:'mod_0',previousBlockers:0,proposedBlockers:1,
  proposedBlockingCodes:['dependency-missing']
 });
 expect(JSON.stringify([before,proposed])).toBe(snapshot);
});
test('preserva mudança de tipo de bloqueio no relatório completo',()=>{
 const base=mod(0),engine=mod(1);
 const before=[{...base,requires:['missing']},engine];
 const proposed=[{...base,requires:['mod_1']},{...engine,game:'ets2' as const}];
 const summary=summarizeProposedRelationRegressions(before,proposed,['mod_0'],['mod_0']);
 const report=JSON.parse(serialize(summary));
 expect(report.counts.changedReasons).toBe(1);
 expect(report.changedReasons[0]).toMatchObject({
  id:'mod_0',previousBlockers:1,proposedBlockers:1,
  previousBlockingCodes:['dependency-missing'],
  proposedBlockingCodes:['different-game'],favoriteNow:true,selectedNow:true
 });
});
test('rejeita duplicatas, códigos inválidos e contadores contraditórios',()=>{
 const current=[mod(0)];
 const summary=summarizeProposedRelationRegressions(current,
  [{...mod(0),requires:['missing']}],['mod_0'],[]);
 const entry=summary.newlyBlocked[0];
 const candidates=[
  {...summary,comparedExisting:0},
  {...summary,installedPackagesChecked:true},
  {...summary,newlyBlocked:[entry,entry]},
  {...summary,newlyBlocked:[{...entry,id:'../private'}]},
  {...summary,newlyBlocked:[{...entry,title:'Nome'+String.fromCharCode(10)+'invalido'}]},
  {...summary,newlyBlocked:[{...entry,proposedBlockingCodes:['install-command']}]},
  {...summary,newlyBlocked:[{...entry,proposedBlockingCodes:['dependency-missing','dependency-missing']}]},
  {...summary,newlyBlocked:[{...entry,selectedNow:true,favoriteNow:false}]},
  {...summary,worsened:[entry]},
  {...summary,changedReasons:[entry]},
  {...summary,addedBlocked:[entry]}
 ];
 for(const candidate of candidates)
  expect(()=>serialize(candidate as typeof summary))
   .toThrow('DECLARED_RELATION_REGRESSION_EXPORT_INVALID');
});
test('não copia campos estranhos, caminhos nem comandos',()=>{
 const prior=[mod(0)];
 const summary=summarizeProposedRelationRegressions(prior,
  [{...mod(0),requires:['missing']}],[],[]);
 const entry={...summary.newlyBlocked[0],hostPath:'/private/key',command:'execute'};
 const forged={...summary,newlyBlocked:[entry],path:'C:\\private'};
 const json=serialize(forged);
 expect(json).not.toContain('/private/key');
 expect(json).not.toContain('hostPath');
 expect(json).not.toContain('command');
 expect(json).not.toContain('C:\\private');
 expect(JSON.parse(json).schema).not.toBe('omsi-manager-catalog-v1');
});
