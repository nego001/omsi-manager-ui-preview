import type {CatalogMod} from './catalog';

// Human-readable inventory of declared metadata only. It is deliberately
// NOT a catalog manifest, an installation receipt, or an importable backup.
export function serializeDeclaredFavoriteList(favorites:readonly CatalogMod[]):string{
 const items=favorites.map(({id,title,game,category,version})=>({
  id,title,game,category,version
 }));
 return JSON.stringify({
  schema:'omsi-manager-declared-favorites-list-v1',
  source:'catalog-declarations',
  compatibilityVerified:false,
  installationVerified:false,
  restorableByPreview:false,
  items
 },null,2);
}
