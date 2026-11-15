import type {CatalogMod} from './catalog';
import {compareNumericVersions,validNumericVersion} from './version-requirements';

// Compare only declared version constraints on records with the same ID.
// This is NOT a runtime compatibility verdict, nor an installed-file scan.
export type DeclaredVersionFloor={id:string;minVersion:string};
export type DeclaredVersionFloorChange={
 id:string;oldMinVersion:string;newMinVersion:string;
};
export type DeclaredVersionConstraintChange={
 id:string;title:string;game:CatalogMod['game'];
 oldGameMin:string|null;newGameMin:string|null;
 oldGameMax:string|null;newGameMax:string|null;
 addedFloors:readonly DeclaredVersionFloor[];
 removedFloors:readonly DeclaredVersionFloor[];
 changedFloors:readonly DeclaredVersionFloorChange[];
};
export type DeclaredVersionConstraintSummary={
 changed:readonly DeclaredVersionConstraintChange[];
 comparedIds:number;unchangedConstraints:number;
 installedFilesChecked:false;realCompatibilityVerified:false;
};
const pattern=/^[a-z0-9][a-z0-9_-]*$/;
const games=new Set(['omsi','ets2','ats']);
const invalid=():never=>{throw Error('DECLARED_VERSION_CONSTRAINTS_INVALID');};
function id(value:unknown):string{
 if(typeof value!=='string'||value.length<1||value.length>64||
  !pattern.test(value))return invalid();
 return value;
}
function refs(value:unknown):Set<string>{
 if(value===undefined)return new Set();
 if(!Array.isArray(value)||value.length>20)return invalid();
 const out=new Set<string>();
 for(const item of value){
  const key=id(item);
  if(out.has(key))return invalid();
  out.add(key);
 }
 return out;
}
type Range={min:string|null;max:string|null};
function range(value:unknown):Range{
 if(value===undefined)return {min:null,max:null};
 if(!value||typeof value!=='object'||Array.isArray(value))return invalid();
 const raw=value as Record<string,unknown>;
 if(Object.keys(raw).length===0||
  Object.keys(raw).some(k=>k!=='min'&&k!=='max'))return invalid();
 const min=raw.min??null,max=raw.max??null;
 if(min!==null&&!validNumericVersion(min)||max!==null&&!validNumericVersion(max))
  return invalid();
 if(min!==null&&max!==null&&compareNumericVersions(min as string,max as string)===1)
  return invalid();
 return {min:min as string|null,max:max as string|null};
}
function floors(value:unknown,required:Set<string>):Map<string,string>{
 if(value===undefined)return new Map();
 if(!Array.isArray(value)||value.length>20)return invalid();
 const result=new Map<string,string>();
 for(const entry of value){
  if(!entry||typeof entry!=='object'||Array.isArray(entry))return invalid();
  const raw=entry as Record<string,unknown>,key=id(raw.id);
  if(Object.keys(raw).length!==2||
   !Object.hasOwn(raw,'id')||!Object.hasOwn(raw,'minVersion')||
   !required.has(key)||result.has(key)||!validNumericVersion(raw.minVersion))
   return invalid();
  result.set(key,raw.minVersion);
 }
 return result;
}
function checked(source:readonly CatalogMod[]):Map<string,CatalogMod>{
 if(!Array.isArray(source)||source.length<1||source.length>200)return invalid();
 const result=new Map<string,CatalogMod>();
 for(const mod of source){
  if(!mod||typeof mod!=='object'||!games.has(mod.game)||typeof mod.title!=='string'||
   !mod.title.trim()||mod.title.length>100||
   /[\u0000-\u001f\u007f]/.test(mod.title))return invalid();
  const key=id(mod.id);
  if(result.has(key))return invalid();
  floors(mod.requiresMinVersions,refs(mod.requires));
  range(mod.gameVersionRange);
  result.set(key,mod);
 }
 return result;
}
export function compareDeclaredVersionConstraints(
 current:readonly CatalogMod[],proposed:readonly CatalogMod[]
):DeclaredVersionConstraintSummary{
 const before=checked(current),after=checked(proposed);
 const changed:DeclaredVersionConstraintChange[]=[];
 let comparedIds=0;
 for(const oldMod of current){
  const next=after.get(oldMod.id);
  if(!next)continue;
  comparedIds++;
  const oldRange=range(oldMod.gameVersionRange),nextRange=range(next.gameVersionRange);
  const oldFloors=floors(oldMod.requiresMinVersions,refs(oldMod.requires));
  const newFloors=floors(next.requiresMinVersions,refs(next.requires));
  const addedFloors:DeclaredVersionFloor[]=[];
  const removedFloors:DeclaredVersionFloor[]=[];
  const changedFloors:DeclaredVersionFloorChange[]=[];
  for(const [key,version] of oldFloors){
   const newer=newFloors.get(key);
   if(newer===undefined)removedFloors.push(Object.freeze({id:key,minVersion:version}));
   else if(version!==newer)changedFloors.push(Object.freeze({
    id:key,oldMinVersion:version,newMinVersion:newer
   }));
  }
  for(const [key,version] of newFloors){
   if(!oldFloors.has(key))addedFloors.push(Object.freeze({id:key,minVersion:version}));
  }
  if(oldRange.min===nextRange.min&&oldRange.max===nextRange.max&&
   addedFloors.length===0&&removedFloors.length===0&&changedFloors.length===0)continue;
  const byId=(a:{id:string},b:{id:string})=>a.id.localeCompare(b.id);
  changed.push(Object.freeze({
   id:oldMod.id,title:oldMod.title,game:oldMod.game,
   oldGameMin:oldRange.min,newGameMin:nextRange.min,
   oldGameMax:oldRange.max,newGameMax:nextRange.max,
   addedFloors:Object.freeze(addedFloors.sort(byId)),
   removedFloors:Object.freeze(removedFloors.sort(byId)),
   changedFloors:Object.freeze(changedFloors.sort(byId))
  }));
 }
 return Object.freeze({
  changed:Object.freeze(changed),
  comparedIds,unchangedConstraints:comparedIds-changed.length,
  installedFilesChecked:false,realCompatibilityVerified:false
 });
}
