import type {DeclaredVersionConstraintChange,DeclaredVersionConstraintSummary} from './catalog-version-constraints';
import {compareNumericVersions,validNumericVersion} from './version-requirements';

// Direction of DECLARED constraints only, never a verdict about installed
// versions, package identity or whether the real mod will work.
export type ConstraintDirection='more-restrictive'|'less-restrictive'|
 'mixed-directions'|'numerically-equivalent'|'different-games-not-comparable';
export type ConstraintDirectionItem={id:string;direction:ConstraintDirection};
export type ConstraintDirectionSummary={
 items:readonly ConstraintDirectionItem[];
 counts:Readonly<Record<ConstraintDirection,number>>;
 installedVersionsChecked:false;
 realCompatibilityVerified:false;
};
const invalid=():never=>{throw Error('DECLARED_CONSTRAINT_DIRECTION_INVALID');};
const idPattern=/^[a-z0-9][a-z0-9_-]*$/;
function checkedVersion(v:unknown):string|null{
 if(v===null)return null;
 if(!validNumericVersion(v))return invalid();
 return v;
}
function delta(oldValue:string|null,newValue:string|null,kind:'minimum'|'maximum'){
 if(oldValue===null&&newValue===null)return 0;
 // Adding a lower bound or a ceiling tightens declared requirements;
 // removing one relaxes them. Bounds are inclusive numeric strings.
 if(oldValue===null)return 1;
 if(newValue===null)return -1;
 const comparison=compareNumericVersions(newValue,oldValue);
 if(comparison===null)return invalid();
 return kind==='minimum'?comparison:-comparison;
}
function direction(change:DeclaredVersionConstraintChange):ConstraintDirection{
 if(!change||typeof change!=='object')return invalid();
 const oldMin=checkedVersion(change.oldGameMin),newMin=checkedVersion(change.newGameMin);
 const oldMax=checkedVersion(change.oldGameMax),newMax=checkedVersion(change.newGameMax);
 if(oldMin!==null&&oldMax!==null&&compareNumericVersions(oldMin,oldMax)===1||
  newMin!==null&&newMax!==null&&compareNumericVersions(newMin,newMax)===1)
  return invalid();
 let tighter=false,looser=false;
 const consume=(value:number)=>{
  if(value>0)tighter=true;
  if(value<0)looser=true;
 };
 consume(delta(oldMin,newMin,'minimum'));
 consume(delta(oldMax,newMax,'maximum'));
 if(!Array.isArray(change.addedFloors)||!Array.isArray(change.removedFloors)||
  !Array.isArray(change.changedFloors)||
  change.addedFloors.length>20||change.removedFloors.length>20||
  change.changedFloors.length>20)return invalid();
 const seen=new Set<string>();
 const claim=(key:unknown)=>{
  if(typeof key!=='string'||key.length>64||!idPattern.test(key)||seen.has(key))
   return invalid();
  seen.add(key);
 };
 for(const floor of change.addedFloors){
  if(!floor||typeof floor!=='object')return invalid();
  claim(floor.id);
  checkedVersion(floor.minVersion);
  if(!validNumericVersion(floor.minVersion))return invalid();
  tighter=true;
 }
 for(const floor of change.removedFloors){
  if(!floor||typeof floor!=='object')return invalid();
  claim(floor.id);
  if(!validNumericVersion(floor.minVersion))return invalid();
  looser=true;
 }
 for(const floor of change.changedFloors){
  if(!floor||typeof floor!=='object')return invalid();
  claim(floor.id);
  const left=checkedVersion(floor.oldMinVersion),right=checkedVersion(floor.newMinVersion);
  if(left===null||right===null)return invalid();
  consume(delta(left,right,'minimum'));
 }
 if(tighter&&looser)return 'mixed-directions';
 if(tighter)return 'more-restrictive';
 if(looser)return 'less-restrictive';
 return 'numerically-equivalent';
}
export function summarizeDeclaredConstraintDirections(
 summary:DeclaredVersionConstraintSummary,
 crossGameIds:readonly string[]
):ConstraintDirectionSummary{
 if(!summary||typeof summary!=='object'||!Array.isArray(summary.changed)||
  summary.changed.length>200||
  !Number.isSafeInteger(summary.comparedIds)||summary.comparedIds<0||
  summary.comparedIds>200||
  !Number.isSafeInteger(summary.unchangedConstraints)||
  summary.unchangedConstraints<0||
  summary.changed.length+summary.unchangedConstraints!==summary.comparedIds||
  !Array.isArray(crossGameIds)||
  crossGameIds.length>200||summary.installedFilesChecked!==false||
  summary.realCompatibilityVerified!==false)return invalid();
 const cross=new Set<string>();
 for(const key of crossGameIds){
  if(typeof key!=='string'||key.length>64||
   !idPattern.test(key)||cross.has(key))return invalid();
  cross.add(key);
 }
 const seen=new Set<string>();
 const counts:Record<ConstraintDirection,number>={
  'more-restrictive':0,'less-restrictive':0,
  'mixed-directions':0,'numerically-equivalent':0,
  'different-games-not-comparable':0
 };
 const items=summary.changed.map(change=>{
  if(!change||typeof change.id!=='string'||change.id.length>64||
   !idPattern.test(change.id)||seen.has(change.id))return invalid();
  seen.add(change.id);
  // Validate every constraint even if its associated mod switched games.
  // A cross-game reference in a changed floor also invalidates numerical
  // comparisons: an identical dependency ID is not proof of package identity.
  const analyzed=direction(change);
  const affectedFloors=[
   ...change.addedFloors,...change.removedFloors,...change.changedFloors
  ];
  const crossGameDependency=affectedFloors.some(floor=>cross.has(floor.id));
  const category=cross.has(change.id)||crossGameDependency?
   'different-games-not-comparable':analyzed;
  counts[category]++;
  return Object.freeze({id:change.id,direction:category});
 });
 return Object.freeze({
  items:Object.freeze(items),counts:Object.freeze(counts),
  installedVersionsChecked:false,realCompatibilityVerified:false
 });
}
export const declaredConstraintDirectionLabels:Readonly<Record<ConstraintDirection,string>>=Object.freeze({
 'more-restrictive':'Exigências declaradas mais restritivas',
 'less-restrictive':'Exigências declaradas menos restritivas',
 'mixed-directions':'Exigências declaradas em sentidos mistos',
 'numerically-equivalent':'Alteração textual, limites numéricos equivalentes',
 'different-games-not-comparable':'Jogos diferentes: requisitos não comparáveis'
});
