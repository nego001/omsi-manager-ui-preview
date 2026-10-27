// Aggregate *declared* catalog metadata only. No file access, package
// inspection, installation plan, game-version claim, or elevated capability.
import type {CatalogMod,GameId} from './catalog';
import {analyzeModRelations,type RelationIssue} from './relation-analysis';
type BatchIssue=RelationIssue & {game:GameId};
export type DeclaredBatchGroup={
 game:GameId;
 requested:number;
 sequence:CatalogMod[];
};
export type DeclaredBatchReport={
 groups:DeclaredBatchGroup[];
 selectedCount:number;
 blockers:number;
 notices:number;
 issues:BatchIssue[];
 mode:'catalog-metadata-only';
 compatibilityVerified:false;
 installationVerified:false;
 canInstall:false;
};
export function analyzeDeclaredBatch(catalog:readonly CatalogMod[],selection:readonly string[]):DeclaredBatchReport{
 if(!Array.isArray(selection)||selection.length<1||selection.length>200||
  selection.some(id=>typeof id!=='string'||id.length>64))
  throw new Error('Seleção declarativa inválida.');
 const uniqueIds=new Set(selection);
 if(uniqueIds.size!==selection.length)throw new Error('IDs duplicados na seleção.');
 const byId=new Map(catalog.map(mod=>[mod.id,mod]));
 const selected=selection.map(id=>{
  const item=byId.get(id);
  if(!item)throw new Error('Mod selecionado não está no catálogo.');
  return item;
 });
 const issues:BatchIssue[]=[];
 const seenIssues=new Set<string>();
 const push=(game:GameId,issue:RelationIssue,signature=issue.code+':'+issue.message)=>{
  const key=game+':'+signature;
  if(!seenIssues.has(key)){
   seenIssues.add(key);
   issues.push({game,...issue});
  }
 };
 const groups:DeclaredBatchGroup[]=[];
 for(const game of ['omsi','ets2','ats'] as const){
  const roots=selected.filter(mod=>mod.game===game);
  if(!roots.length)continue;
  const expanded=new Map<string,CatalogMod>();
  for(const root of roots){
   const report=analyzeModRelations(catalog,root.id);
   for(const mod of report.sequence)expanded.set(mod.id,mod);
   for(const issue of report.issues){
    // Re-evaluate conflicts against the combined selection/closures, rather
    // than treating a conflict between two independent roots as a mere notice.
    if(['declared-conflict','conflict-in-plan','unknown-conflict'].includes(issue.code))continue;
    push(game,issue);
   }
  }
  // Stable dependency-first ordering, independent from checkbox click order.
  // Cycles are separately reported as logical blockers; their order cannot
  // be an executable installation plan (install remains permanently false).
  const sequence:CatalogMod[]=[];
  const visited=new Set<string>();
  const visiting=new Set<string>();
  const visit=(mod:CatalogMod):void=>{
   if(visited.has(mod.id)||visiting.has(mod.id))return;
   visiting.add(mod.id);
   for(const id of mod.requires??[]){
    const dependency=expanded.get(id);
    if(dependency&&dependency.game===game)visit(dependency);
   }
   visiting.delete(mod.id);
   visited.add(mod.id);
   sequence.push(mod);
  };
  for(const mod of catalog)if(expanded.has(mod.id))visit(mod);
  const included=new Set(sequence.map(mod=>mod.id));
  const seenConflicts=new Set<string>();
  for(const mod of sequence){
   for(const otherId of mod.conflictsWith??[]){
    const other=byId.get(otherId);
    const key=[mod.id,otherId].sort().join(':');
    if(seenConflicts.has(key))continue;
    seenConflicts.add(key);
    if(!other){
     push(game,{code:'unknown-conflict',severity:'notice',
      message:mod.title+' declara conflito com um ID ausente: '+otherId+'.'},'unknown:'+key);
    }else if(other.game!==game){
     push(game,{code:'unknown-conflict',severity:'notice',
      message:mod.title+' declara conflito com um registro de outro jogo: '+other.title+'.'},'foreign:'+key);
    }else if(included.has(other.id)){
     push(game,{code:'conflict-in-plan',severity:'blocking',
      message:mod.title+' declara conflito com '+other.title+
       ', ambos incluídos na seleção teórica.'},'combined:'+key);
    }else{
     push(game,{code:'declared-conflict',severity:'notice',
      message:mod.title+' declara conflito com '+other.title+
       '. Presença e ativação no jogo não verificadas.'},'external:'+key);
    }
   }
  }
  groups.push({game,requested:roots.length,sequence});
 }
 return {
  groups,selectedCount:selected.length,
  blockers:issues.filter(i=>i.severity==='blocking').length,
  notices:issues.filter(i=>i.severity==='notice').length,
  issues,mode:'catalog-metadata-only',
  compatibilityVerified:false,installationVerified:false,canInstall:false
 };
}
