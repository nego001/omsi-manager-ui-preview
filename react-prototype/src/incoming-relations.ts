import type {CatalogMod} from './catalog';

// Reverse ONLY explicit declarations from validated JSON. No filesystem,
// runtime state or inferred compatibility. Entries retain catalog order.
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
const empty=():IncomingDeclaredRelations=>({
 requiredBy:[],conflictDeclaredBy:[],
 source:'catalog-json-only',realInstallationVerified:false
});

// Single pass over the mods and their declared edges, replacing the former
// full catalog scan for every favorite. Unknown targets and self references
// never create artificial incoming entries.
export function indexIncomingDeclaredRelations(
 catalog:readonly CatalogMod[]
):ReadonlyMap<string,IncomingDeclaredRelations>{
 const lookup=new Map(catalog.map(mod=>[mod.id,mod]));
 const byId=new Map<string,IncomingDeclaredRelations>(
  catalog.map(mod=>[mod.id,empty()])
 );
 const reference=(source:CatalogMod,target:CatalogMod):IncomingDeclaredReference=>({
  id:source.id,title:source.title,game:source.game,category:source.category,
  differentGame:source.game!==target.game
 });
 for(const source of catalog){
  for(const id of source.requires??[]){
   if(id===source.id)continue;
   const target=lookup.get(id),incoming=byId.get(id);
   if(target&&incoming)incoming.requiredBy.push(reference(source,target));
  }
  for(const id of source.conflictsWith??[]){
   if(id===source.id)continue;
   const target=lookup.get(id),incoming=byId.get(id);
   if(target&&incoming)incoming.conflictDeclaredBy.push({
    ...reference(source,target),
    reciprocalDeclaration:(target.conflictsWith??[]).includes(source.id)
   });
  }
 }
 return byId;
}

// Kept as a small API for one-off detail and test queries. The Library uses
// indexIncomingDeclaredRelations once for the entire validated catalog.
export function collectIncomingDeclaredRelations(
 catalog:readonly CatalogMod[],targetId:string
):IncomingDeclaredRelations{
 return indexIncomingDeclaredRelations(catalog).get(targetId)??empty();
}
