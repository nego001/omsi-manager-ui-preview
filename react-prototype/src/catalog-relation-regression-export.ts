import type {ProposedRelationChange,ProposedRelationRegressionSummary} from './catalog-relation-regressions';
import type {RelationIssue} from './relation-analysis';

// User-initiated, non-importable report. The UI shows five examples per
// category but this file describes every flagged declared record (max 200).
// No filesystem information, execution directives or installation approval.
const allowedBlockingCodes:ReadonlySet<string>=new Set([
 'dependency-missing','different-game','dependency-cycle','conflict-in-plan',
 'dependency-version-too-low','game-version-outside-range'
]);
const validId=/^[a-z0-9][a-z0-9_-]*$/;
const games=new Set(['omsi','ets2','ats']);
const invalid=():never=>{throw Error('DECLARED_RELATION_REGRESSION_EXPORT_INVALID');};
type Entry={
 id:string;title:string;game:'omsi'|'ets2'|'ats';
 previousBlockers:number;proposedBlockers:number;
 previousBlockingCodes:RelationIssue['code'][];
 proposedBlockingCodes:RelationIssue['code'][];
 favoriteNow:boolean;selectedNow:boolean;
};
function bounded(value:unknown):number{
 if(!Number.isSafeInteger(value)||typeof value!=='number'||value<0||value>200)
  return invalid();
 return value;
}
function codes(value:unknown,blockers:number):RelationIssue['code'][]{
 if(!Array.isArray(value)||value.length>6||value.length>blockers||
  (blockers===0&&value.length!==0)||(blockers>0&&value.length===0))return invalid();
 const seen=new Set<string>();
 return value.map(code=>{
  if(typeof code!=='string'||!allowedBlockingCodes.has(code)||seen.has(code))
   return invalid();
  seen.add(code);
  return code as RelationIssue['code'];
 });
}
export function serializeDeclaredRelationRegressions(
 summary:ProposedRelationRegressionSummary
):string{
 if(!summary||typeof summary!=='object'||
  !Array.isArray(summary.newlyBlocked)||!Array.isArray(summary.worsened)||
  !Array.isArray(summary.changedReasons)||!Array.isArray(summary.addedBlocked)||
  summary.installedPackagesChecked!==false||
  summary.realCompatibilityVerified!==false)return invalid();
 const comparedExisting=bounded(summary.comparedExisting);
 const addedRecords=bounded(summary.addedRecords);
 const improvedExisting=bounded(summary.improvedExisting);
 if(comparedExisting+addedRecords>200||improvedExisting>comparedExisting)
  return invalid();
 const seen=new Set<string>();
 const check=(values:readonly ProposedRelationChange[],
  category:'newlyBlocked'|'worsened'|'changedReasons'|'addedBlocked'):Entry[]=>{
  if(values.length>200)return invalid();
  return values.map(value=>{
   if(!value||typeof value!=='object'||typeof value.id!=='string'||
    value.id.length>64||!validId.test(value.id)||seen.has(value.id)||
    typeof value.title!=='string'||!value.title.trim()||value.title.length>100||
    /[\u0000-\u001f\u007f]/.test(value.title)||
    !games.has(value.game)||typeof value.favoriteNow!=='boolean'||
    typeof value.selectedNow!=='boolean'||value.selectedNow&&!value.favoriteNow)
    return invalid();
   const before=bounded(value.previousBlockers);
   const after=bounded(value.proposedBlockers);
   const oldCodes=codes(value.previousBlockingCodes,before);
   const newCodes=codes(value.proposedBlockingCodes,after);
   if(category==='newlyBlocked'&&!(before===0&&after>0)||
    category==='worsened'&&!(before>0&&after>before)||
    category==='changedReasons'&&!(before>=after&&after>0&&
     (before===after
      ?oldCodes.length!==newCodes.length||oldCodes.some(c=>!newCodes.includes(c))
      :newCodes.some(c=>!oldCodes.includes(c))))||
    category==='addedBlocked'&&!(before===0&&after>0))
    return invalid();
   if(category==='addedBlocked'&&(value.favoriteNow||value.selectedNow))return invalid();
   seen.add(value.id);
   return {id:value.id,title:value.title,game:value.game,
    previousBlockers:before,proposedBlockers:after,
    previousBlockingCodes:oldCodes,proposedBlockingCodes:newCodes,
    favoriteNow:value.favoriteNow,selectedNow:value.selectedNow};
  });
 };
 const newlyBlocked=check(summary.newlyBlocked,'newlyBlocked');
 const worsened=check(summary.worsened,'worsened');
 const changedReasons=check(summary.changedReasons,'changedReasons');
 const addedBlocked=check(summary.addedBlocked,'addedBlocked');
 // A record may both have FEWER blockers numerically and have gained a new
 // blocker TYPE. That legitimate overlap is counted in both quantities.
 const overlap=changedReasons.filter(x=>x.proposedBlockers<x.previousBlockers).length;
 if(improvedExisting<overlap||
  newlyBlocked.length+worsened.length+changedReasons.length+improvedExisting-overlap>comparedExisting||
  addedBlocked.length>addedRecords)return invalid();
 const output={
  schema:'omsi-manager-declared-relation-regressions-v1',
  scope:'pending-catalog-logical-blockers-metadata-only',
  source:'catalog-declarations-unverified',
  counts:{comparedExisting,addedRecords,improvedExisting,
   newlyBlocked:newlyBlocked.length,worsened:worsened.length,
   changedReasons:changedReasons.length,addedBlocked:addedBlocked.length},
  newlyBlocked,worsened,changedReasons,addedBlocked,
  completeFlaggedRecords:true,
  proposedCatalogApplied:false,restorableByPreview:false,
  installedPackagesChecked:false,realCompatibilityVerified:false,
  installationVerified:false,sourceAuthenticated:false,
  disclaimer:'Análise lógica dos metadados declarados, não comprovação de mod instalado, compatibilidade real, autenticidade ou segurança executável.'
 };
 const json=JSON.stringify(output,null,2)+'\n';
 if(new TextEncoder().encode(json).byteLength>131072)
  throw Error('DECLARED_RELATION_REGRESSION_EXPORT_TOO_LARGE');
 return json;
}
