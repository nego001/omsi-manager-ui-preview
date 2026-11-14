import type {DeclaredReferenceChangeSummary} from './catalog-reference-changes';

// Complete, human-initiated export of an UNAPPLIED metadata-only catalog
// proposal. Never include filesystem paths, commands, package bytes or restore
// instructions. Use a dedicated schema which cannot be imported as a catalog.
const idPattern=/^[a-z0-9][a-z0-9_-]*$/;
const games=new Set(['omsi','ets2','ats']);
const invalid=():never=>{throw Error('DECLARED_REFERENCE_EXPORT_INVALID');};
function integer(value:unknown):number{
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>200)
  return invalid();
 return value;
}
function id(value:unknown):string{
 if(typeof value!=='string'||value.length<1||value.length>64||
  !idPattern.test(value))return invalid();
 return value;
}
function title(value:unknown):string{
 if(typeof value!=='string'||!value.trim()||value.length>100||
  /[\u0000-\u001f\u007f]/.test(value))return invalid();
 return value;
}
function ids(value:unknown):string[]{
 if(!Array.isArray(value)||value.length>20)return invalid();
 const seen=new Set<string>();
 for(const item of value){
  const key=id(item);
  if(seen.has(key))return invalid();
  seen.add(key);
 }
 return [...seen].sort();
}
export function serializeDeclaredReferenceChanges(
 summary:DeclaredReferenceChangeSummary
):string{
 if(!summary||typeof summary!=='object'||!Array.isArray(summary.changed)||
  summary.installedFilesChecked!==false||
  summary.compatibilityVerified!==false)return invalid();
 const comparedIds=integer(summary.comparedIds);
 const unchangedReferences=integer(summary.unchangedReferences);
 if(summary.changed.length>200||
  unchangedReferences+summary.changed.length!==comparedIds)return invalid();
 const seenIds=new Set<string>();
 const changed=summary.changed.map(entry=>{
  if(!entry||typeof entry!=='object')return invalid();
  const key=id(entry.id);
  if(seenIds.has(key))return invalid();
  seenIds.add(key);
  if(!games.has(entry.oldGame)||!games.has(entry.newGame))return invalid();
  const requiresAdded=ids(entry.requiresAdded);
  const requiresRemoved=ids(entry.requiresRemoved);
  const conflictsAdded=ids(entry.conflictsAdded);
  const conflictsRemoved=ids(entry.conflictsRemoved);
  if(!(requiresAdded.length||requiresRemoved.length||
   conflictsAdded.length||conflictsRemoved.length))return invalid();
  // Each side represents a *difference*, never a shared target.
  if(requiresAdded.some(x=>requiresRemoved.includes(x))||
   conflictsAdded.some(x=>conflictsRemoved.includes(x)))return invalid();
  return {
   id:key,oldTitle:title(entry.oldTitle),newTitle:title(entry.newTitle),
   oldGame:entry.oldGame,newGame:entry.newGame,
   requiresAdded,requiresRemoved,conflictsAdded,conflictsRemoved
  };
 });
 const result={
  schema:'omsi-manager-declared-reference-changes-v1',
  scope:'pending-catalog-dependency-conflict-targets-metadata-only',
  source:'catalog-declarations-unverified',
  counts:{comparedIds,unchangedReferences,changed:changed.length},
  changed,
  completeReferenceChanges:true,
  proposedCatalogApplied:false,
  sourceAuthenticated:false,
  installationVerified:false,
  compatibilityVerified:false,
  installedFilesChecked:false,
  restorableByPreview:false,
  sameIdProvesPackageIdentity:false,
  disclaimer:'Relatório de alvos declarados de dependências e conflitos. Não comprova arquivos instalados, identidade dos pacotes, compatibilidade real ou autorização para executar operações.'
 };
 const json=JSON.stringify(result,null,2)+'\n';
 if(new TextEncoder().encode(json).byteLength>131072)
  throw Error('DECLARED_REFERENCE_EXPORT_TOO_LARGE');
 return json;
}
