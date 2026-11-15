import {test,expect} from '@playwright/test';
import type {CatalogMod} from '../src/catalog';
import {compareDeclaredCatalogs} from '../src/catalog-replacement-diff';
import {findDeclaredCrossGameIdReuses} from '../src/catalog-cross-game-reuse';
import {summarizeProposedRelationRegressions} from '../src/catalog-relation-regressions';
import {compareDeclaredReferenceTargets} from '../src/catalog-reference-changes';
import {compareDeclaredVersionConstraints} from '../src/catalog-version-constraints';
import {summarizeDistinctDeclaredPreflightIds} from '../src/catalog-preflight-distinct-ids';
import {serializeDeclaredPreflightOverview} from '../src/catalog-preflight-overview-export';
const bus:CatalogMod={id:'bus',title:'Ônibus',game:'omsi',category:'Ônibus',
 version:'1.0',size:'20 MB',description:'Registro declarativo',safe:true};
function snapshot(before:CatalogMod[],after:CatalogMod[]){
 const diff=compareDeclaredCatalogs(before,after);
 const cross=findDeclaredCrossGameIdReuses(before,after,[],[]);
 const relations=summarizeProposedRelationRegressions(before,after,[],[]);
 const references=compareDeclaredReferenceTargets(before,after);
 const versions=compareDeclaredVersionConstraints(before,after);
 const summary=summarizeDistinctDeclaredPreflightIds(cross,relations,references,versions);
 const groups={
  'cross-game':cross.length,
  blockers:relations.newlyBlocked.length+relations.worsened.length+
   relations.changedReasons.length+relations.addedBlocked.length,
  references:references.changed.length,
  versions:versions.changed.length
 };
 return {diff,summary,groups};
}
test('resume mudança fora dos alertas sem incluir títulos ou dados de mods',()=>{
 const input=snapshot([bus],[{...bus,description:'Descrição privada fictícia'}]);
 const raw=serializeDeclaredPreflightOverview(input);
 const parsed=JSON.parse(raw);
 expect(parsed.schema).toBe('omsi-manager-declared-preflight-overview-v1');
 expect(parsed.counts.catalog).toEqual({
  current:1,proposed:1,unchanged:0,changed:1,removed:0,added:0
 });
 expect(parsed.counts.alerts).toEqual({
  groups:{'cross-game':0,blockers:0,references:0,versions:0},
  distinctIds:0,overlappingIds:0
 });
 expect(parsed.hasCatalogChangesOutsideFourAlertGroups).toBe(true);
 expect(parsed).toMatchObject({completeCatalogCounts:true,metadataOnly:true,
  proposedCatalogApplied:false,installedFilesChecked:false,
  compatibilityVerified:false,sourceAuthenticated:false});
 expect(raw).not.toContain('Descrição privada fictícia');
});
test('recusa contagens adulteradas e aceita categorias genuinamente sobrepostas',()=>{
 const engine={...bus,id:'engine',title:'Motor'};
 const input=snapshot([{...bus,requires:['engine']},engine],
  [{...bus,requires:['missing']},engine]);
 expect(input.summary.overlappingIds).toBe(1);
 const ok=JSON.parse(serializeDeclaredPreflightOverview(input));
 expect(ok.counts.alerts.distinctIds).toBe(1);
 expect(ok.counts.alerts.overlappingIds).toBe(1);
 expect(()=>serializeDeclaredPreflightOverview({
  ...input,groups:{...input.groups,references:0}
 })).toThrow('DECLARED_PREFLIGHT_OVERVIEW_EXPORT_INVALID');
 expect(()=>serializeDeclaredPreflightOverview({
  ...input,groups:{...input.groups,versions:1}
 })).toThrow('DECLARED_PREFLIGHT_OVERVIEW_EXPORT_INVALID');
 expect(()=>serializeDeclaredPreflightOverview({
  ...input,groups:{...input.groups,versions:201}
 })).toThrow('DECLARED_PREFLIGHT_OVERVIEW_EXPORT_INVALID');
 expect(()=>serializeDeclaredPreflightOverview({
  ...input,summary:{...input.summary,distinctIds:0}
 })).toThrow('DECLARED_PREFLIGHT_OVERLAP_EXPORT_INVALID');
});

test('catálogos idênticos têm contagens declaradas iguais, não prova de arquivos',()=>{
 const input=snapshot([bus],[{...bus}]);
 const data=JSON.parse(serializeDeclaredPreflightOverview(input));
 expect(data.counts.catalog).toEqual({
  current:1,proposed:1,unchanged:1,changed:0,removed:0,added:0
 });
 expect(data.counts.alerts.distinctIds).toBe(0);
 expect(data.hasCatalogChangesOutsideFourAlertGroups).toBe(false);
 expect(data).toMatchObject({
  metadataOnly:true,compatibilityVerified:false,
  installedFilesChecked:false,proposedCatalogApplied:false
 });
});
