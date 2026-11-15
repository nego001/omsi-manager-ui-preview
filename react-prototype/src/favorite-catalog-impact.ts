import type {CatalogMod} from './catalog';
import type {DeclaredCatalogChange,DeclaredCatalogDiff} from './catalog-replacement-diff';

// Preview of favorite IDs in the CURRENT declared catalog against a pending
// replacement. Never a reconciliation, restore plan or installed-mod inventory.
export type FavoriteCatalogImpact={
 total:number;
 unchanged:readonly {id:string;title:string}[];
 changed:readonly DeclaredCatalogChange[];
 removed:readonly {id:string;title:string}[];
 allFavoritesDiscardedOnConfirmation:true;
 installedPackagesCompared:false;
 sameIdProvesPackageIdentity:false;
};
const invalid=()=>{throw Error('FAVORITE_CATALOG_IMPACT_INVALID');};
export function summarizeFavoriteCatalogImpact(
 current:readonly CatalogMod[],
 favoriteIds:readonly string[],
 diff:DeclaredCatalogDiff
):FavoriteCatalogImpact{
 if(!Array.isArray(current)||current.length<1||current.length>200||
  !Array.isArray(favoriteIds)||favoriteIds.length>200||
  !diff||typeof diff!=='object'||!Array.isArray(diff.changed)||
  !Array.isArray(diff.removed)||!Array.isArray(diff.added)||
  !Number.isSafeInteger(diff.unchanged)||diff.unchanged<0||
  diff.unchanged+diff.changed.length+diff.removed.length!==current.length)
  return invalid();
 const catalog=new Map<string,CatalogMod>();
 for(const mod of current){
  if(!mod||typeof mod.id!=='string'||!mod.id||catalog.has(mod.id))return invalid();
  catalog.set(mod.id,mod);
 }
 const favorites=new Set<string>();
 for(const id of favoriteIds){
  if(typeof id!=='string'||!catalog.has(id)||favorites.has(id))return invalid();
  favorites.add(id);
 }
 const changed=new Map<string,DeclaredCatalogChange>();
 const removed=new Map<string,{id:string;title:string}>();
 for(const entry of diff.changed){
  if(!entry||typeof entry.id!=='string'||!catalog.has(entry.id)||
   changed.has(entry.id)||entry.oldTitle!==catalog.get(entry.id)?.title||
   typeof entry.newTitle!=='string'||!Array.isArray(entry.fields)||
   entry.fields.length===0)return invalid();
  changed.set(entry.id,entry);
 }
 for(const entry of diff.removed){
  if(!entry||typeof entry.id!=='string'||!catalog.has(entry.id)||
   changed.has(entry.id)||removed.has(entry.id)||
   entry.title!==catalog.get(entry.id)?.title)return invalid();
  removed.set(entry.id,entry);
 }
 const seenAdded=new Set<string>();
 for(const entry of diff.added){
  if(!entry||typeof entry.id!=='string'||!entry.id||catalog.has(entry.id)||
   seenAdded.has(entry.id))return invalid();
  seenAdded.add(entry.id);
 }
 const unchangedFavorites:{id:string;title:string}[]=[];
 const changedFavorites:DeclaredCatalogChange[]=[];
 const removedFavorites:{id:string;title:string}[]=[];
 for(const mod of current){
  if(!favorites.has(mod.id))continue;
  const altered=changed.get(mod.id),absent=removed.get(mod.id);
  if(altered)changedFavorites.push(Object.freeze({
   id:altered.id,oldTitle:altered.oldTitle,newTitle:altered.newTitle,
   fields:Object.freeze([...altered.fields])
  }));
  else if(absent)removedFavorites.push(Object.freeze({id:mod.id,title:mod.title}));
  else unchangedFavorites.push(Object.freeze({id:mod.id,title:mod.title}));
 }
 if(unchangedFavorites.length+changedFavorites.length+removedFavorites.length!==favorites.size)
  return invalid();
 return Object.freeze({
  total:favorites.size,
  unchanged:Object.freeze(unchangedFavorites),
  changed:Object.freeze(changedFavorites),
  removed:Object.freeze(removedFavorites),
  allFavoritesDiscardedOnConfirmation:true,
  installedPackagesCompared:false,sameIdProvesPackageIdentity:false
 });
}
