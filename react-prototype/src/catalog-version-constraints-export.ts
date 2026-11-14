import type {DeclaredVersionConstraintSummary} from './catalog-version-constraints';
import {compareNumericVersions,validNumericVersion} from './version-requirements';

// Export only explicitly selected catalog declarations. Never export paths,
// commands, package data or a verdict about installed versions.
const validId=/^[a-z0-9][a-z0-9_-]*$/;
const allowedGames:ReadonlySet<string>=new Set(['omsi','ets2','ats']);
const invalid=():never=>{throw Error('DECLARED_VERSION_CONSTRAINT_EXPORT_INVALID');};
function natural(value:unknown):number{
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>200)
  return invalid();
 return value;
}
function id(value:unknown):string{
 if(typeof value!=='string'||value.length===0||value.length>64||
  !validId.test(value))return invalid();
 return value;
}
function title(value:unknown):string{
 if(typeof value!=='string'||!value.trim()||value.length>100||
  /[\u0000-\u001f\u007f]/.test(value))return invalid();
 return value;
}
function version(value:unknown):string{
 if(!validNumericVersion(value))return invalid();
 return value;
}
function bound(value:unknown):string|null{
 if(value===null)return null;
 return version(value);
}
function checkRange(min:string|null,max:string|null){
 if(min!==null&&max!==null&&compareNumericVersions(min,max)===1)
  return invalid();
}
function plainFloors(value:unknown):{id:string;minVersion:string}[]{
 if(!Array.isArray(value)||value.length>20)return invalid();
 const seen=new Set<string>();
 return value.map(entry=>{
  if(!entry||typeof entry!=='object')return invalid();
  const key=id(entry.id);
  if(seen.has(key))return invalid();
  seen.add(key);
  return {id:key,minVersion:version(entry.minVersion)};
 }).sort((a,b)=>a.id.localeCompare(b.id));
}
function updatedFloors(value:unknown):{id:string;oldMinVersion:string;newMinVersion:string}[]{
 if(!Array.isArray(value)||value.length>20)return invalid();
 const seen=new Set<string>();
 return value.map(entry=>{
  if(!entry||typeof entry!=='object')return invalid();
  const key=id(entry.id);
  if(seen.has(key))return invalid();
  seen.add(key);
  const before=version(entry.oldMinVersion),after=version(entry.newMinVersion);
  if(before===after)return invalid();
  return {id:key,oldMinVersion:before,newMinVersion:after};
 }).sort((a,b)=>a.id.localeCompare(b.id));
}
export function serializeDeclaredVersionConstraintChanges(
 summary:DeclaredVersionConstraintSummary
):string{
 if(!summary||typeof summary!=='object'||!Array.isArray(summary.changed)||
  summary.installedFilesChecked!==false||
  summary.realCompatibilityVerified!==false)return invalid();
 const comparedIds=natural(summary.comparedIds),
  unchangedConstraints=natural(summary.unchangedConstraints);
 if(summary.changed.length>200||
  summary.changed.length+unchangedConstraints!==comparedIds)return invalid();
 const seen=new Set<string>();
 const changed=summary.changed.map(entry=>{
  if(!entry||typeof entry!=='object')return invalid();
  const key=id(entry.id);
  if(seen.has(key)||!allowedGames.has(entry.game))return invalid();
  seen.add(key);
  const oldGameMin=bound(entry.oldGameMin),newGameMin=bound(entry.newGameMin),
   oldGameMax=bound(entry.oldGameMax),newGameMax=bound(entry.newGameMax);
  checkRange(oldGameMin,oldGameMax);
  checkRange(newGameMin,newGameMax);
  const addedFloors=plainFloors(entry.addedFloors),
   removedFloors=plainFloors(entry.removedFloors),
   changedFloors=updatedFloors(entry.changedFloors);
  const all=new Set<string>();
  for(const floor of [...addedFloors,...removedFloors,...changedFloors]){
   if(all.has(floor.id))return invalid();
   all.add(floor.id);
  }
  if(oldGameMin===newGameMin&&oldGameMax===newGameMax&&
   addedFloors.length===0&&removedFloors.length===0&&changedFloors.length===0)
   return invalid();
  return {
   id:key,title:title(entry.title),game:entry.game,
   oldGameMin,newGameMin,oldGameMax,newGameMax,
   addedFloors,removedFloors,changedFloors
  };
 });
 const output={
  schema:'omsi-manager-declared-version-constraints-v1',
  scope:'pending-catalog-version-requirements-metadata-only',
  source:'catalog-declarations-unverified',
  counts:{comparedIds,unchangedConstraints,changed:changed.length},
  changed,
  completeDeclaredVersionChanges:true,
  proposedCatalogApplied:false,restorableByPreview:false,
  installedFilesChecked:false,realCompatibilityVerified:false,
  installationVerified:false,sourceAuthenticated:false,
  sameIdProvesPackageIdentity:false,
  disclaimer:'Comparação hipotética de limites declarados de versão, não uma inspeção das versões instaladas nem prova de compatibilidade, integridade ou segurança.'
 };
 const json=JSON.stringify(output,null,2)+'\n';
 if(new TextEncoder().encode(json).byteLength>131072)
  throw Error('DECLARED_VERSION_CONSTRAINT_EXPORT_TOO_LARGE');
 return json;
}
