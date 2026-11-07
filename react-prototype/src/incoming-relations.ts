import type {CatalogMod} from './catalog';

// Invert only direct, explicit declarations from a validated JSON catalog.
// Cross-game references and reciprocal conflicts are annotations of the
// declarations, not verified incompatibilities or installed mod detections.
export type IncomingDeclaredReference=Pick<CatalogMod,'id'|'title'|'game'|'category'>&{
 differentGame:boolean;
};
export type IncomingDeclaredConflict=IncomingDeclaredReference&{
 reciprocalDeclaration:boolean;
};
export type IncomingDeclaredRelations={
 requiredBy:IncomingDeclaredReference[];
 conflictDeclaredBy:IncomingDeclaredConflict[];
 source:'catalog-json-only';realInstallationVerified:false;
};
export function collectIncomingDeclaredRelations(
 catalog:readonly CatalogMod[],targetId:string
):IncomingDeclaredRelations{
 const target=catalog.find(m=>m.id===targetId);
 if(!target)return {
  requiredBy:[],conflictDeclaredBy:[],
  source:'catalog-json-only',realInstallationVerified:false
 };
 const incoming=(key:'requires'|'conflictsWith')=>catalog.filter(mod=>
  mod.id!==targetId&&(mod[key]??[]).includes(targetId));
 const reference=(mod:CatalogMod):IncomingDeclaredReference=>({
  id:mod.id,title:mod.title,game:mod.game,category:mod.category,
  differentGame:mod.game!==target.game
 });
 return {
  requiredBy:incoming('requires').map(reference),
  conflictDeclaredBy:incoming('conflictsWith').map(mod=>({
   ...reference(mod),
   reciprocalDeclaration:(target.conflictsWith??[]).includes(mod.id)
  })),
  source:'catalog-json-only',realInstallationVerified:false
 };
}
