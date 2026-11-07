import type {CatalogMod} from './catalog';

// Invert only direct, explicit, one-way declarations from validated JSON.
// This is metadata navigation: not installed mods or real compatibility.
export type IncomingDeclaredReference=Pick<CatalogMod,'id'|'title'|'game'|'category'>;
export type IncomingDeclaredRelations={
 requiredBy:IncomingDeclaredReference[];
 conflictDeclaredBy:IncomingDeclaredReference[];
 source:'catalog-json-only';realInstallationVerified:false;
};
export function collectIncomingDeclaredRelations(
 catalog:readonly CatalogMod[],targetId:string
):IncomingDeclaredRelations{
 const matches=(key:'requires'|'conflictsWith')=>
  catalog.filter(m=>m.id!==targetId&&(m[key]??[]).includes(targetId))
   .map(m=>({id:m.id,title:m.title,game:m.game,category:m.category}));
 if(!catalog.some(m=>m.id===targetId))return {
  requiredBy:[],conflictDeclaredBy:[],
  source:'catalog-json-only',realInstallationVerified:false
 };
 return {requiredBy:matches('requires'),conflictDeclaredBy:matches('conflictsWith'),
  source:'catalog-json-only',realInstallationVerified:false};
}
