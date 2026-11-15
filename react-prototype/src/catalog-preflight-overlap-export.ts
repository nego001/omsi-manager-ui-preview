import type {DeclaredPreflightDistinctIdSummary,DeclaredPreflightGroup} from './catalog-preflight-distinct-ids';

// A bounded manual export of unverified, in-memory catalog declarations.
// It cannot be imported as a catalog and never describes installed packages.
const groupOrder:readonly DeclaredPreflightGroup[]=[
 'cross-game','blockers','references','versions'
];
const validId=/^[a-z0-9][a-z0-9_-]*$/;
const invalid=():never=>{throw Error('DECLARED_PREFLIGHT_OVERLAP_EXPORT_INVALID');};
function count(v:unknown):number{
 if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>200)return invalid();
 return v;
}
export function serializeDeclaredPreflightOverlaps(
 summary:DeclaredPreflightDistinctIdSummary
):string{
 if(!summary||typeof summary!=='object'||
  summary.installedFilesChecked!==false||
  summary.realCompatibilityVerified!==false||
  !Array.isArray(summary.allOverlaps)||
  !Array.isArray(summary.overlapExamples))return invalid();
 const distinctIds=count(summary.distinctIds);
 const overlappingIds=count(summary.overlappingIds);
 const omitted=count(summary.overlapExamplesOmitted);
 if(summary.allOverlaps.length!==overlappingIds||
  overlappingIds>distinctIds||
  summary.overlapExamples.length!==Math.min(5,overlappingIds)||
  omitted!==Math.max(0,overlappingIds-5))return invalid();
 const overlaps=summary.allOverlaps.map((entry,index)=>{
  if(!entry||typeof entry!=='object'||typeof entry.id!=='string'||
   entry.id.length<1||entry.id.length>64||!validId.test(entry.id)||
   (index>0&&entry.id<=summary.allOverlaps[index-1].id)||
   !Array.isArray(entry.groups)||entry.groups.length<2||
   entry.groups.length>groupOrder.length)return invalid();
  const indices=entry.groups.map((g:DeclaredPreflightGroup)=>groupOrder.indexOf(g));
  if(indices.some((v:number,i:number)=>v<0||(i>0&&v<=indices[i-1])))return invalid();
  return {id:entry.id,groups:[...entry.groups]};
 });
 for(let i=0;i<summary.overlapExamples.length;i++){
  const entry=summary.overlapExamples[i];
  if(!entry||entry.id!==overlaps[i].id||
   !Array.isArray(entry.groups)||
   JSON.stringify(entry.groups)!==JSON.stringify(overlaps[i].groups))return invalid();
 }
 const output={
  schema:'omsi-manager-declared-preflight-overlaps-v1',
  scope:'pending-catalog-declared-id-alert-overlaps-only',
  source:'unverified-catalog-json',
  counts:{distinctIds,overlappingIds},
  overlaps,
  completeOverlapList:true,
  proposedCatalogApplied:false,
  installedFilesChecked:false,
  compatibilityVerified:false,
  sourceAuthenticated:false,
  installedPackageIdentityVerified:false,
  restorableByPreview:false,
  disclaimer:'IDs são declarações do catálogo, não identidades verificadas de pacotes; grupos sobrepostos não constituem pontuação de segurança, compatibilidade ou autorização de instalação.'
 };
 const json=JSON.stringify(output,null,2)+'\n';
 if(new TextEncoder().encode(json).byteLength>131072)
  throw Error('DECLARED_PREFLIGHT_OVERLAP_EXPORT_TOO_LARGE');
 return json;
}
