import type {CatalogMod} from './catalog';
import {analyzeModRelations} from './relation-analysis';

// Hypothetical catalog declaration analysis only. This MUST NOT be treated as
// evidence of installed files, executable safety or game compatibility.
export type ProposedRelationChange={
 id:string;title:string;game:CatalogMod['game'];
 previousBlockers:number;proposedBlockers:number;
 proposedBlockingCodes:readonly string[];
 favoriteNow:boolean;selectedNow:boolean;
};
export type ProposedRelationRegressionSummary={
 newlyBlocked:readonly ProposedRelationChange[];
 worsened:readonly ProposedRelationChange[];
 addedBlocked:readonly ProposedRelationChange[];
 improvedExisting:number;
 comparedExisting:number;
 addedRecords:number;
 installedPackagesChecked:false;
 realCompatibilityVerified:false;
};
const validId=/^[a-z0-9][a-z0-9_-]*$/;
const games=new Set(['omsi','ets2','ats']);
const fail=():never=>{throw Error('PROPOSED_RELATION_REGRESSION_INVALID');};
export function summarizeProposedRelationRegressions(
 current:readonly CatalogMod[],proposed:readonly CatalogMod[],
 favoriteIds:readonly string[],selectedIds:readonly string[]
):ProposedRelationRegressionSummary{
 if(!Array.isArray(current)||!Array.isArray(proposed)||
  current.length<1||current.length>200||proposed.length<1||proposed.length>200||
  !Array.isArray(favoriteIds)||favoriteIds.length>200||
  !Array.isArray(selectedIds)||selectedIds.length>200)return fail();
 function index(source:readonly CatalogMod[]){
  const map=new Map<string,CatalogMod>();
  for(const mod of source){
   if(!mod||typeof mod.id!=='string'||mod.id.length<1||
    mod.id.length>64||!validId.test(mod.id)||map.has(mod.id)||
    !games.has(mod.game)||typeof mod.title!=='string'||!mod.title.trim()||
    mod.title.length>160)return fail();
   map.set(mod.id,mod);
  }
  return map;
 }
 const before=index(current),after=index(proposed);
 function membership(ids:readonly string[],subset?:ReadonlySet<string>){
  const seen=new Set<string>();
  for(const id of ids){
   if(typeof id!=='string'||!before.has(id)||seen.has(id)||
    (subset&&!subset.has(id)))return fail();
   seen.add(id);
  }
  return seen;
 }
 const favorite=membership(favoriteIds),selected=membership(selectedIds,favorite);
 const count=(catalog:readonly CatalogMod[],id:string)=>
  analyzeModRelations(catalog,id).issues.filter(x=>x.severity==='blocking');
 const newlyBlocked:ProposedRelationChange[]=[];
 const worsened:ProposedRelationChange[]=[];
 const addedBlocked:ProposedRelationChange[]=[];
 let improvedExisting=0,comparedExisting=0,addedRecords=0;
 for(const mod of proposed){
  const old=before.get(mod.id);
  if(old)comparedExisting++;else addedRecords++;
  const previous=old?count(current,mod.id).length:0;
  const proposedIssues=count(proposed,mod.id);
  const next=proposedIssues.length;
  if(old&&next<previous)improvedExisting++;
  if(next===0||old&&next<=previous)continue;
  const entry:ProposedRelationChange=Object.freeze({
   id:mod.id,title:mod.title,game:mod.game,
   previousBlockers:previous,proposedBlockers:next,
   proposedBlockingCodes:Object.freeze([...new Set(proposedIssues.map(x=>x.code))]),
   favoriteNow:favorite.has(mod.id),selectedNow:selected.has(mod.id)
  });
  if(!old)addedBlocked.push(entry);
  else if(previous===0)newlyBlocked.push(entry);
  else worsened.push(entry);
 }
 return Object.freeze({
  newlyBlocked:Object.freeze(newlyBlocked),
  worsened:Object.freeze(worsened),
  addedBlocked:Object.freeze(addedBlocked),
  improvedExisting,comparedExisting,addedRecords,
  installedPackagesChecked:false,realCompatibilityVerified:false
 });
}
