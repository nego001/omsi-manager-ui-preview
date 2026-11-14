import type {FavoriteCatalogImpact} from './favorite-catalog-impact';
import type {DeclaredCatalogField} from './catalog-replacement-diff';

// Human-initiated export of the COMPLETE favorite-only pending comparison.
// Fixed schema, no arbitrary source props, no filesystem paths or restore
// instructions. The current favorites are still discarded on confirmation.
const fieldNames:ReadonlySet<string>=new Set([
 'title','game','category','version','description','size','requires',
 'conflictsWith','gameVersionRange','requiresMinVersions'
]);
const idPattern=/^[a-z0-9][a-z0-9_-]*$/;
const invalid=():never=>{throw Error('DECLARED_FAVORITE_IMPACT_EXPORT_INVALID');};
function checkedId(value:unknown):string{
 if(typeof value!=='string'||value.length<1||value.length>64||
  !idPattern.test(value))return invalid();
 return value;
}
function checkedTitle(value:unknown):string{
 if(typeof value!=='string'||!value.trim()||value.length>160||
  /[\u0000-\u001f\u007f]/.test(value))return invalid();
 return value;
}
export function serializeDeclaredFavoriteImpact(impact:FavoriteCatalogImpact):string{
 if(!impact||typeof impact!=='object'||!Array.isArray(impact.unchanged)||
  !Array.isArray(impact.changed)||!Array.isArray(impact.removed)||
  !Number.isSafeInteger(impact.total)||impact.total<0||impact.total>200||
  impact.unchanged.length+impact.changed.length+impact.removed.length!==impact.total||
  impact.allFavoritesDiscardedOnConfirmation!==true||
  impact.installedPackagesCompared!==false||
  impact.sameIdProvesPackageIdentity!==false)
  return invalid();
 const seen=new Set<string>();
 function claim(value:unknown):string{
  const key=checkedId(value);
  if(seen.has(key))return invalid();
  seen.add(key);
  return key;
 }
 const unchanged=impact.unchanged.map(entry=>{
  if(!entry||typeof entry!=='object')return invalid();
  return {id:claim(entry.id),title:checkedTitle(entry.title)};
 });
 const changed=impact.changed.map(entry=>{
  if(!entry||typeof entry!=='object'||!Array.isArray(entry.fields)||
   entry.fields.length<1||entry.fields.length>10)return invalid();
  const fields:DeclaredCatalogField[]=[];
  for(const value of entry.fields){
   if(typeof value!=='string'||!fieldNames.has(value)||
    fields.includes(value as DeclaredCatalogField))return invalid();
   fields.push(value as DeclaredCatalogField);
  }
  return {id:claim(entry.id),oldTitle:checkedTitle(entry.oldTitle),
   newTitle:checkedTitle(entry.newTitle),fields};
 });
 const removed=impact.removed.map(entry=>{
  if(!entry||typeof entry!=='object')return invalid();
  return {id:claim(entry.id),title:checkedTitle(entry.title)};
 });
 const output={
  schema:'omsi-manager-declared-favorite-impact-v1',
  scope:'pending-catalog-favorites-impact-metadata-only',
  source:'catalog-declarations-unverified',
  counts:{total:impact.total,unchanged:unchanged.length,
   changed:changed.length,removed:removed.length},
  unchanged,changed,removed,
  completeFavoriteImpact:true,
  allFavoritesDiscardedOnConfirmation:true,
  proposedCatalogApplied:false,
  sourceAuthenticated:false,
  installationVerified:false,
  compatibilityVerified:false,
  installedPackagesCompared:false,
  restorableByPreview:false,
  sameIdProvesPackageIdentity:false,
  disclaimer:'Relatório de favoritos declarados, não um backup restaurável. IDs iguais não comprovam identidade do pacote. A proposta não foi aplicada.'
 };
 const json=JSON.stringify(output,null,2)+'\n';
 if(new TextEncoder().encode(json).byteLength>131072)
  throw Error('DECLARED_FAVORITE_IMPACT_EXPORT_TOO_LARGE');
 return json;
}
