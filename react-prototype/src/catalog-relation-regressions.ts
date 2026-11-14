import type {CatalogMod} from './catalog';
import {analyzeModRelations,type RelationIssue} from './relation-analysis';

// Hypothetical catalog declaration analysis only. This MUST NOT be treated as
// evidence of installed files, executable safety or game compatibility.
export type ProposedRelationChange={
 id:string;title:string;game:CatalogMod['game'];
 previousBlockers:number;proposedBlockers:number;
 previousBlockingCodes:readonly RelationIssue['code'][];
 proposedBlockingCodes:readonly RelationIssue['code'][];
 favoriteNow:boolean;selectedNow:boolean;
};
export type ProposedRelationRegressionSummary={
 newlyBlocked:readonly ProposedRelationChange[];
 worsened:readonly ProposedRelationChange[];
 changedReasons:readonly ProposedRelationChange[];
 addedBlocked:readonly ProposedRelationChange[];
 improvedExisting:number;
 comparedExisting:number;
 addedRecords:number;
 installedPackagesChecked:false;
 realCompatibilityVerified:false;
};
// Labels refer to declared logical findings, NEVER installed-file verdicts.
export const declaredBlockingReasonLabels:Readonly<Record<RelationIssue['code'],string>>=Object.freeze({
 'dependency-missing':'Dependência declarada ausente',
 'different-game':'Dependência declarada de outro simulador',
 'dependency-cycle':'Dependências declaradas em ciclo',
 'conflict-in-plan':'Conflito declarado na mesma sequência',
 'declared-conflict':'Conflito declarado sem comprovação de instalação',
 'unknown-conflict':'Conflito com ID ausente ou de outro jogo',
 'dependency-version-too-low':'Versão declarada da dependência abaixo da mínima',
 'dependency-version-unknown':'Versão declarada de dependência não comparável',
 'game-version-unknown':'Versão hipotética do jogo desconhecida',
 'game-version-invalid':'Versão hipotética do jogo inválida',
 'game-version-outside-range':'Versão hipotética fora da faixa declarada'
});
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
 const changedReasons:ProposedRelationChange[]=[];
 const addedBlocked:ProposedRelationChange[]=[];
 let improvedExisting=0,comparedExisting=0,addedRecords=0;
 for(const mod of proposed){
  const old=before.get(mod.id);
  if(old)comparedExisting++;else addedRecords++;
  const previousIssues=old?count(current,mod.id):[];
  const previous=previousIssues.length;
  const proposedIssues=count(proposed,mod.id);
  const next=proposedIssues.length;
  if(old&&next<previous){improvedExisting++;continue;}
  if(next===0)continue;
  const previousCodes=[...new Set(previousIssues.map(x=>x.code))];
  const proposedCodes=[...new Set(proposedIssues.map(x=>x.code))];
  // A changed blocker TYPE with the same count is not an increase, but it
  // still warrants disclosure. Changes within the same code remain out of
  // scope, and neither result is real compatibility evidence.
  const sameTypes=previousCodes.length===proposedCodes.length&&
   previousCodes.every(x=>proposedCodes.includes(x));
  if(old&&next===previous&&sameTypes)continue;
  const entry:ProposedRelationChange=Object.freeze({
   id:mod.id,title:mod.title,game:mod.game,
   previousBlockers:previous,proposedBlockers:next,
   previousBlockingCodes:Object.freeze(previousCodes),
   proposedBlockingCodes:Object.freeze(proposedCodes),
   favoriteNow:favorite.has(mod.id),selectedNow:selected.has(mod.id)
  });
  if(!old)addedBlocked.push(entry);
  else if(previous===0)newlyBlocked.push(entry);
  else if(next>previous)worsened.push(entry);
  else changedReasons.push(entry);
 }
 return Object.freeze({
  newlyBlocked:Object.freeze(newlyBlocked),
  worsened:Object.freeze(worsened),
  changedReasons:Object.freeze(changedReasons),
  addedBlocked:Object.freeze(addedBlocked),
  improvedExisting,comparedExisting,addedRecords,
  installedPackagesChecked:false,realCompatibilityVerified:false
 });
}
