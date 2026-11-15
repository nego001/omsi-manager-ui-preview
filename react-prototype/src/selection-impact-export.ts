import type {SelectedCatalogImpact} from './selection-catalog-impact';
import {serializeDeclaredFavoriteImpact} from './favorite-impact-export';

// Reuse the existing strict allowlist validator for the three IDENTICAL
// record classes, but produce a DIFFERENT selection-specific export schema.
// No favorite state, catalog manifest, paths or installation instructions.
const invalid=():never=>{throw Error('DECLARED_SELECTION_IMPACT_EXPORT_INVALID');};
export function serializeDeclaredSelectedImpact(impact:SelectedCatalogImpact):string{
 if(!impact||typeof impact!=='object'||
  impact.allSelectionsDiscardedOnConfirmation!==true||
  impact.installedPackagesCompared!==false||
  impact.sameIdProvesPackageIdentity!==false)return invalid();
 let verified:{
  counts:{total:number;unchanged:number;changed:number;removed:number};
  unchanged:readonly {id:string;title:string}[];
  changed:readonly {id:string;oldTitle:string;newTitle:string;fields:readonly string[]}[];
  removed:readonly {id:string;title:string}[];
 };
 try{
  // This serializer rejects duplicates, unapproved field names, controls and
  // contradictory counts and serializes ONLY whitelisted metadata fields.
  verified=JSON.parse(serializeDeclaredFavoriteImpact({
   total:impact.total,unchanged:impact.unchanged,
   changed:impact.changed,removed:impact.removed,
   allFavoritesDiscardedOnConfirmation:true,
   installedPackagesCompared:false,sameIdProvesPackageIdentity:false
  })) as typeof verified;
 }catch{return invalid();}
 const output={
  schema:'omsi-manager-declared-selection-impact-v1',
  scope:'pending-catalog-active-selection-impact-metadata-only',
  source:'catalog-declarations-unverified',
  counts:verified.counts,
  unchanged:verified.unchanged,
  changed:verified.changed,
  removed:verified.removed,
  completeSelectedImpact:true,
  allSelectionsDiscardedOnConfirmation:true,
  proposedCatalogApplied:false,
  sourceAuthenticated:false,
  installationVerified:false,
  compatibilityVerified:false,
  installedPackagesCompared:false,
  restorableByPreview:false,
  sameIdProvesPackageIdentity:false,
  disclaimer:'Relatório da seleção declarativa, não backup restaurável. IDs iguais não comprovam identidade ou compatibilidade. A proposta não foi aplicada.'
 };
 const json=JSON.stringify(output,null,2)+'\n';
 if(new TextEncoder().encode(json).byteLength>131072)
  throw Error('DECLARED_SELECTION_IMPACT_EXPORT_TOO_LARGE');
 return json;
}
