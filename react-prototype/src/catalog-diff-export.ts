import type {DeclaredCatalogDiff,DeclaredCatalogField} from './catalog-replacement-diff';

// A local, user-initiated export. It contains every declared comparison entry,
// not only the five examples shown in the UI. No paths or installation data.
const fieldNames:ReadonlySet<string>=new Set([
 'title','game','category','version','description','size','requires',
 'conflictsWith','gameVersionRange','requiresMinVersions'
]);
const validId=/^[a-z0-9][a-z0-9_-]*$/;
const invalid=()=>{throw Error('DECLARED_CATALOG_DIFF_EXPORT_INVALID');};
function id(value:unknown):string{
 if(typeof value!=='string'||value.length>64||!validId.test(value))return invalid();
 return value;
}
function title(value:unknown):string{
 if(typeof value!=='string'||!value.trim()||value.length>160||
  /[\u0000-\u001f\u007f]/.test(value))return invalid();
 return value;
}
export function serializeDeclaredCatalogDiff(diff:DeclaredCatalogDiff):string{
 if(!diff||typeof diff!=='object'||!Number.isSafeInteger(diff.unchanged)||
  diff.unchanged<0||diff.unchanged>200||
  !Array.isArray(diff.changed)||!Array.isArray(diff.removed)||!Array.isArray(diff.added)||
  diff.changed.length+diff.removed.length+diff.unchanged>200||
  diff.changed.length+diff.added.length+diff.unchanged>200)return invalid();
 const seen=new Set<string>();
 const claim=(value:unknown)=>{
  const key=id(value);
  if(seen.has(key))return invalid();
  seen.add(key);return key;
 };
 const changed=diff.changed.map(entry=>{
  if(!entry||typeof entry!=='object'||!Array.isArray(entry.fields)||
   entry.fields.length<1||entry.fields.length>10)return invalid();
  const fields:DeclaredCatalogField[]=[];
  for(const field of entry.fields){
   if(typeof field!=='string'||!fieldNames.has(field)||fields.includes(field as DeclaredCatalogField))
    return invalid();
   fields.push(field as DeclaredCatalogField);
  }
  return {id:claim(entry.id),oldTitle:title(entry.oldTitle),
   newTitle:title(entry.newTitle),fields};
 });
 const removed=diff.removed.map(entry=>{
  if(!entry||typeof entry!=='object')return invalid();
  return {id:claim(entry.id),title:title(entry.title)};
 });
 const added=diff.added.map(entry=>{
  if(!entry||typeof entry!=='object')return invalid();
  return {id:claim(entry.id),title:title(entry.title)};
 });
 const content={
  schema:'omsi-manager-declared-catalog-diff-v1',
  scope:'pending-catalog-comparison-metadata-only',
  source:'catalog-declarations-unverified',
  counts:{unchanged:diff.unchanged,changed:changed.length,
   removed:removed.length,added:added.length},
  changed,removed,added,
  completeDeclaredDiff:true,
  sourceAuthenticated:false,
  installationVerified:false,
  compatibilityVerified:false,
  restorableByPreview:false,
  proposedCatalogApplied:false,
  disclaimer:'Comparação de dois catálogos declarativos. IDs iguais não comprovam identidade do mod. Não registra instalação, autoria, integridade ou compatibilidade.'
 };
 const json=JSON.stringify(content,null,2)+'\n';
 if(new TextEncoder().encode(json).byteLength>131072)
  throw Error('DECLARED_CATALOG_DIFF_EXPORT_TOO_LARGE');
 return json;
}
