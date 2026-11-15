import type {CatalogMod,GameId} from './catalog';

// Detect only metadata-ID reuse across different declared games. This is
// not file identity, a mod conversion, a compatibility verdict or a migration.
export type CrossGameIdReuse={
 id:string;
 oldTitle:string;newTitle:string;
 oldGame:GameId;newGame:GameId;
 inFavorites:boolean;inActiveSelection:boolean;
};
const games:ReadonlySet<string>=new Set(['omsi','ets2','ats']);
const validId=/^[a-z0-9][a-z0-9_-]*$/;
const invalid=():never=>{throw Error('DECLARED_CROSS_GAME_REUSE_INVALID');};
export function findDeclaredCrossGameIdReuses(
 current:readonly CatalogMod[],proposed:readonly CatalogMod[],
 favoriteIds:readonly string[],selectedIds:readonly string[]
):readonly CrossGameIdReuse[]{
 if(!Array.isArray(current)||!Array.isArray(proposed)||
  current.length<1||current.length>200||proposed.length<1||proposed.length>200||
  !Array.isArray(favoriteIds)||favoriteIds.length>200||
  !Array.isArray(selectedIds)||selectedIds.length>200)return invalid();
 function index(mods:readonly CatalogMod[]){
  const indexed=new Map<string,CatalogMod>();
  for(const mod of mods){
   if(!mod||typeof mod!=='object'||typeof mod.id!=='string'||
    mod.id.length>64||!validId.test(mod.id)||indexed.has(mod.id)||
    !games.has(mod.game)||typeof mod.title!=='string'||!mod.title.trim()||
    mod.title.length>160||/[\u0000-\u001f\u007f]/.test(mod.title))return invalid();
   indexed.set(mod.id,mod);
  }
  return indexed;
 }
 const from=index(current),to=index(proposed);
 function scopedIds(ids:readonly string[],subset?:ReadonlySet<string>){
  const seen=new Set<string>();
  for(const id of ids){
   if(typeof id!=='string'||!from.has(id)||seen.has(id)||
    (subset&&!subset.has(id)))return invalid();
   seen.add(id);
  }
  return seen;
 }
 const favorite=scopedIds(favoriteIds),selected=scopedIds(selectedIds,favorite);
 const result:CrossGameIdReuse[]=[];
 for(const oldMod of current){
  const next=to.get(oldMod.id);
  if(!next||oldMod.game===next.game)continue;
  result.push(Object.freeze({
   id:oldMod.id,
   oldTitle:oldMod.title,newTitle:next.title,
   oldGame:oldMod.game,newGame:next.game,
   inFavorites:favorite.has(oldMod.id),
   inActiveSelection:selected.has(oldMod.id)
  }));
 }
 return Object.freeze(result);
}
