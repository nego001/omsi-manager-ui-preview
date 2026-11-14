import type {CatalogMod} from './catalog';
import type {DeclaredCatalogDiff,DeclaredCatalogChange} from './catalog-replacement-diff';
import {summarizeFavoriteCatalogImpact} from './favorite-catalog-impact';

// The active batch is a subset of current catalog favorite IDs. Reuse the
// strict categorical projection, but return a SELECTION-specific contract;
// the data is never transferred to the proposed catalog or to game files.
export type SelectedCatalogImpact={
 total:number;
 unchanged:readonly {id:string;title:string}[];
 changed:readonly DeclaredCatalogChange[];
 removed:readonly {id:string;title:string}[];
 allSelectionsDiscardedOnConfirmation:true;
 installedPackagesCompared:false;
 sameIdProvesPackageIdentity:false;
};
export function summarizeSelectedCatalogImpact(
 current:readonly CatalogMod[],
 selectedIds:readonly string[],
 diff:DeclaredCatalogDiff
):SelectedCatalogImpact{
 const impact=summarizeFavoriteCatalogImpact(current,selectedIds,diff);
 return Object.freeze({
  total:impact.total,
  unchanged:impact.unchanged,
  changed:impact.changed,
  removed:impact.removed,
  allSelectionsDiscardedOnConfirmation:true,
  installedPackagesCompared:false,
  sameIdProvesPackageIdentity:false
 });
}
