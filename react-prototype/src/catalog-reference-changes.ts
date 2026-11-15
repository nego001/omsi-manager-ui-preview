import type {CatalogMod} from './catalog';

// Declared references only. This does not inspect mods, installed files or
// resolve identity/compatibility. Changes in ordering alone are ignored.
export type DeclaredReferenceChange={
 id:string;
 oldTitle:string;
 newTitle:string;
 oldGame:CatalogMod['game'];
 newGame:CatalogMod['game'];
 requiresAdded:readonly string[];
 requiresRemoved:readonly string[];
 conflictsAdded:readonly string[];
 conflictsRemoved:readonly string[];
};
export type DeclaredReferenceChangeSummary={
 changed:readonly DeclaredReferenceChange[];
 unchangedReferences:number;
 comparedIds:number;
 installedFilesChecked:false;
 compatibilityVerified:false;
};
const idPattern=/^[a-z0-9][a-z0-9_-]*$/;
const games:ReadonlySet<string>=new Set(['omsi','ets2','ats']);
const invalid=():never=>{throw Error('DECLARED_REFERENCE_CHANGES_INVALID');};
function checkedIds(value:unknown,max:number):readonly string[]{
 if(!Array.isArray(value)||value.length>max)return invalid();
 const seen=new Set<string>();
 for(const id of value){
  if(typeof id!=='string'||id.length<1||id.length>64||
   !idPattern.test(id)||seen.has(id))return invalid();
  seen.add(id);
 }
 return [...seen].sort();
}
function index(source:readonly CatalogMod[]):Map<string,CatalogMod>{
 if(!Array.isArray(source)||source.length<1||source.length>200)
  return invalid();
 const map=new Map<string,CatalogMod>();
 for(const m of source){
  if(!m||typeof m!=='object'||typeof m.id!=='string'||
   m.id.length<1||m.id.length>64||!idPattern.test(m.id)||
   map.has(m.id)||!games.has(m.game)||typeof m.title!=='string'||
   !m.title.trim()||m.title.length>100||
   /[\u0000-\u001f\u007f]/.test(m.title))return invalid();
  checkedIds(m.requires??[],20);
  checkedIds(m.conflictsWith??[],20);
  map.set(m.id,m);
 }
 return map;
}
function delta(oldIds:readonly string[],newIds:readonly string[]){
 const older=new Set(oldIds),newer=new Set(newIds);
 return {
  added:Object.freeze(newIds.filter(x=>!older.has(x))),
  removed:Object.freeze(oldIds.filter(x=>!newer.has(x)))
 };
}
export function compareDeclaredReferenceTargets(
 current:readonly CatalogMod[],proposed:readonly CatalogMod[]
):DeclaredReferenceChangeSummary{
 const before=index(current),after=index(proposed);
 const changed:DeclaredReferenceChange[]=[];
 let comparedIds=0;
 for(const oldMod of current){
  const next=after.get(oldMod.id);
  if(!next)continue;
  comparedIds++;
  const requires=delta(
   checkedIds(oldMod.requires??[],20),checkedIds(next.requires??[],20));
  const conflicts=delta(
   checkedIds(oldMod.conflictsWith??[],20),checkedIds(next.conflictsWith??[],20));
  if(!(requires.added.length||requires.removed.length||
   conflicts.added.length||conflicts.removed.length))continue;
  changed.push(Object.freeze({
   id:oldMod.id,oldTitle:oldMod.title,newTitle:next.title,
   oldGame:oldMod.game,newGame:next.game,
   requiresAdded:requires.added,requiresRemoved:requires.removed,
   conflictsAdded:conflicts.added,conflictsRemoved:conflicts.removed
  }));
 }
 return Object.freeze({
  changed:Object.freeze(changed),
  unchangedReferences:comparedIds-changed.length,
  comparedIds,
  installedFilesChecked:false,
  compatibilityVerified:false
 });
}
