import type {CatalogMod} from './catalog';

export const MAX_FAVORITE_LIST_REVIEW_BYTES=131072;
export type DeclaredFavoriteEntry={
 id:string;title:string;game:CatalogMod['game'];
 category:CatalogMod['category'];version:string
};
export type FavoriteInventoryReview={
 entries:DeclaredFavoriteEntry[];
};
export type FavoriteInventoryDifference={
 field:'title'|'game'|'category'|'version';
 exported:string;current:string;
};
export type FavoriteInventoryChange={
 id:string;differences:FavoriteInventoryDifference[];
};
export type FavoriteInventoryComparison={
 exact:DeclaredFavoriteEntry[];
 changed:DeclaredFavoriteEntry[];
 missing:DeclaredFavoriteEntry[];
 changedDetails:FavoriteInventoryChange[];
};
const rootKeys=['schema','source','compatibilityVerified',
 'installationVerified','restorableByPreview','items'];
const entryKeys=['id','title','game','category','version'];
const games=new Set(['omsi','ets2','ats']);
const categories=new Set(['Ônibus','Mapas','Caminhões','Sons','Gráficos']);

function object(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))
  throw Error('INVENTORY_INVALID_STRUCTURE');
 return value as Record<string,unknown>;
}
function exactKeys(value:Record<string,unknown>,keys:string[]){
 if(Object.keys(value).length!==keys.length||
    Object.keys(value).some(k=>!keys.includes(k))||
    keys.some(k=>!Object.hasOwn(value,k)))
  throw Error('INVENTORY_INVALID_STRUCTURE');
}
function boundedText(value:unknown,max:number):string{
 if(typeof value!=='string'||value.length===0||value.length>max||
    value.trim()!==value||/[\u0000-\u001f\u007f]/.test(value))
  throw Error('INVENTORY_INVALID_STRUCTURE');
 return value;
}
export function parseFavoriteInventory(raw:string):FavoriteInventoryReview{
 if(new TextEncoder().encode(raw).length>MAX_FAVORITE_LIST_REVIEW_BYTES)
  throw Error('INVENTORY_TOO_LARGE');
 let input:unknown;
 try{input=JSON.parse(raw)}catch{throw Error('INVENTORY_INVALID_STRUCTURE');}
 const root=object(input);exactKeys(root,rootKeys);
 if(root.schema!=='omsi-manager-declared-favorites-list-v1'||
  root.source!=='catalog-declarations'||root.compatibilityVerified!==false||
  root.installationVerified!==false||root.restorableByPreview!==false||
  !Array.isArray(root.items)||root.items.length>200)
  throw Error('INVENTORY_INVALID_STRUCTURE');
 const seen=new Set<string>();
 const entries=root.items.map((value:unknown)=>{
  const m=object(value);exactKeys(m,entryKeys);
  const id=boundedText(m.id,64);
  if(!/^[a-z0-9][a-z0-9_-]*$/.test(id)||seen.has(id))
   throw Error('INVENTORY_INVALID_STRUCTURE');
  seen.add(id);
  const title=boundedText(m.title,160);
  const version=boundedText(m.version,60);
  if(!games.has(String(m.game))||!categories.has(String(m.category)))
   throw Error('INVENTORY_INVALID_STRUCTURE');
  return {id,title,game:m.game as CatalogMod['game'],
   category:m.category as CatalogMod['category'],version};
 });
 return {entries};
}
export function compareFavoriteInventory(
 entries:readonly DeclaredFavoriteEntry[],catalog:readonly CatalogMod[]
):FavoriteInventoryComparison{
 const byId=new Map(catalog.map(mod=>[mod.id,mod]));
 const comparison:FavoriteInventoryComparison={exact:[],changed:[],missing:[],changedDetails:[]};
 for(const item of entries){
  const mod=byId.get(item.id);
  if(!mod){comparison.missing.push(item);continue;}
  const differences:FavoriteInventoryDifference[]=[];
  for(const field of ['title','game','category','version'] as const){
   if(item[field]!==mod[field])
    differences.push({field,exported:item[field],current:mod[field]});
  }
  if(differences.length===0)comparison.exact.push(item);
  else{
   comparison.changed.push(item);
   comparison.changedDetails.push({id:item.id,differences});
  }
 }
 return comparison;
}

// A documentary diff, never a manifest, backup, restore plan or installation
// receipt. The source inventory was already validated and the active catalog
// is compared in-memory; no filesystem paths or mod payloads are included.
export function serializeFavoriteInventoryComparison(
 comparison:FavoriteInventoryComparison
):string{
 return JSON.stringify({
  schema:'omsi-manager-declared-favorites-comparison-v1',
  source:'catalog-declarations',
  comparison:'exported-inventory-vs-active-catalog',
  compatibilityVerified:false,
  installationVerified:false,
  restorableByPreview:false,
  counts:{
   total:comparison.exact.length+comparison.changed.length+comparison.missing.length,
   exact:comparison.exact.length,
   changed:comparison.changed.length,
   missing:comparison.missing.length
  },
  exact:comparison.exact.map(({id,title,game,category,version})=>
   ({id,title,game,category,version})),
  changed:comparison.changed.map(({id,title,game,category,version})=>({
   exported:{id,title,game,category,version},
   differences:comparison.changedDetails.find(item=>item.id===id)?.differences??[]
  })),
  missing:comparison.missing.map(({id,title,game,category,version})=>
   ({id,title,game,category,version}))
 },null,2);
}
